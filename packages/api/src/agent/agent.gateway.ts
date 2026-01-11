/**
 * Agent Gateway - WebSocket gateway for real-time agent communication
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { createLogger } from '@devflow/common';
import { AgentService } from './agent.service';
import { SessionService } from '@/user-auth/services/session.service';
import {
  AgentChatEvent,
  AgentResponse,
  AgentDeltaResponse,
  AgentToolCallResponse,
  AgentToolResultResponse,
  AgentDoneResponse,
  AgentErrorResponse,
} from './agent.types';

const logger = createLogger('AgentGateway');

interface AuthenticatedSocket extends Socket {
  userId?: string;
  sessionToken?: string;
}

@WebSocketGateway({
  namespace: '/agent',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001'],
    credentials: true,
  },
})
export class AgentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly agentService: AgentService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Handle new WebSocket connection
   */
  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      // Extract session token from handshake
      const sessionToken = this.extractSessionToken(client);

      if (!sessionToken) {
        logger.warn('Connection rejected: No session token', { clientId: client.id });
        client.emit('error', { type: 'error', message: 'Authentication required', code: 'AUTH_REQUIRED' });
        client.disconnect();
        return;
      }

      // Validate session
      const user = await this.sessionService.validateSession(sessionToken);

      if (!user) {
        logger.warn('Connection rejected: Invalid session', { clientId: client.id });
        client.emit('error', { type: 'error', message: 'Invalid or expired session', code: 'AUTH_INVALID' });
        client.disconnect();
        return;
      }

      // Store user info on socket
      client.userId = user.id;
      client.sessionToken = sessionToken;

      logger.info('Client connected', { clientId: client.id, userId: user.id });

      // Send connection acknowledgment
      client.emit('connected', { userId: user.id });
    } catch (error) {
      logger.error('Connection error', error as Error, { clientId: client.id });
      client.emit('error', { type: 'error', message: 'Connection failed', code: 'CONNECTION_ERROR' });
      client.disconnect();
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  handleDisconnect(client: AuthenticatedSocket): void {
    logger.info('Client disconnected', { clientId: client.id, userId: client.userId });
  }

  /**
   * Handle chat message from client
   */
  @SubscribeMessage('chat')
  async handleChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: AgentChatEvent
  ): Promise<void> {
    const userId = client.userId;

    if (!userId) {
      this.sendError(client, 'Not authenticated', 'AUTH_REQUIRED');
      return;
    }

    // Validate input
    if (!data.projectId || !data.message) {
      this.sendError(client, 'Missing projectId or message', 'INVALID_INPUT');
      return;
    }

    // Check if agent is available
    if (!this.agentService.isAvailable()) {
      this.sendError(client, 'Agent service not available', 'SERVICE_UNAVAILABLE');
      return;
    }

    logger.info('Processing chat message', {
      clientId: client.id,
      userId,
      projectId: data.projectId,
      conversationId: data.conversationId,
      messageLength: data.message.length,
    });

    try {
      // Process message with streaming callbacks
      const { response, conversationId } = await this.agentService.chat(
        userId,
        data.projectId,
        data.message,
        data.conversationId,
        {
          onDelta: (chunk) => {
            this.sendDelta(client, chunk);
          },
          onToolCall: (name, args) => {
            this.sendToolCall(client, name, args);
          },
          onToolResult: (name, result, success) => {
            this.sendToolResult(client, name, result, success);
          },
          onError: (error) => {
            logger.error('Agent error during processing', error);
          },
        }
      );

      // Send completion
      this.sendDone(client, conversationId, response.usage);

      logger.info('Chat message processed', {
        clientId: client.id,
        conversationId,
        success: response.success,
        toolCalls: response.usage.toolCalls,
        tokens: response.usage.totalTokens,
      });
    } catch (error) {
      logger.error('Chat processing failed', error as Error, {
        clientId: client.id,
        userId,
        projectId: data.projectId,
      });

      const message = error instanceof Error ? error.message : 'An error occurred';
      this.sendError(client, message, 'PROCESSING_ERROR');
    }
  }

  /**
   * Handle ping (keep-alive)
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket): void {
    client.emit('pong', { timestamp: Date.now() });
  }

  // Helper methods to send typed responses

  private sendDelta(client: Socket, content: string): void {
    const response: AgentDeltaResponse = { type: 'delta', content };
    client.emit('response', response);
  }

  private sendToolCall(client: Socket, name: string, args: Record<string, unknown>): void {
    const response: AgentToolCallResponse = { type: 'tool_call', name, args };
    client.emit('response', response);
  }

  private sendToolResult(client: Socket, name: string, result: unknown, success: boolean): void {
    const response: AgentToolResultResponse = { type: 'tool_result', name, result, success };
    client.emit('response', response);
  }

  private sendDone(
    client: Socket,
    conversationId: string,
    usage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      totalCost?: number;
      llmCalls: number;
      toolCalls: number;
    }
  ): void {
    const response: AgentDoneResponse = { type: 'done', conversationId, usage };
    client.emit('response', response);
  }

  private sendError(client: Socket, message: string, code?: string): void {
    const response: AgentErrorResponse = { type: 'error', message, code };
    client.emit('response', response);
  }

  /**
   * Extract session token from handshake
   */
  private extractSessionToken(client: Socket): string | null {
    // Try cookie first
    const cookies = client.handshake.headers.cookie;
    if (cookies) {
      const match = cookies.match(/devflow_session=([^;]+)/);
      if (match) {
        return match[1];
      }
    }

    // Try auth header
    const authHeader = client.handshake.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    // Try query parameter (for development)
    const token = client.handshake.query.token;
    if (typeof token === 'string') {
      return token;
    }

    return null;
  }
}
