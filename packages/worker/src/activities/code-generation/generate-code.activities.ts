/**
 * Code Generation Activities - Main Generation
 *
 * Generates production-ready code from technical specifications using local LLM (Ollama).
 * Focus: Code implementation, privacy-first (no cloud fallback)
 */

import { createLogger, extractAIMetrics } from '@devflow/common';
import type { GeneratedFile, CodeGenerationFromPlanOutput, StepResultSummary } from '@devflow/common';
import { createCodeAgentDriver, loadPrompts } from '@devflow/sdk';
import type { OllamaAgentConfig } from '@devflow/sdk';
import { trackLLMUsage, getOrganizationIdFromProject } from '../../utils/usage-tracking';
import {
  validateFilePath,
  validateBranchName,
  sanitizeCommitMessage,
  validateFileContent,
  budgetTokensAcrossSections,
  MAX_FILE_SIZE_BYTES,
} from '../../utils/validation';
import type { GenerateCodeFromPlanInput, GenerateCodeFromPlanOutput } from './types';

const logger = createLogger('GenerateCodeActivities');

// ============================================
// Constants
// ============================================

/** Maximum tokens for Ollama context window (default 8192, use 85% to leave room for output) */
const OLLAMA_CONTEXT_BUDGET = Math.floor(8192 * 0.85);

/** Token budget allocation for different context sections */
const TOKEN_BUDGET_ALLOCATION = {
  systemPrompt: 500,
  technicalPlan: 1000,
  ragContext: 2500,
  fullFiles: 2500,
  taskContext: 500,
};

/** Circuit breaker state for Ollama failures */
let ollamaConsecutiveFailures = 0;
const OLLAMA_CIRCUIT_BREAKER_THRESHOLD = 3;

// ============================================
// Main Activity
// ============================================

/**
 * Generate code implementation from technical plan using Ollama (local LLM)
 *
 * Privacy-first: All inference runs locally, no cloud fallback
 */
export async function generateCodeFromPlan(
  input: GenerateCodeFromPlanInput
): Promise<GenerateCodeFromPlanOutput> {
  logger.info('Generating code from technical plan (Ollama - local LLM)', {
    taskTitle: input.task.title,
    projectId: input.projectId,
    hasRAGContext: !!input.ragContext,
    taskId: input.taskId,
  });

  // Circuit breaker check
  if (ollamaConsecutiveFailures >= OLLAMA_CIRCUIT_BREAKER_THRESHOLD) {
    const circuitBreakerError = new Error(
      `Ollama circuit breaker open: ${ollamaConsecutiveFailures} consecutive failures. ` +
      `Please check Ollama service availability and restart the workflow.`
    );
    logger.error('Circuit breaker open - Ollama unavailable after consecutive failures', circuitBreakerError, {
      consecutiveFailures: ollamaConsecutiveFailures,
      threshold: OLLAMA_CIRCUIT_BREAKER_THRESHOLD,
    });
    throw circuitBreakerError;
  }

  try {
    // Step 1: Build codebase context from RAG chunks with token budgeting
    const codebaseContext = buildCodebaseContextWithBudget(
      input.ragContext,
      TOKEN_BUDGET_ALLOCATION.ragContext
    );

    // Step 1b: Build full files context with token budgeting
    const fullFilesContext = buildFullFilesContextWithBudget(
      input.fullFileContents,
      TOKEN_BUDGET_ALLOCATION.fullFiles
    );

    // Step 2: Build prompt variables
    const promptVariables = buildPromptVariables(input, codebaseContext, fullFilesContext);

    // Step 3: Load prompts for code generation
    const prompts = await loadPrompts('code-generation', promptVariables);

    // Step 4: Create Ollama agent (local LLM - no cloud fallback)
    const ollamaConfig: OllamaAgentConfig = {
      provider: 'ollama',
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      model: input.aiModel || process.env.OLLAMA_CODE_MODEL || 'deepseek-coder:6.7b',
      timeout: parseInt(process.env.OLLAMA_TIMEOUT || '300000'),
      temperature: 0.1,
    };

    logger.info('Using Ollama for code generation', {
      baseUrl: ollamaConfig.baseUrl,
      model: ollamaConfig.model,
    });

    const agent = createCodeAgentDriver(ollamaConfig);

    // Step 5: Generate code
    const response = await agent.generate(prompts);

    // Step 6: Parse the response with validation
    const codeOutput = parseCodeGenerationResponse(response.content, input.task.identifier);

    // Step 7: Extract AI metrics
    const aiMetrics = extractAIMetrics(response, 'ollama');

    // Step 8: Build result summary
    const resultSummary: StepResultSummary = {
      type: 'code_generation',
      summary: `Generated ${codeOutput.files.length} files: ${codeOutput.files.map(f => f.path).join(', ')}`,
      itemsCount: codeOutput.files.length,
      wordCount: response.content.split(/\s+/).length,
    };

    // Step 9: Track LLM usage
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

    // Reset circuit breaker on success
    ollamaConsecutiveFailures = 0;

    logger.info('Code generation completed successfully', {
      filesGenerated: codeOutput.files.length,
      branchName: codeOutput.branchName,
      model: ollamaConfig.model,
      latencyMs: aiMetrics.latencyMs,
    });

    return {
      code: codeOutput,
      aiMetrics,
      resultSummary,
    };
  } catch (error) {
    ollamaConsecutiveFailures++;
    logger.error('Failed to generate code from plan', error as Error, {
      consecutiveFailures: ollamaConsecutiveFailures,
    });
    throw error;
  }
}

