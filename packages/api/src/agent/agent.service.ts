/**
 * Agent Service - Orchestrates the conversational agent
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { createLogger } from '@devflow/common';
import {
  ConversationalAgent,
  createToolRegistry,
  createToolExecutor,
  createOpenRouterConversationalProvider,
  registerAllTools,
  AgentContext,
  AgentCallbacks,
  ConversationalAgentResponse,
  ToolServices,
  ILLMProvider,
  LinearIntegrationService,
  GitHubIntegrationService,
  ITokenResolver,
} from '@devflow/sdk';
import { OAuthProvider } from '@prisma/client';

import { ConversationService } from './conversation.service';
import { AgentConfig } from './agent.types';
import { PrismaService } from '@/prisma/prisma.service';
import { TokenRefreshService } from '@/auth/services/token-refresh.service';
import { WorkflowsService } from '@/workflows/workflows.service';
import { RagService } from '@/rag/rag.service';

const logger = createLogger('AgentService');

/**
 * Token resolver adapter that wraps NestJS TokenRefreshService
 * to implement the SDK's ITokenResolver interface
 */
class TokenResolverAdapter implements ITokenResolver {
  constructor(private readonly tokenRefreshService: TokenRefreshService) {}

  async getAccessToken(projectId: string, provider: 'LINEAR' | 'GITHUB' | 'FIGMA' | 'SENTRY' | 'SLACK'): Promise<string> {
    return this.tokenRefreshService.getAccessToken(projectId, provider as OAuthProvider);
  }
}

@Injectable()
export class AgentService implements OnModuleInit {
  private agent: ConversationalAgent | null = null;
  private config: AgentConfig;
  private tokenResolver: ITokenResolver;
  private linearService: LinearIntegrationService;
  private githubService: GitHubIntegrationService;

  constructor(
    private readonly conversationService: ConversationService,
    private readonly prisma: PrismaService,
    private readonly tokenRefreshService: TokenRefreshService,
    private readonly workflowsService: WorkflowsService,
    private readonly ragService: RagService,
  ) {
    // Create token resolver adapter and integration services
    this.tokenResolver = new TokenResolverAdapter(tokenRefreshService);
    this.linearService = new LinearIntegrationService(this.tokenResolver);
    this.githubService = new GitHubIntegrationService(this.tokenResolver);
    this.config = {
      provider: (process.env.LLM_PROVIDER as 'openrouter' | 'ollama') || 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.LLM_MODEL || 'anthropic/claude-sonnet-4',
      baseUrl: process.env.OLLAMA_BASE_URL,
      conversationTtlHours: parseInt(process.env.CONVERSATION_TTL_HOURS || '24', 10),
      maxMessagesPerConversation: parseInt(process.env.CONVERSATION_MAX_MESSAGES || '50', 10),
      maxToolCallsPerMessage: parseInt(process.env.AGENT_MAX_TOOL_CALLS || '20', 10),
      rateLimitPerHour: parseInt(process.env.AGENT_RATE_LIMIT_PER_HOUR || '100', 10),
    };
  }

  async onModuleInit(): Promise<void> {
    await this.initializeAgent();
  }

  /**
   * Initialize the conversational agent
   */
  private async initializeAgent(): Promise<void> {
    if (!this.config.apiKey && this.config.provider === 'openrouter') {
      logger.warn('OPENROUTER_API_KEY not set, agent will not be available');
      return;
    }

    try {
      // Create LLM provider
      const provider = this.createProvider();

      // Create and populate tool registry
      const registry = createToolRegistry();
      registerAllTools(registry);

      // Create tool executor
      const executor = createToolExecutor(registry, {
        timeout: 30000,
        maxConcurrent: 5,
        continueOnError: true,
      });

      // Create agent
      this.agent = new ConversationalAgent(provider, registry, executor);

      logger.info('Agent initialized', {
        provider: this.config.provider,
        model: this.config.model,
        toolCount: registry.count,
      });
    } catch (error) {
      logger.error('Failed to initialize agent', error as Error);
    }
  }

