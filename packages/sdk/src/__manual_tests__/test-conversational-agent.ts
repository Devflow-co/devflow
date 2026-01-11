/**
 * Manual test for Conversational Agent
 *
 * Run: OPENROUTER_API_KEY=<your-key> npx ts-node src/__manual_tests__/test-conversational-agent.ts
 */

import {
  ConversationalAgent,
  createToolRegistry,
  createToolExecutor,
  createOpenRouterConversationalProvider,
  AgentContext,
} from '../agents/conversational';

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY environment variable is required');
    process.exit(1);
  }

  console.log('🚀 Testing Conversational Agent (without tools)');
  console.log('=' .repeat(50));

  // Create provider
  const provider = createOpenRouterConversationalProvider({
    apiKey,
    model: 'anthropic/claude-sonnet-4',
  });

  // Create empty registry (no tools for this test)
  const registry = createToolRegistry();

  // Create executor
  const executor = createToolExecutor(registry);

  // Create agent
  const agent = new ConversationalAgent(provider, registry, executor);

  // Check if ready
  console.log('\n📋 Checking provider availability...');
  const isAvailable = await provider.isAvailable();
  console.log(`   Provider available: ${isAvailable ? '✅' : '❌'}`);

  if (!isAvailable) {
    console.error('❌ Provider is not available. Check your API key.');
    process.exit(1);
  }

  // Test context
  const context: AgentContext = {
    projectId: 'test-project',
    services: {},
    projectContext: {
      name: 'Test Project',
      description: 'A test project for the conversational agent',
      language: 'TypeScript',
      framework: 'NestJS',
    },
  };

  // Test 1: Simple greeting
  console.log('\n📝 Test 1: Simple greeting');
  console.log('-'.repeat(30));

  const response1 = await agent.processMessage(
    'Hello! Can you introduce yourself briefly?',
    [],
    context,
    {
      onDelta: (chunk) => process.stdout.write(chunk),
    },
    {
      maxIterations: 1,
      maxTokens: 256,
    }
  );

  console.log('\n');
  console.log(`   Success: ${response1.success ? '✅' : '❌'}`);
  console.log(`   Model: ${response1.model}`);
  console.log(`   Provider: ${response1.provider}`);
  console.log(`   Tokens: ${response1.usage.totalTokens}`);
  console.log(`   LLM calls: ${response1.usage.llmCalls}`);
  console.log(`   Tool calls: ${response1.usage.toolCalls}`);

  // Test 2: Question about capabilities
  console.log('\n📝 Test 2: Ask about capabilities');
  console.log('-'.repeat(30));

  const response2 = await agent.processMessage(
    'What tools do you have access to?',
    response1.newMessages, // Continue conversation
    context,
    {
      onDelta: (chunk) => process.stdout.write(chunk),
    },
    {
      maxIterations: 1,
      maxTokens: 512,
    }
  );

  console.log('\n');
  console.log(`   Success: ${response2.success ? '✅' : '❌'}`);
  console.log(`   Tokens: ${response2.usage.totalTokens}`);

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('✅ Conversational Agent test completed!');
  console.log(`   Total tokens used: ${response1.usage.totalTokens + response2.usage.totalTokens}`);
  if (response1.usage.totalCost || response2.usage.totalCost) {
    const totalCost = (response1.usage.totalCost || 0) + (response2.usage.totalCost || 0);
    console.log(`   Total cost: $${totalCost.toFixed(6)}`);
  }
}

main().catch(console.error);