/**
 * Reset the circuit breaker (for recovery scenarios)
 */
export function resetCircuitBreaker(): void {
  ollamaConsecutiveFailures = 0;
  logger.info('Circuit breaker reset');
}

/**
 * Get current circuit breaker state
 */
export function getCircuitBreakerState(): { failures: number; isOpen: boolean } {
  return {
    failures: ollamaConsecutiveFailures,
    isOpen: ollamaConsecutiveFailures >= OLLAMA_CIRCUIT_BREAKER_THRESHOLD,
  };
}

// ============================================
// Helper Functions
// ============================================

function buildCodebaseContextWithBudget(
  ragContext?: GenerateCodeFromPlanInput['ragContext'],
  tokenBudget: number = TOKEN_BUDGET_ALLOCATION.ragContext
): string {
  if (!ragContext || ragContext.chunks.length === 0) {
    return 'No codebase context available.';
  }

  const sortedChunks = [...ragContext.chunks].sort((a, b) => b.score - a.score);

  const sections = sortedChunks.map((chunk, index) => ({
    id: chunk.filePath,
    content: `### File: ${chunk.filePath} (${chunk.language}, relevance: ${(chunk.score * 100).toFixed(0)}%)\n\n\`\`\`${chunk.language}\n${chunk.content}\n\`\`\``,
    priority: index,
    minTokens: 100,
  }));

  const budgeted = budgetTokensAcrossSections(sections, tokenBudget);
  const includedChunks = budgeted.filter(b => b.allocatedTokens > 0);
  const excludedCount = budgeted.filter(b => b.allocatedTokens === 0).length;

  if (includedChunks.length === 0) {
    return 'No codebase context available (token budget exceeded).';
  }

  let result = includedChunks.map(b => b.content).join('\n\n');
  if (excludedCount > 0) {
    result += `\n\n_Note: ${excludedCount} additional context chunks excluded due to token budget._`;
  }

  return result;
}

function buildFullFilesContextWithBudget(
  fullFileContents?: GenerateCodeFromPlanInput['fullFileContents'],
  tokenBudget: number = TOKEN_BUDGET_ALLOCATION.fullFiles
): string {
  if (!fullFileContents || fullFileContents.length === 0) {
    return 'No full file contents available.';
  }

  const sections = fullFileContents.map((file, index) => {
    const language = detectLanguage(file.path);
    const lineCount = file.content.split('\n').length;
    return {
      id: file.path,
      content: `### ${file.path} (${lineCount} lines)\n\n\`\`\`${language}\n${file.content}\n\`\`\``,
      priority: index,
      minTokens: 200,
    };
  });

  const budgeted = budgetTokensAcrossSections(sections, tokenBudget);
  const includedFiles = budgeted.filter(b => b.allocatedTokens > 0);
  const excludedCount = budgeted.filter(b => b.allocatedTokens === 0).length;

  if (includedFiles.length === 0) {
    return 'No full file contents available (token budget exceeded).';
  }

  let result = includedFiles.map(b => b.content).join('\n\n');
  if (excludedCount > 0) {
    result += `\n\n_Note: ${excludedCount} additional files excluded due to token budget._`;
  }

  return result;
}

