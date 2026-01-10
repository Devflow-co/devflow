/**
 * Ollama Code Agent Provider - Local LLM inference (privacy-first, no cloud fallback)
 *
 * Supports models:
 * - Code generation: deepseek-coder:6.7b, codellama:13b, qwen2.5-coder:7b
 * - Embeddings: nomic-embed-text, mxbai-embed-large
 */

import axios, { AxiosInstance } from 'axios';
import {
  AgentPrompt,
  AgentResponse,
  SpecGenerationInput,
  SpecGenerationOutput,
  CodeGenerationInput,
  CodeGenerationOutput,
  FixGenerationInput,
  FixGenerationOutput,
  createLogger,
} from '@devflow/common';

import {
  CodeAgentDriver,
  TestGenerationInput,
  TestGenerationOutput,
  TestFailureAnalysisInput,
  TestFixOutput,
} from '@/agents/agent.interface';

// ============================================
// Configuration
// ============================================

export interface OllamaConfig {
  /** Ollama server URL (default: http://localhost:11434) */
  baseUrl: string;
  /** Model to use for code generation */
  model: string;
  /** Request timeout in ms (default: 300000 = 5 minutes) */
  timeout?: number;
  /** Keep model in memory duration (default: "5m") */
  keepAlive?: string;
  /** Context window size (default: 8192) */
  numCtx?: number;
  /** Temperature for generation (default: 0.1 for code) */
  temperature?: number;
}

/** Model recommendations for different tasks */
export const OLLAMA_MODEL_RECOMMENDATIONS = {
  codeGeneration: [
    'deepseek-coder:6.7b', // Best balance of quality/speed
    'deepseek-coder:33b', // Higher quality, slower
    'codellama:13b', // Meta's code model
    'qwen2.5-coder:7b', // Alibaba's code model
  ],
  embeddings: [
    'nomic-embed-text', // 768 dimensions, good for code
    'mxbai-embed-large', // 1024 dimensions, higher quality
  ],
  fast: [
    'deepseek-coder:1.3b', // Fast for simple tasks
    'codellama:7b', // Lightweight option
  ],
};

// ============================================
// Provider Implementation
// ============================================

export class OllamaProvider implements CodeAgentDriver {
  private client: AxiosInstance;
  private model: string;
  private config: Required<OllamaConfig>;
  private logger = createLogger('OllamaProvider');

