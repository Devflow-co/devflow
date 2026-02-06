/**
 * Code Generation Activities - Failure Analysis
 *
 * Analyzes validation failures with AI and provides suggestions for retry
 */

import { createLogger } from '@devflow/common';
import type { GeneratedFile, ExecuteInContainerOutput, AnalyzeFailuresWithAIOutput, SuggestedFix } from '@devflow/common';
import { createCodeAgentDriver } from '@devflow/sdk';
import type { OllamaAgentConfig } from '@devflow/sdk';
import { trackLLMUsage, getOrganizationIdFromProject } from '../../utils/usage-tracking';
import type { AnalyzeFailuresActivityInput } from './types';

const logger = createLogger('AnalyzeFailuresActivities');

// ============================================
// System Prompt
// ============================================

const FAILURE_ANALYSIS_SYSTEM_PROMPT = `You are a code analysis expert. Analyze the following code generation failure and provide:
1. A clear analysis of what went wrong
2. Specific suggested fixes for each error
3. An enhanced prompt to help regenerate the code correctly

Respond in JSON format:
{
  "analysis": "Root cause analysis of the failure",
  "suggestedFixes": [
    { "file": "path/to/file.ts", "issue": "description", "suggestion": "how to fix" }
  ],
  "retryPromptEnhancement": "Additional context/instructions for regeneration",
  "confidence": "high" | "medium" | "low"
}

Be specific and actionable in your suggestions.`;

// ============================================
// Main Activity
// ============================================

/**
 * Analyze failures from container execution and provide suggestions for retry
 *
 * Uses Ollama (local LLM) to analyze:
 * 1. Which phase failed (lint, typecheck, or test)
 * 2. Root cause analysis from logs
 * 3. Suggested fixes for each error
 * 4. Enhanced prompt for retry generation
 */
export async function analyzeFailuresWithAI(
  input: AnalyzeFailuresActivityInput
): Promise<AnalyzeFailuresWithAIOutput> {
  logger.info('Analyzing failures with AI', {
    taskId: input.taskId,
    failedPhase: input.containerResult.failedPhase,
    previousAttempts: input.previousAttempts,
  });

  try {
    // Step 1: Determine which phase failed
    const failedPhase = determineFailedPhase(input.containerResult);

    // Step 2: Extract error details from logs
    const errorDetails = extractErrorDetails(input.containerResult, failedPhase);

    // Step 3: Build analysis prompt
    const analysisPrompt = buildAnalysisPrompt(
      input.generatedFiles,
      input.containerResult,
      failedPhase,
      errorDetails,
      input.previousAttempts
    );

    // Step 4: Create Ollama agent for analysis
    const ollamaConfig: OllamaAgentConfig = {
      provider: 'ollama',
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_CODE_MODEL || 'deepseek-coder:6.7b',
      timeout: parseInt(process.env.OLLAMA_TIMEOUT || '120000'),
      temperature: 0.2,
    };

    const agent = createCodeAgentDriver(ollamaConfig);

    // Step 5: Generate analysis
    const response = await agent.generate({
      system: FAILURE_ANALYSIS_SYSTEM_PROMPT,
      user: analysisPrompt,
    });

    // Step 6: Parse analysis response
    const analysis = parseAnalysisResponse(response.content, failedPhase);

    // Step 7: Track usage
    const orgId = input.organizationId || await getOrganizationIdFromProject(input.projectId);
    if (orgId && input.workflowId) {
      await trackLLMUsage({
        organizationId: orgId,
        workflowId: input.workflowId,
        provider: 'ollama',
        model: ollamaConfig.model || 'deepseek-coder:6.7b',
        response,
        context: {
          taskId: input.taskId,
          projectId: input.projectId,
          phase: 'code_generation',
        },
      });
    }

    logger.info('Failure analysis completed', {
      taskId: input.taskId,
      confidence: analysis.confidence,
      suggestedFixCount: analysis.suggestedFixes.length,
    });

    return analysis;
  } catch (error) {
    logger.error('Failed to analyze failures', error as Error);

    return {
      analysis: 'Failed to analyze errors automatically. Please review the logs manually.',
      failedPhase: input.containerResult.failedPhase as 'lint' | 'typecheck' | 'test' || 'test',
      suggestedFixes: [],
      retryPromptEnhancement: buildFallbackRetryPrompt(input.containerResult),
      confidence: 'low',
    };
  }
}