  /**
   * Create LLM provider based on configuration
   */
  private createProvider(): ILLMProvider {
    if (this.config.provider === 'openrouter') {
      return createOpenRouterConversationalProvider({
        apiKey: this.config.apiKey!,
        model: this.config.model,
      });
    }

    // TODO: Add Ollama provider when implemented
    throw new Error(`Unsupported provider: ${this.config.provider}`);
  }

  /**
   * Process a chat message
   */
  async chat(
    userId: string,
    projectId: string,
    message: string,
    conversationId?: string,
    callbacks?: AgentCallbacks
  ): Promise<{ response: ConversationalAgentResponse; conversationId: string }> {
    if (!this.agent) {
      throw new Error('Agent not initialized. Check your API key configuration.');
    }

    // Rate limiting
    const rateLimitCount = await this.conversationService.getUserConversationCount(userId);
    if (rateLimitCount >= this.config.rateLimitPerHour) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      convId = await this.conversationService.create(projectId, userId);
      await this.conversationService.incrementRateLimit(userId);
    } else {
      // Validate access
      const hasAccess = await this.conversationService.validateAccess(convId, projectId, userId);
      if (!hasAccess) {
        throw new Error('Conversation not found or access denied');
      }
    }

    // Get conversation history
    const history = await this.conversationService.getHistory(convId);

    // Build agent context
    const context = await this.buildAgentContext(projectId, userId);

    // Process message
    const response = await this.agent.processMessage(
      message,
      history,
      context,
      callbacks,
      {
        maxIterations: 10,
        maxTokens: 4096,
        temperature: 0.7,
      }
    );

    // Save new messages to conversation
    if (response.newMessages.length > 0) {
      await this.conversationService.appendMessages(
        convId,
        response.newMessages,
        response.usage.totalTokens,
        response.usage.totalCost || 0
      );
    }

