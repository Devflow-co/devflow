/**
 * Agent Module - Conversational AI agent with WebSocket support
 */

import { Module, forwardRef } from '@nestjs/common';
import { AgentGateway } from './agent.gateway';
import { AgentService } from './agent.service';
import { ConversationService } from './conversation.service';
import { AuthModule } from '@/auth/auth.module';
import { UserAuthModule } from '@/user-auth/user-auth.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { WorkflowsModule } from '@/workflows/workflows.module';
import { RagModule } from '@/rag/rag.module';

@Module({
  imports: [
    forwardRef(() => AuthModule), // For REDIS_CLIENT, TokenRefreshService
    forwardRef(() => UserAuthModule), // For SessionService
    forwardRef(() => WorkflowsModule), // For WorkflowsService
    forwardRef(() => RagModule), // For RagService
    PrismaModule,
  ],
  providers: [
    ConversationService,
    AgentService,
    AgentGateway,
  ],
  exports: [
    AgentService,
    ConversationService,
  ],
})
export class AgentModule {}
