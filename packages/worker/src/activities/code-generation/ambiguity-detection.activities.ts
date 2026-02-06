/**
 * Code Generation Activities - Ambiguity Detection (V3)
 *
 * Detects ambiguities in technical plans before code generation
 */

import { createLogger } from '@devflow/common';
import { createCodeAgentDriver, loadPrompts } from '@devflow/sdk';
import type { OllamaAgentConfig } from '@devflow/sdk';
import { trackLLMUsage, getOrganizationIdFromProject } from '../../utils/usage-tracking';
import type {
  DetectAmbiguityInput,
  DetectAmbiguityOutput,
  DetectedAmbiguity,
  AmbiguityOption,
} from './types';

const logger = createLogger('AmbiguityDetectionActivities');

/**
 * Detect ambiguities in the technical plan before code generation
 *
 * Analyzes the technical plan and codebase context to identify:
 * - Architectural decisions that could be implemented multiple ways
 * - Missing specifications that need clarification
 * - Conflicting patterns in the existing codebase
 *
 * V3 Feature: enableAmbiguityDetection
 */
export async function detectAmbiguityBeforeGeneration(
  input: DetectAmbiguityInput
): Promise<DetectAmbiguityOutput> {
  logger.info('Detecting ambiguities before code generation', {
    taskId: input.task.id,
    taskTitle: input.task.title,
    projectId: input.projectId,
  });

  try {
    // Step 1: Build prompt variables
    const promptVariables = buildAmbiguityPromptVariables(input);

    // Step 2: Load prompts for ambiguity detection
    const prompts = await loadPrompts('ambiguity-detection', promptVariables);

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
    const result = parseAmbiguityResponse(response.content);

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

    logger.info('Ambiguity detection completed', {
      taskId: input.task.id,
      hasAmbiguities: result.hasAmbiguities,
      ambiguityCount: result.ambiguities.length,
      confidence: result.confidence,
    });

    return result;
  } catch (error) {
    logger.error('Failed to detect ambiguities', error as Error);

    return {
      hasAmbiguities: false,
      confidence: 'low',
      analysis: 'Failed to analyze ambiguities. Proceeding with code generation.',
      ambiguities: [],
    };
  }
}

// ============================================
// Helper Functions
// ============================================

function buildAmbiguityPromptVariables(input: DetectAmbiguityInput): Record<string, string> {
  const { task, technicalPlan } = input;

  const technicalPlanText = `
## Architecture Decisions
${technicalPlan.architecture?.map((a, i) => `${i + 1}. ${a}`).join('\n') || 'Not specified'}

## Implementation Steps
${technicalPlan.implementationSteps?.map((s, i) => `${i + 1}. ${s}`).join('\n') || 'Not specified'}

## Files Affected
${technicalPlan.filesAffected?.map(f => `- ${f}`).join('\n') || 'Not specified'}

## Testing Strategy
${technicalPlan.testingStrategy || 'Not specified'}

## Risks
${technicalPlan.risks?.map((r, i) => `${i + 1}. ${r}`).join('\n') || 'None identified'}
`;

  return {
    taskId: task.id,
    taskTitle: task.title,
    taskDescription: task.description || 'No description provided',
    technicalPlan: technicalPlanText,
    codebaseContext: input.codebaseContext || 'No codebase context available',
    documentationContext: input.documentationContext || 'No documentation context available',
  };
}

function parseAmbiguityResponse(content: string): DetectAmbiguityOutput {
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
      hasAmbiguities: parsed.hasAmbiguities || false,
      confidence: parsed.confidence || 'medium',
      analysis: parsed.analysis || 'Analysis not available',
      ambiguities: (parsed.ambiguities || []).map((a: any): DetectedAmbiguity => ({
        id: a.id || 'A',
        type: a.type || 'architectural',
        title: a.title || 'Untitled ambiguity',
        description: a.description || 'No description',
        impact: a.impact || 'medium',
        options: (a.options || []).map((o: any): AmbiguityOption => ({
          id: o.id || '1',
          label: o.label || 'Option',
          description: o.description || '',
          pros: o.pros || [],
          cons: o.cons || [],
          recommended: o.recommended || false,
        })),
      })),
    };
  } catch (error) {
    logger.warn('Failed to parse ambiguity response as JSON', {
      error: (error as Error).message,
    });

    return {
      hasAmbiguities: false,
      confidence: 'low',
      analysis: 'Failed to parse analysis response',
      ambiguities: [],
    };
  }
}
