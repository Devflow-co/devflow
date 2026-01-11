/**
 * Manual test for Conversational Agent with Tools
 *
 * This test uses mock services to verify tool calling works correctly.
 *
 * Run: OPENROUTER_API_KEY=<your-key> npx ts-node src/__manual_tests__/test-conversational-agent-with-tools.ts
 */

import {
  ConversationalAgent,
  createToolRegistry,
  createToolExecutor,
  createOpenRouterConversationalProvider,
  AgentContext,
  registerAllTools,
  ToolServices,
} from '../agents/conversational';

// Mock services that simulate real integrations
function createMockServices(): ToolServices {
  return {
    linear: {
      getIssue: async (issueId) => {
        console.log(`   [Mock] Linear.getIssue(${issueId})`);
        return {
          id: issueId,
          identifier: 'DEV-123',
          title: 'Add user authentication',
          description: 'Implement OAuth2 login with Google and GitHub providers',
          status: 'In Progress',
          priority: 2,
          assignee: { name: 'John Doe', email: 'john@example.com' },
          labels: ['feature', 'auth'],
          url: `https://linear.app/devflow/issue/${issueId}`,
        };
      },
      createIssue: async (data) => {
        console.log(`   [Mock] Linear.createIssue("${data.title}")`);
        return {
          id: 'new-issue-id-123',
          identifier: 'DEV-456',
          title: data.title,
          description: data.description,
          status: 'Backlog',
          url: 'https://linear.app/devflow/issue/DEV-456',
        };
      },
      updateStatus: async (issueId, status) => {
        console.log(`   [Mock] Linear.updateStatus(${issueId}, ${status})`);
      },
      addComment: async (issueId, body) => {
        console.log(`   [Mock] Linear.addComment(${issueId}, "${body.substring(0, 50)}...")`);
        return 'comment-id-789';
      },
      queryIssues: async (filter) => {
        console.log(`   [Mock] Linear.queryIssues(${JSON.stringify(filter)})`);
        return [
          {
            id: 'issue-1',
            identifier: 'DEV-100',
            title: 'Fix login bug',
            status: filter.status || 'To Do',
          },
          {
            id: 'issue-2',
            identifier: 'DEV-101',
            title: 'Add password reset',
            status: filter.status || 'To Do',
          },
        ];
      },
    },
    rag: {
      searchCodebase: async (query, limit) => {
        console.log(`   [Mock] RAG.searchCodebase("${query}", ${limit})`);
        return [
          {
            content: `// auth.service.ts
export class AuthService {
  async login(email: string, password: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user || !await bcrypt.compare(password, user.password)) {
      throw new UnauthorizedException();
    }
    return this.jwtService.sign({ userId: user.id });
  }
}`,
            filepath: 'src/auth/auth.service.ts',
            score: 0.92,
            metadata: { language: 'typescript', lines: '1-12' },
          },
          {
            content: `// auth.controller.ts
@Controller('auth')
export class AuthController {
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }
}`,
            filepath: 'src/auth/auth.controller.ts',
            score: 0.87,
            metadata: { language: 'typescript', lines: '1-8' },
          },
        ];
      },
      getFile: async (filepath) => {
        console.log(`   [Mock] RAG.getFile("${filepath}")`);
        if (filepath.includes('auth')) {
          return `// ${filepath}
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(email: string, password: string) {
    // Implementation here
  }
}`;
        }
        return null;
      },
      getDirectoryTree: async (path) => {
        console.log(`   [Mock] RAG.getDirectoryTree("${path}")`);
        return {
          name: path || 'src',
          type: 'directory' as const,
          children: [
            { name: 'auth', type: 'directory' as const, children: [
              { name: 'auth.service.ts', type: 'file' as const },
              { name: 'auth.controller.ts', type: 'file' as const },
            ]},
            { name: 'users', type: 'directory' as const, children: [
              { name: 'users.service.ts', type: 'file' as const },
            ]},
          ],
        };
      },
    },
  };
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY environment variable is required');
    process.exit(1);
  }

  console.log('🚀 Testing Conversational Agent with Tools');
  console.log('=' .repeat(50));

  // Create provider
  const provider = createOpenRouterConversationalProvider({
    apiKey,
    model: 'anthropic/claude-sonnet-4',
  });

  // Create registry and register all tools
  const registry = createToolRegistry();
  registerAllTools(registry);

  console.log(`\n📋 Registered ${registry.count} tools:`);
  console.log(`   Categories: ${registry.getCategories().join(', ')}`);
  console.log(`   Summary: ${JSON.stringify(registry.getSummary())}`);

  // Create executor
  const executor = createToolExecutor(registry);

  // Create agent
  const agent = new ConversationalAgent(provider, registry, executor);

  // Create mock services
  const mockServices = createMockServices();

  // Test context
  const context: AgentContext = {
    projectId: 'test-project',
    services: mockServices,
    projectContext: {
      name: 'DevFlow',
      description: 'A development workflow automation platform',
      language: 'TypeScript',
      framework: 'NestJS',
      repository: {
        owner: 'devflow',
        repo: 'devflow',
        defaultBranch: 'main',
      },
    },
  };

  // Test 1: Search codebase
  console.log('\n📝 Test 1: Search the codebase for authentication');
  console.log('-'.repeat(50));

  const response1 = await agent.processMessage(
    'Search the codebase to find how authentication is implemented.',
    [],
    context,
    {
      onDelta: (chunk) => process.stdout.write(chunk),
      onToolCall: (name, args) => console.log(`\n   🔧 Tool: ${name}`),
      onToolResult: (name, result, success) => console.log(`   ${success ? '✅' : '❌'} Result from ${name}`),
    },
    {
      maxIterations: 5,
      maxTokens: 1024,
    }
  );

  console.log('\n');
  console.log(`   Success: ${response1.success ? '✅' : '❌'}`);
  console.log(`   Tool calls: ${response1.usage.toolCalls}`);
  console.log(`   LLM calls: ${response1.usage.llmCalls}`);
  console.log(`   Tools used: ${response1.toolExecutions.map(t => t.name).join(', ') || 'none'}`);

  // Test 2: Get issue details
  console.log('\n📝 Test 2: Get a Linear issue');
  console.log('-'.repeat(50));

  const response2 = await agent.processMessage(
    'Get the details of Linear issue abc123-def456.',
    response1.newMessages,
    context,
    {
      onDelta: (chunk) => process.stdout.write(chunk),
      onToolCall: (name, args) => console.log(`\n   🔧 Tool: ${name}`),
      onToolResult: (name, result, success) => console.log(`   ${success ? '✅' : '❌'} Result from ${name}`),
    },
    {
      maxIterations: 3,
      maxTokens: 512,
    }
  );

  console.log('\n');
  console.log(`   Success: ${response2.success ? '✅' : '❌'}`);
  console.log(`   Tool calls: ${response2.usage.toolCalls}`);
  console.log(`   Tools used: ${response2.toolExecutions.map(t => t.name).join(', ') || 'none'}`);

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('✅ Conversational Agent with Tools test completed!');

  const totalToolCalls = response1.usage.toolCalls + response2.usage.toolCalls;
  const totalLLMCalls = response1.usage.llmCalls + response2.usage.llmCalls;
  const totalTokens = response1.usage.totalTokens + response2.usage.totalTokens;

  console.log(`   Total tool calls: ${totalToolCalls}`);
  console.log(`   Total LLM calls: ${totalLLMCalls}`);
  console.log(`   Total tokens: ${totalTokens}`);
}

main().catch(console.error);