  constructor(config: OllamaConfig) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:11434',
      model: config.model || 'deepseek-coder:6.7b',
      timeout: config.timeout || 300000, // 5 minutes for local inference
      keepAlive: config.keepAlive || '5m',
      numCtx: config.numCtx || 8192,
      temperature: config.temperature ?? 0.1,
    };

    this.model = this.config.model;

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.logger.info('Ollama Provider initialized (privacy-first, no cloud fallback)', {
      baseUrl: this.config.baseUrl,
      model: this.model,
      timeout: this.config.timeout,
      numCtx: this.config.numCtx,
    });
  }

  // ============================================
  // Core Generation Method
  // ============================================

  async generate(prompt: AgentPrompt): Promise<AgentResponse> {
    this.logger.info('Generating response via Ollama (local)', {
      model: this.model,
      hasImages: !!prompt.images?.length,
    });

    const startTime = Date.now();

    // Ollama uses /api/chat for chat-style interactions
    // Combine system and user prompts
    const response = await this.client.post('/api/chat', {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: prompt.system,
        },
        {
          role: 'user',
          content: prompt.user,
        },
      ],
      stream: false,
      options: {
        temperature: this.config.temperature,
        num_ctx: this.config.numCtx,
      },
      keep_alive: this.config.keepAlive,
    });

    const latencyMs = Date.now() - startTime;
    const data = response.data;

    // Ollama returns token counts in response
    const inputTokens = data.prompt_eval_count || this.estimateTokens(prompt.system + prompt.user);
    const outputTokens = data.eval_count || this.estimateTokens(data.message?.content || '');

    this.logger.debug('Ollama response received', {
      latencyMs,
      promptEvalCount: data.prompt_eval_count,
      evalCount: data.eval_count,
      model: data.model,
    });

    return {
      content: data.message?.content || '',
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        // Ollama is free (local), no cost
        totalCost: 0,
        inputCost: 0,
        outputCost: 0,
        latencyMs,
        cached: false,
      },
      model: data.model || this.model,
      finishReason: data.done ? 'stop' : 'length',
    };
  }

  // ============================================
  // Spec Generation
  // ============================================

  async generateSpec(input: SpecGenerationInput): Promise<SpecGenerationOutput> {
    this.logger.info('Generating spec via Ollama', { task: input.task.title });

    // Build dependencies context
    const depsContext = input.project.dependencies?.length
      ? `\nMain Dependencies:\n${input.project.dependencies.slice(0, 10).map((d) => `- ${d}`).join('\n')}`
      : '';

    // Build conventions context
    const conventionsContext = input.project.conventions?.length
      ? `\nCoding Conventions:\n${input.project.conventions.map((c) => `- ${c}`).join('\n')}`
      : '';

    // Build patterns context
    const patternsContext = input.project.patterns?.length
      ? `\nExisting Patterns:\n${input.project.patterns.map((p) => `- ${p}`).join('\n')}`
      : '';

    // Build codebase context (if provided)
    const codebaseContext = (input as any).codebaseContext
      ? `\n\n## Codebase Context\n\n${(input as any).codebaseContext}`
      : '';

    const prompt: AgentPrompt = {
      system: `You are a senior software architect. Generate detailed technical specifications for development tasks.

IMPORTANT: Your specification MUST follow the existing codebase patterns, conventions, and architecture.
- Analyze the provided codebase context carefully
- Match the existing code style and patterns
- Use the same dependencies and libraries already in the project
- Follow the established naming conventions
- Respect the existing file structure

Return your response as valid JSON with the following structure:
{
  "architecture": ["decision 1", "decision 2"],
  "implementationSteps": ["step 1", "step 2"],
  "testingStrategy": "strategy description",
  "risks": ["risk 1", "risk 2"],
  "estimatedTime": 120,
  "dependencies": ["dep 1"],
  "technicalDecisions": ["decision 1"]
}`,
      user: `Generate a technical specification for this task:

Title: ${input.task.title}
Description: ${input.task.description || 'No description provided'}
Priority: ${input.task.priority}

## Project Context

**Language:** ${input.project.language}
**Framework:** ${input.project.framework || 'Not specified'}
${depsContext}
${conventionsContext}
${patternsContext}
${codebaseContext}

## Requirements

Based on the existing codebase context above:
1. Provide detailed architecture decisions that MATCH the existing patterns
2. Create implementation steps that follow the project's conventions
3. Suggest a testing strategy aligned with the project's test structure
4. Identify potential risks specific to this codebase
5. Reference existing files and patterns when relevant

Generate a specification that will seamlessly integrate with the existing codebase.`,
    };

    const response = await this.generate(prompt);
    return this.parseJSONResponse(response.content);
  }

  // ============================================
  // Code Generation
  // ============================================

  async generateCode(input: CodeGenerationInput): Promise<CodeGenerationOutput> {
    this.logger.info('Generating code via Ollama', { task: input.task.title });

    const relevantFilesContext = input.relevantFiles
      .map((f) => `File: ${f.path}\n${f.content}`)
      .join('\n\n');

    const prompt: AgentPrompt = {
      system: `You are an expert software developer. Generate production-ready code based on specifications.

IMPORTANT: Generate complete, working code with no placeholders or TODOs.
- Follow the existing codebase patterns exactly
- Include all necessary imports
- Add proper error handling
- Ensure code is fully typed (TypeScript)

Return your response as valid JSON with the following structure:
{
  "files": [
    {
      "path": "src/file.ts",
      "action": "create",
      "content": "file content",
      "reason": "why this change"
    }
  ],
  "commitMessage": "feat: add feature",
  "prDescription": "PR description"
}`,
      user: `Implement this specification:

Task: ${input.task.title}
Description: ${input.task.description}

Specification:
${JSON.stringify(input.spec, null, 2)}

Project Structure:
${input.projectStructure}

Relevant Files:
${relevantFilesContext}

Generate clean, typed, production-ready code with proper error handling.`,
    };

    const response = await this.generate(prompt);
    return this.parseJSONResponse(response.content);
  }

  // ============================================
  // Fix Generation
  // ============================================

  async generateFix(input: FixGenerationInput): Promise<FixGenerationOutput> {
    this.logger.info('Generating fix via Ollama', { previousAttempts: input.previousAttempts });

    const filesContext = input.files.map((f) => `File: ${f.path}\n${f.content}`).join('\n\n');

    const failuresContext = input.testFailures
      ?.map((f) => `Test: ${f.name}\nError: ${f.message}\n${f.stackTrace || ''}`)
      .join('\n\n');

    const prompt: AgentPrompt = {
      system: `You are an expert debugger. Analyze errors and generate fixes.
Return your response as valid JSON with the following structure:
{
  "files": [
    {
      "path": "src/file.ts",
      "content": "fixed content",
      "reason": "what was fixed"
    }
  ],
  "analysis": "root cause analysis",
  "commitMessage": "fix: description"
}`,
      user: `Fix these errors:

Error Logs:
${input.errorLogs}

Test Failures:
${failuresContext || 'N/A'}

Affected Files:
${filesContext}

Previous Fix Attempts: ${input.previousAttempts || 0}

Analyze the root cause and provide a fix.`,
    };

    const response = await this.generate(prompt);
    return this.parseJSONResponse(response.content);
  }

  // ============================================
  // Test Generation
  // ============================================

  async generateTests(input: TestGenerationInput): Promise<TestGenerationOutput> {
    this.logger.info('Generating tests via Ollama', {
      task: input.task.title,
      testTypes: input.testTypes,
    });

    const implementationContext = input.implementation.files
      .map((f) => `File: ${f.path}\n${f.content}`)
      .join('\n\n');

    const acContext = input.task.acceptanceCriteria
      .map((ac, i) => `${i + 1}. ${ac}`)
      .join('\n');

    const prompt: AgentPrompt = {
      system: `You are a QA engineer specialized in test generation. Generate comprehensive tests based on acceptance criteria and implementation.
Return your response as valid JSON with the following structure:
{
  "tests": [
    {
      "type": "unit",
      "path": "tests/unit/file.spec.ts",
      "content": "test code",
      "description": "what this test covers",
      "coverageTarget": ["functionName", "className"]
    }
  ],
  "summary": {
    "totalTests": 5,
    "byType": {"unit": 3, "integration": 2},
    "estimatedCoverage": 85
  }
}`,
      user: `Generate ${input.testTypes.join(', ')} tests for this implementation:

Task: ${input.task.title}
Description: ${input.task.description}

Acceptance Criteria:
${acContext}

Implementation:
${implementationContext}

Project Context:
- Language: ${input.project.language}
- Framework: ${input.project.framework || 'N/A'}
- Test Framework: ${input.project.testFramework || 'jest'}

Generate:
1. Tests covering all acceptance criteria
2. Edge cases and error scenarios
3. Clear test descriptions
4. Proper test structure and assertions

Test Types Requested: ${input.testTypes.join(', ')}`,
    };

    const response = await this.generate(prompt);
    return this.parseJSONResponse(response.content);
  }

  // ============================================
  // Test Failure Analysis
  // ============================================

  async analyzeTestFailures(input: TestFailureAnalysisInput): Promise<TestFixOutput> {
    this.logger.info('Analyzing test failures via Ollama', {
      failureCount: input.failures.length,
      previousAttempts: input.previousAttempts,
    });

    const failuresContext = input.failures
      .map(
        (f) => `
Test: ${f.testName}
File: ${f.testPath}
Error: ${f.error}
Stack Trace:
${f.stackTrace || 'N/A'}
`,
      )
      .join('\n---\n');

    const implContext = input.implementationFiles
      .map((f) => `File: ${f.path}\n${f.content}`)
      .join('\n\n');

    const testContext = input.testFiles
      .map((f) => `File: ${f.path}\n${f.content}`)
      .join('\n\n');

    const prompt: AgentPrompt = {
      system: `You are a QA engineer specialized in debugging test failures. Analyze failures and determine the best fix strategy.
Return your response as valid JSON with the following structure:
{
  "fixStrategy": "fix_implementation" | "fix_tests" | "both",
  "implementationFixes": [
    {
      "path": "src/file.ts",
      "content": "fixed content",
      "reason": "explanation"
    }
  ],
  "testFixes": [
    {
      "path": "tests/file.spec.ts",
      "content": "fixed content",
      "reason": "explanation"
    }
  ],
  "analysis": "detailed root cause analysis",
  "confidence": "high" | "medium" | "low"
}`,
      user: `Analyze these test failures and provide fixes:

Test Failures (${input.failures.length}):
${failuresContext}

Implementation Code:
${implContext}

Test Code:
${testContext}

Previous Fix Attempts: ${input.previousAttempts || 0}

Determine:
1. Root cause of failures
2. Whether implementation or tests need fixing
3. Provide corrected code
4. Confidence level in the fix`,
    };

    const response = await this.generate(prompt);
    return this.parseJSONResponse(response.content);
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Estimate token count (approximation: ~4 chars per token)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Parse JSON from AI response with multiple fallback strategies
   */
  private parseJSONResponse<T>(content: string): T {
    // Try direct parse first
    try {
      return JSON.parse(content);
    } catch {
      // Not direct JSON, continue to other methods
    }

    // Try extracting from markdown code block
    const jsonCodeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonCodeBlockMatch) {
      try {
        return JSON.parse(jsonCodeBlockMatch[1].trim());
      } catch {
        // Not valid JSON in code block, continue
      }
    }

    // Try finding raw JSON object in the content
    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // Found something that looks like JSON but isn't valid
      }
    }

    this.logger.error('Failed to parse JSON response from Ollama', new Error('No valid JSON found'), {
      contentPreview: content.substring(0, 200),
    });
    throw new Error('No valid JSON found in Ollama response');
  }

  // ============================================
  // Health Check
  // ============================================

  /**
   * Check if Ollama is healthy and model is available
   */
  async healthCheck(): Promise<{ healthy: boolean; model: string; error?: string }> {
    try {
      const response = await this.client.get('/api/tags');
      const models = response.data.models || [];
      const modelAvailable = models.some((m: any) =>
        m.name.startsWith(this.model.split(':')[0]),
      );

      return {
        healthy: true,
        model: this.model,
        error: modelAvailable ? undefined : `Model ${this.model} not found. Run: ollama pull ${this.model}`,
      };
    } catch (error) {
      return {
        healthy: false,
        model: this.model,
        error: `Ollama not reachable at ${this.config.baseUrl}: ${(error as Error).message}`,
      };
    }
  }
}
