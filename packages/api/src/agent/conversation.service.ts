/**
 * Conversation Service - Manages conversation state in Redis
 */

import { Injectable, Inject } from '@nestjs/common';
import { createLogger } from '@devflow/common';
import { ConversationMessage } from '@devflow/sdk';
import { StoredConversation } from './agent.types';
import * as crypto from 'crypto';

const logger = createLogger('ConversationService');

@Injectable()
export class ConversationService {
  private readonly PREFIX = 'agent:conversation:';
  private readonly TTL_SECONDS: number;
  private readonly MAX_MESSAGES: number;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: any) {
    this.TTL_SECONDS = parseInt(process.env.CONVERSATION_TTL_HOURS || '24', 10) * 60 * 60;
    this.MAX_MESSAGES = parseInt(process.env.CONVERSATION_MAX_MESSAGES || '50', 10);
  }

  /**
   * Create a new conversation
   */
  async create(projectId: string, userId: string): Promise<string> {
    const conversationId = this.generateId();
    const now = new Date().toISOString();

    const conversation: StoredConversation = {
      id: conversationId,
      projectId,
      userId,
      messages: [],
      createdAt: now,
      updatedAt: now,
      totalTokens: 0,
      totalCost: 0,
    };

    await this.redis.set(
      `${this.PREFIX}${conversationId}`,
      JSON.stringify(conversation),
      { EX: this.TTL_SECONDS }
    );

    logger.info('Created conversation', { conversationId, projectId, userId });
    return conversationId;
  }

  /**
   * Get a conversation by ID
   */
  async get(conversationId: string): Promise<StoredConversation | null> {
    const data = await this.redis.get(`${this.PREFIX}${conversationId}`);
    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as StoredConversation;
    } catch (error) {
      logger.error('Failed to parse conversation', error as Error, { conversationId });
      return null;
    }
  }

  /**
   * Get conversation history (messages only)
   */
  async getHistory(conversationId: string): Promise<ConversationMessage[]> {
    const conversation = await this.get(conversationId);
    return conversation?.messages || [];
  }

  /**
   * Append messages to a conversation
   */
  async appendMessages(
    conversationId: string,
    messages: ConversationMessage[],
    tokensDelta: number = 0,
    costDelta: number = 0
  ): Promise<void> {
    const conversation = await this.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    // Append messages
    conversation.messages.push(...messages);

    // Trim old messages if exceeding limit
    if (conversation.messages.length > this.MAX_MESSAGES) {
      // Keep system message if present, then trim oldest messages
      const systemMessages = conversation.messages.filter((m) => m.role === 'system');
      const otherMessages = conversation.messages.filter((m) => m.role !== 'system');

      const trimmed = otherMessages.slice(-(this.MAX_MESSAGES - systemMessages.length));
      conversation.messages = [...systemMessages, ...trimmed];

      logger.debug('Trimmed conversation messages', {
        conversationId,
        originalCount: conversation.messages.length + messages.length,
        trimmedCount: conversation.messages.length,
      });
    }

    // Update metrics
    conversation.totalTokens += tokensDelta;
    conversation.totalCost += costDelta;
    conversation.updatedAt = new Date().toISOString();

    // Save with refreshed TTL
    await this.redis.set(
      `${this.PREFIX}${conversationId}`,
      JSON.stringify(conversation),
      { EX: this.TTL_SECONDS }
    );

    logger.debug('Appended messages to conversation', {
      conversationId,
      messagesAdded: messages.length,
      totalMessages: conversation.messages.length,
    });
  }

  /**
   * Update conversation metrics
   */
  async updateMetrics(
    conversationId: string,
    tokensDelta: number,
    costDelta: number
  ): Promise<void> {
    const conversation = await this.get(conversationId);
    if (!conversation) {
      return;
    }

    conversation.totalTokens += tokensDelta;
    conversation.totalCost += costDelta;
    conversation.updatedAt = new Date().toISOString();

    await this.redis.set(
      `${this.PREFIX}${conversationId}`,
      JSON.stringify(conversation),
      { EX: this.TTL_SECONDS }
    );
  }

  /**
   * Delete a conversation
   */
  async delete(conversationId: string): Promise<void> {
    await this.redis.del(`${this.PREFIX}${conversationId}`);
    logger.debug('Deleted conversation', { conversationId });
  }

  /**
   * Check if user owns the conversation
   */
  async validateOwnership(conversationId: string, userId: string): Promise<boolean> {
    const conversation = await this.get(conversationId);
    return conversation?.userId === userId;
  }

  /**
   * Check if conversation exists and belongs to project
   */
  async validateAccess(
    conversationId: string,
    projectId: string,
    userId: string
  ): Promise<boolean> {
    const conversation = await this.get(conversationId);
    if (!conversation) {
      return false;
    }
    return conversation.projectId === projectId && conversation.userId === userId;
  }

  /**
   * Get conversation count for rate limiting
   */
  async getUserConversationCount(userId: string, withinHours: number = 1): Promise<number> {
    // For simplicity, we track this in a separate key
    const key = `agent:rate:${userId}`;
    const count = await this.redis.get(key);
    return parseInt(count || '0', 10);
  }

  /**
   * Increment rate limit counter
   */
  async incrementRateLimit(userId: string): Promise<void> {
    const key = `agent:rate:${userId}`;
    const ttl = 60 * 60; // 1 hour

    const exists = await this.redis.exists(key);
    if (exists) {
      await this.redis.incr(key);
    } else {
      await this.redis.set(key, '1', { EX: ttl });
    }
  }

  /**
   * Generate a secure conversation ID
   */
  private generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }
}