    return { response, conversationId: convId };
  }

  /**
   * Build agent context from project settings
   */
  private async buildAgentContext(projectId: string, userId: string): Promise<AgentContext> {
    // Load project from database
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    // Build tool services - wired to real integration services
    const services: ToolServices = {
      // Linear service - wired to LinearIntegrationService
      linear: {
        getIssue: async (issueId: string) => {
          return this.linearService.getTask(projectId, issueId);
        },
        createIssue: async (data) => {
          // LinearIntegrationService doesn't have createIssue yet
          // Return a placeholder - can be implemented later
          logger.warn('createIssue not implemented in LinearIntegrationService');
          throw new Error('createIssue not yet implemented');
        },
        updateStatus: async (issueId: string, status: string) => {
          return this.linearService.updateStatus(projectId, issueId, status);
        },
        addComment: async (issueId: string, body: string) => {
          return this.linearService.addComment(projectId, issueId, body);
        },
        queryIssues: async (filter) => {
          return this.linearService.queryIssues(projectId, {
            teamId: filter.teamId,
            states: filter.status ? [filter.status] : undefined,
            assigneeId: filter.assigneeId,
            first: filter.limit,
          });
        },
      },

      // GitHub service - wired to GitHubIntegrationService
      github: {
        getRepo: async (owner: string, repo: string) => {
          return this.githubService.getRepository(projectId, owner, repo);
        },
        getFile: async (owner: string, repo: string, path: string) => {
          // GitHubIntegrationService doesn't have getFile yet
          logger.warn('getFile not implemented in GitHubIntegrationService');
          throw new Error('getFile not yet implemented');
        },
        createBranch: async (owner: string, repo: string, branch: string, base: string) => {
          return this.githubService.createBranch(projectId, owner, repo, { name: branch, from: base });
        },
        commitFiles: async (data) => {
          return this.githubService.commitFiles(projectId, data.owner, data.repo, {
            branch: data.branch,
            files: data.files,
            message: data.message,
          });
        },
        createPR: async (data) => {
          return this.githubService.createPullRequest(projectId, data.owner, data.repo, {
            title: data.title,
            body: data.body,
            sourceBranch: data.head,
            targetBranch: data.base,
          });
        },
        getPipelineStatus: async (owner: string, repo: string, branch: string) => {
          // GitHub doesn't have native pipeline - would need to check Actions
          logger.warn('getPipelineStatus not implemented');
          return { status: 'unknown', branch };
        },
      },

      // RAG service - wired to RagService
      rag: {
        searchCodebase: async (query: string, limit?: number) => {
          const results = await this.ragService.search(projectId, {
            query,
            topK: limit || 10,
          });
          return results.map(r => ({
            content: r.content,
            filepath: r.filePath,
            score: r.score,
            metadata: r.metadata,
          }));
        },
        getFile: async (filepath: string) => {
          // RAG doesn't have direct file access - search by exact path
          const results = await this.ragService.browseChunks(projectId, {
            filePath: filepath,
            limit: 100,
          });
          if (results.items.length === 0) return null;
          // Concatenate all chunks for the file
          return results.items.map(c => c.content).join('\n');
        },
        getDirectoryTree: async (path: string) => {
          // RAG doesn't have directory tree - return basic structure
          logger.warn('getDirectoryTree not fully implemented');
          return { name: path, type: 'directory' as const, children: [] };
        },
      },

      // Workflow service - wired to WorkflowsService
      workflow: {
        start: async (taskId: string, phase) => {
          // Map phase to workflow type
          const workflowTypeMap: Record<string, string> = {
            refinement: 'devflowWorkflow', // Main workflow handles phases
            user_story: 'devflowWorkflow',
            technical_plan: 'devflowWorkflow',
            code_generation: 'devflowWorkflow',
          };
          const result = await this.workflowsService.start({
            taskId,
            projectId,
            userId,
            workflowType: workflowTypeMap[phase] || 'devflowWorkflow',
          });
          return {
            workflowId: result.workflowId,
            status: 'started',
          };
        },
        getStatus: async (workflowId: string) => {
          const status = await this.workflowsService.getStatus(workflowId);
          return {
            workflowId: status.workflowId,
            phase: 'refinement' as const, // Would need to track actual phase
            status: status.status.toLowerCase() as 'pending' | 'running' | 'completed' | 'failed' | 'cancelled',
          };
        },
        cancel: async (workflowId: string) => {
          await this.workflowsService.cancel(workflowId);
        },
      },
    };

    // Parse project config for additional context
    const config = project?.config as Record<string, unknown> | null;

    // Parse repository URL to extract owner/repo
    let repositoryContext: { owner: string; repo: string; defaultBranch: string } | undefined;
    if (project?.repository) {
      const match = project.repository.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
      if (match) {
        repositoryContext = {
          owner: match[1],
          repo: match[2],
          defaultBranch: (config?.defaultBranch as string) || 'main',
        };
      }
    }

    return {
      projectId,
      userId,
      services,
      projectContext: project
        ? {
            name: project.name,
            description: project.description || undefined,
            language: (config?.language as string) || undefined,
            framework: (config?.framework as string) || undefined,
            repository: repositoryContext,
          }
        : undefined,
      rateLimits: {
        maxToolCallsPerMessage: this.config.maxToolCallsPerMessage,
        maxMessagesPerConversation: this.config.maxMessagesPerConversation,
      },
      features: {
        enableWorkflowTools: true,
        enableCodeExecution: false, // Disabled for safety
        enableFileModification: false, // Disabled for safety
      },
    };
  }

  /**
   * Check if agent is available
   */
  isAvailable(): boolean {
    return this.agent !== null;
  }

  /**
   * Get agent configuration (for debugging)
   */
  getConfig(): Omit<AgentConfig, 'apiKey'> {
    const { apiKey, ...config } = this.config;
    return config;
  }
}