// ============================================
// Helper Functions
// ============================================

function determineFailedPhase(result: ExecuteInContainerOutput): 'lint' | 'typecheck' | 'test' {
  if (result.failedPhase) {
    if (result.failedPhase === 'lint' || result.failedPhase === 'typecheck' || result.failedPhase === 'test') {
      return result.failedPhase;
    }
  }

  if (result.phases.lint && !result.phases.lint.success) return 'lint';
  if (result.phases.typecheck && !result.phases.typecheck.success) return 'typecheck';
  if (result.phases.test && !result.phases.test.success) return 'test';

  return 'test';
}

function extractErrorDetails(
  result: ExecuteInContainerOutput,
  failedPhase: 'lint' | 'typecheck' | 'test'
): string {
  const phase = result.phases[failedPhase];
  if (!phase) return 'No error details available';

  let details = phase.output || '';

  const lines = details.split('\n');
  const errorLines = lines.filter(line =>
    line.includes('error') ||
    line.includes('Error') ||
    line.includes('ERR') ||
    line.includes('FAIL') ||
    line.includes('TypeError') ||
    line.includes('SyntaxError') ||
    line.includes('ReferenceError')
  );

  const limitedErrors = errorLines.slice(0, 50).join('\n');
  return limitedErrors || details.substring(0, 3000);
}

function buildAnalysisPrompt(
  files: GeneratedFile[],
  result: ExecuteInContainerOutput,
  failedPhase: 'lint' | 'typecheck' | 'test',
  errorDetails: string,
  previousAttempts: number
): string {
  const fileList = files.map(f => `- ${f.path} (${f.action})`).join('\n');

  return `## Code Generation Failure Analysis

### Failed Phase
${failedPhase}

### Previous Attempts
${previousAttempts} (this is attempt ${previousAttempts + 1})

### Generated Files
${fileList}

### Error Output
\`\`\`
${errorDetails}
\`\`\`

### Generated Code
${files.slice(0, 3).map(f => `
#### ${f.path}
\`\`\`${f.language || 'typescript'}
${f.content?.substring(0, 2000) || 'No content'}${f.content && f.content.length > 2000 ? '\n... (truncated)' : ''}
\`\`\`
`).join('\n')}

Please analyze the errors and provide suggestions for fixing the code.`;
}

function parseAnalysisResponse(
  content: string,
  defaultPhase: 'lint' | 'typecheck' | 'test'
): AnalyzeFailuresWithAIOutput {
  try {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    let jsonString = jsonMatch ? jsonMatch[1] : content;

    if (!jsonMatch) {
      const objectMatch = content.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonString = objectMatch[0];
      }
    }

    const parsed = JSON.parse(jsonString);

    return {
      analysis: parsed.analysis || 'Analysis not available',
      failedPhase: defaultPhase,
      suggestedFixes: (parsed.suggestedFixes || []).map((fix: any): SuggestedFix => ({
        file: fix.file || 'unknown',
        issue: fix.issue || 'Unknown issue',
        suggestion: fix.suggestion || 'No suggestion available',
      })),
      retryPromptEnhancement: parsed.retryPromptEnhancement || '',
      confidence: parsed.confidence || 'medium',
    };
  } catch (error) {
    logger.warn('Failed to parse analysis response as JSON', {
      error: (error as Error).message,
    });

    return {
      analysis: content.substring(0, 1000),
      failedPhase: defaultPhase,
      suggestedFixes: [],
      retryPromptEnhancement: `Previous attempt failed with ${defaultPhase} errors. Please ensure the code is syntactically correct and passes all validation.`,
      confidence: 'low',
    };
  }
}

function buildFallbackRetryPrompt(result: ExecuteInContainerOutput): string {
  const failedPhase = result.failedPhase || 'unknown';
  const output = result.phases[failedPhase as keyof typeof result.phases];

  return `
IMPORTANT: Previous code generation attempt failed during ${failedPhase}.

Errors encountered:
${output?.output?.substring(0, 1000) || 'See logs for details'}

Please regenerate the code ensuring:
1. All syntax is correct
2. All imports are valid
3. All types are properly defined
4. The code compiles without errors
5. Tests pass (if applicable)
`;
}

export { determineFailedPhase, extractErrorDetails };