function buildPromptVariables(
  input: GenerateCodeFromPlanInput,
  codebaseContext: string,
  fullFilesContext: string
): Record<string, string> {
  const { task, technicalPlan, userStory, project } = input;

  const architectureDecisions = technicalPlan.architecture
    ?.map((a, i) => `${i + 1}. ${a}`)
    .join('\n') || 'No architecture decisions specified';

  const implementationSteps = technicalPlan.implementationSteps
    ?.map((s, i) => `${i + 1}. ${s}`)
    .join('\n') || 'No implementation steps specified';

  const risks = technicalPlan.risks
    ?.map((r, i) => `${i + 1}. ${r}`)
    .join('\n') || 'No risks identified';

  const filesAffected = technicalPlan.filesAffected
    ?.map((f) => `- ${f}`)
    .join('\n') || 'Files to be determined';

  const acceptanceCriteria = userStory?.acceptanceCriteria
    ?.map((c, i) => `${i + 1}. ${c}`)
    .join('\n') || 'No acceptance criteria specified';

  const branchSuffix = task.title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 40);

  return {
    taskTitle: task.title,
    taskDescription: task.description || 'No description provided',
    taskIdentifier: task.identifier,
    architectureDecisions,
    implementationSteps,
    testingStrategy: technicalPlan.testingStrategy || 'No testing strategy specified',
    risks,
    filesAffected,
    userStoryActor: userStory?.userStory?.actor || 'user',
    userStoryGoal: userStory?.userStory?.goal || task.title,
    userStoryBenefit: userStory?.userStory?.benefit || 'improved functionality',
    acceptanceCriteria,
    projectLanguage: project?.language || 'TypeScript',
    projectFramework: project?.framework || 'Not specified',
    projectTestFramework: project?.testFramework || 'jest',
    codebaseContext,
    fullFilesContext,
    branchSuffix,
  };
}

function parseCodeGenerationResponse(
  content: string,
  taskIdentifier: string
): CodeGenerationFromPlanOutput {
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

    // Validate and normalize files with security checks
    const validatedFiles: GeneratedFile[] = [];
    const rejectedFiles: Array<{ path: string; reason: string }> = [];

    for (const f of parsed.files || []) {
      const pathValidation = validateFilePath(f.path);
      if (!pathValidation.valid) {
        rejectedFiles.push({ path: f.path, reason: pathValidation.error || 'Invalid path' });
        continue;
      }

      const contentValidation = validateFileContent(f.content || '', MAX_FILE_SIZE_BYTES);

      validatedFiles.push({
        path: pathValidation.normalizedPath,
        content: contentValidation.content,
        action: f.action || 'create',
        language: f.language || detectLanguage(pathValidation.normalizedPath),
        reason: f.reason,
      });
    }

    if (rejectedFiles.length > 0) {
      logger.warn('Some generated files were rejected', {
        accepted: validatedFiles.length,
        rejected: rejectedFiles.length,
      });
    }

    if (validatedFiles.length === 0 && (parsed.files || []).length > 0) {
      throw new Error(`All generated files were rejected due to security validation`);
    }

    // Validate branch name
    const rawBranchName = parsed.branchName || `feat/${taskIdentifier.toLowerCase()}`;
    const branchValidation = validateBranchName(rawBranchName);
    const branchName = branchValidation.valid
      ? branchValidation.sanitizedName
      : `feat/${taskIdentifier.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    // Sanitize commit message
    const commitMessage = sanitizeCommitMessage(
      parsed.commitMessage || `feat: implement ${taskIdentifier}`
    );

    const prTitle = sanitizeCommitMessage(parsed.prTitle || `feat: ${taskIdentifier}`).split('\n')[0];
    const prDescription = parsed.prDescription || generateDefaultPRDescription(validatedFiles, taskIdentifier);

    const estimatedChanges = {
      additions: validatedFiles.reduce((sum, f) => sum + (f.content?.split('\n').length || 0), 0),
      deletions: 0,
      filesChanged: validatedFiles.length,
    };

    return {
      files: validatedFiles,
      commitMessage,
      branchName,
      prTitle,
      prDescription,
      estimatedChanges,
    };
  } catch (error) {
    logger.error('Failed to parse code generation response', error as Error, {
      contentPreview: content.substring(0, 500),
    });
    throw new Error(
      `Failed to parse code generation JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin',
    rb: 'ruby', php: 'php', cs: 'csharp', cpp: 'cpp', c: 'c', h: 'c', hpp: 'cpp',
    md: 'markdown', json: 'json', yaml: 'yaml', yml: 'yaml', sql: 'sql',
    sh: 'bash', css: 'css', scss: 'scss', html: 'html',
  };
  return languageMap[ext || ''] || 'text';
}

function generateDefaultPRDescription(files: GeneratedFile[], taskIdentifier: string): string {
  const filesList = files.map((f) => `- \`${f.path}\` (${f.action})`).join('\n');

  return `## Summary

Implementation for ${taskIdentifier}.

## Changes

${filesList}

## Test Plan

- [ ] Code compiles without errors
- [ ] Manual testing of implemented functionality
- [ ] Code review approved

---

*Generated with DevFlow Phase 4 (Code Generation)*

Linear: ${taskIdentifier}`;
}
