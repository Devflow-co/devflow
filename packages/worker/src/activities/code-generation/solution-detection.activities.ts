/**
 * Code Generation Activities - Solution Detection (V3)
 *
 * Detects multiple solutions when validation fails
 */

import { createLogger } from '@devflow/common';
import { createCodeAgentDriver, loadPrompts } from '@devflow/sdk';
import type { OllamaAgentConfig } from '@devflow/sdk';
import { trackLLMUsage, getOrganizationIdFromProject } from '../../utils/usage-tracking';
import { determineFailedPhase, extractErrorDetails } from './analyze-failures.activities';
import type {
  DetectSolutionsInput,
  DetectSolutionsOutput,
  SolutionOption,
} from './types';

const logger = createLogger('SolutionDetectionActivities');

/**
 * Detect multiple solutions when validation fails
 *
 * Analyzes validation failures to determine:
 * - If there's a single obvious fix
 * - If multiple valid solutions exist with trade-offs
 *
 * V3 Feature: enableSolutionChoice
 */
export async function detectMultipleSolutions(
  input: DetectSolutionsInput
): Promise<DetectSolutionsOutput> {
  logger.info('Detecting solution options for validation failure', {
    taskId: input.task.id,
    failedPhase: input.containerResult.failedPhase,
    attemptNumber: input.attemptNumber,
  });

  try {
    // Step 1: Build prompt variables
    const promptVariables = buildSolutionPromptVariables(input);

    // Step 2: Load prompts for solution detection
    const prompts = await loadPrompts('solution-detection', promptVariables);

    // Step 3: Create Ollama agent
    const ollamaConfig: OllamaAgentConfig = {
      provider: 'ollama',
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_CODE_MODEL || 'deepseek-coder:6.7b',
      timeout: parseInt(process.env.OLLAMA_TIMEOUT || '120000'),
      temperature: 0.3,
    };

    const agent = createCodeAgentDriver(ollamaConfig);

    // Step 4: Generate analysis
    const response = await agent.generate(prompts);

    // Step 5: Parse response
    const result = parseSolutionResponse(response.content, input.containerResult);

    // Step 6: Track usage
    const orgId = input.organizationId || await getOrganizationIdFromProject(input.projectId);
    if (orgId && input.workflowId) {
      await trackLLMUsage({
        organizationId: orgId,
        workflowId: input.workflowId,
        provider: 'ollama',
        model: ollamaConfig.model || 'deepseek-coder:6.7b',
        response,
        context: {
          taskId: input.task.id,
          projectId: input.projectId,
          phase: 'code_generation',
        },
      });
    }

    logger.info('Solution detection completed', {
      taskId: input.task.id,
      hasMultipleSolutions: result.hasMultipleSolutions,
      solutionCount: result.solutions?.length || (result.solution ? 1 : 0),
    });

    return result;
  } catch (error) {
    logger.error('Failed to detect solutions', error as Error);

    const failedPhase = determineFailedPhase(input.containerResult);
    return {
      hasMultipleSolutions: false,
      errorAnalysis: {
        phase: failedPhase,
        errorType: 'Unknown',
        file: 'unknown',
        message: 'Error analysis failed',
        rootCause: 'Could not analyze error automatically',
      },
      solution: {
        description: 'Retry with automatic fixes',
        changes: 'Attempt to fix based on error output',
        confidence: 'low',
      },
    };
  }
}

// ============================================
// Helper Functions
// ============================================

function buildSolutionPromptVariables(input: DetectSolutionsInput): Record<string, string> {
  const { task, generatedFiles, containerResult, technicalPlan } = input;
  const failedPhase = determineFailedPhase(containerResult);

  const failingFile = generatedFiles[0];
  const fileExtension = failingFile?.path.split('.').pop() || 'ts';

  const technicalPlanText = `
## Architecture
${technicalPlan.architecture?.join('\n') || 'Not specified'}

## Implementation Steps
${technicalPlan.implementationSteps?.join('\n') || 'Not specified'}
`;

  const generatedFilesSummary = generatedFiles
    .map(f => `- ${f.path} (${f.action})`)
    .join('\n');

  return {
    taskId: task.id,
    taskTitle: task.title,
    attemptNumber: String(input.attemptNumber),
    maxAttempts: String(input.maxAttempts),
    failedPhase,
    exitCode: String(containerResult.exitCode),
    containerLogs: containerResult.logs || containerResult.phases[failedPhase]?.output || 'No logs available',
    errorSummary: extractErrorDetails(containerResult, failedPhase),
    generatedFilesSummary,
    fileExtension,
    failingFileContent: failingFile?.content || 'No content',
    technicalPlan: technicalPlanText,
    codebaseContext: input.codebaseContext || 'No codebase context available',
  };
}

function parseSolutionResponse(
  content: string,
  containerResult: DetectSolutionsInput['containerResult']
): DetectSolutionsOutput {
  const failedPhase = determineFailedPhase(containerResult);

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

    const errorAnalysis = {
      phase: failedPhase,
      errorType: parsed.errorAnalysis?.errorType || 'Unknown',
      file: parsed.errorAnalysis?.file || 'unknown',
      line: parsed.errorAnalysis?.line,
      message: parsed.errorAnalysis?.message || 'No message',
      rootCause: parsed.errorAnalysis?.rootCause || 'Unknown cause',
    };

    if (parsed.hasMultipleSolutions) {
      return {
        hasMultipleSolutions: true,
        errorAnalysis,
        solutions: (parsed.solutions || []).map((s: any): SolutionOption => ({
          id: s.id || 'A',
          label: s.label || 'Solution',
          description: s.description || '',
          changes: s.changes || '',
          pros: s.pros || [],
          cons: s.cons || [],
          risk: s.risk || 'medium',
          recommended: s.recommended || false,
        })),
        recommendation: parsed.recommendation,
        recommendationReason: parsed.recommendationReason,
      };
    } else {
      return {
        hasMultipleSolutions: false,
        errorAnalysis,
        solution: {
          description: parsed.solution?.description || 'Apply automatic fix',
          changes: parsed.solution?.changes || 'Single fix required',
          confidence: parsed.solution?.confidence || 'medium',
        },
      };
    }
  } catch (error) {
    logger.warn('Failed to parse solution response as JSON', {
      error: (error as Error).message,
    });

    return {
      hasMultipleSolutions: false,
      errorAnalysis: {
        phase: failedPhase,
        errorType: 'Parse Error',
        file: 'unknown',
        message: 'Failed to parse AI response',
        rootCause: 'JSON parsing failed',
      },
      solution: {
        description: 'Retry with automatic fixes',
        changes: 'Attempt to fix based on error output',
        confidence: 'low',
      },
    };
  }
}
