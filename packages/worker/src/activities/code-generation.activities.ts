/**
 * Code Generation Activities - Phase 4 of Four-Phase Agile Workflow
 *
 * Generates production-ready code from technical specifications using local LLM (Ollama).
 * Focus: Code implementation, PR creation, privacy-first (no cloud fallback)
 */

import { createLogger, extractAIMetrics } from '@devflow/common';
import type {
  TechnicalPlanGenerationOutput,
  UserStoryGenerationOutput,
  StepAIMetrics,
  StepResultSummary,
  CodeGenerationFromPlanInput,
  CodeGenerationFromPlanOutput,
  GeneratedFile,
  AnalyzeFailuresWithAIInput,
  AnalyzeFailuresWithAIOutput,
  ExecuteInContainerOutput,
  SuggestedFix,
} from '@devflow/common';
import { createCodeAgentDriver, loadPrompts, GitHubProvider } from '@devflow/sdk';
import type { OllamaAgentConfig } from '@devflow/sdk';
import { trackLLMUsage, getOrganizationIdFromProject } from '../utils/usage-tracking';
import { getProjectRepositoryConfig } from './codebase.activities';
import { oauthResolver } from '@/services/oauth-context';

const logger = createLogger('CodeGenerationActivities');

// ============================================
// Input/Output Types
// ============================================

export interface GenerateCodeFromPlanInput {
  /** Task information */
  task: {
    id: string;
    linearId: string;
    title: string;
    description: string;
    identifier: string;
  };

  /** Technical plan from Phase 3 */
  technicalPlan: TechnicalPlanGenerationOutput;

  /** User story from Phase 2 (optional) */
  userStory?: UserStoryGenerationOutput;

  /** Project configuration */
  projectId: string;

  /** Task ID for usage tracking aggregation */
  taskId?: string;

  /** Organization ID for usage tracking (will be looked up if not provided) */
  organizationId?: string;

  /** Workflow ID for usage tracking */
  workflowId?: string;

  /** RAG context from codebase */
  ragContext?: {
    chunks: Array<{
      filePath: string;
      content: string;
      score: number;
      language: string;
    }>;
  };

  /** Full file contents for files to be modified (fetched from GitHub) */
  fullFileContents?: Array<{
    path: string;
    content: string;
  }>;

  /** Project metadata */
  project?: {
    language: string;
    framework?: string;
    testFramework?: string;
    repositoryUrl?: string;
    defaultBranch?: string;
  };

  /** AI model to use (defaults to Ollama) */
  aiModel?: string;
}

export interface GenerateCodeFromPlanOutput {
  /** Generated code output */
  code: CodeGenerationFromPlanOutput;

  /** AI metrics for workflow step logging */
  aiMetrics?: StepAIMetrics;

  /** Result summary for workflow step logging */
  resultSummary?: StepResultSummary;
}

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

  try {
    // Step 1: Build codebase context from RAG chunks
    const codebaseContext = buildCodebaseContext(input.ragContext);

    // Step 1b: Build full files context (from GitHub - provides complete file contents)
    const fullFilesContext = buildFullFilesContext(input.fullFileContents);

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
      temperature: 0.1, // Low temperature for code generation
    };

    logger.info('Using Ollama for code generation', {
      baseUrl: ollamaConfig.baseUrl,
      model: ollamaConfig.model,
    });

    const agent = createCodeAgentDriver(ollamaConfig);

    // Step 5: Generate code
    const response = await agent.generate(prompts);

    // Step 6: Parse the response
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

    // Step 9: Track LLM usage (even for local LLM, for analytics)
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
    logger.error('Failed to generate code from plan', error);
    throw error;
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Build codebase context string from RAG chunks
 */
function buildCodebaseContext(
  ragContext?: GenerateCodeFromPlanInput['ragContext']
): string {
  if (!ragContext || ragContext.chunks.length === 0) {
    return 'No codebase context available.';
  }

  return ragContext.chunks
    .map((chunk) => {
      return `### File: ${chunk.filePath} (${chunk.language}, relevance: ${(chunk.score * 100).toFixed(0)}%)

\`\`\`${chunk.language}
${chunk.content}
\`\`\``;
    })
    .join('\n\n');
}

/**
 * Build full files context from complete file contents fetched from GitHub
 * This provides the AI with full context for files that need to be modified
 */
function buildFullFilesContext(
  fullFileContents?: GenerateCodeFromPlanInput['fullFileContents']
): string {
  if (!fullFileContents || fullFileContents.length === 0) {
    return 'No full file contents available.';
  }

  return fullFileContents
    .map((file) => {
      const language = detectLanguage(file.path);
      const lineCount = file.content.split('\n').length;
      return `### ${file.path} (${lineCount} lines)

\`\`\`${language}
${file.content}
\`\`\``;
    })
    .join('\n\n');
}

/**
 * Build prompt variables for template substitution
 */
function buildPromptVariables(
  input: GenerateCodeFromPlanInput,
  codebaseContext: string,
  fullFilesContext: string
): Record<string, string> {
  const { task, technicalPlan, userStory, project } = input;

  // Format architecture decisions
  const architectureDecisions = technicalPlan.architecture
    ?.map((a, i) => `${i + 1}. ${a}`)
    .join('\n') || 'No architecture decisions specified';

  // Format implementation steps
  const implementationSteps = technicalPlan.implementationSteps
    ?.map((s, i) => `${i + 1}. ${s}`)
    .join('\n') || 'No implementation steps specified';

  // Format risks
  const risks = technicalPlan.risks
    ?.map((r, i) => `${i + 1}. ${r}`)
    .join('\n') || 'No risks identified';

  // Format files affected
  const filesAffected = technicalPlan.filesAffected
    ?.map((f) => `- ${f}`)
    .join('\n') || 'Files to be determined';

  // Format acceptance criteria
  const acceptanceCriteria = userStory?.acceptanceCriteria
    ?.map((c, i) => `${i + 1}. ${c}`)
    .join('\n') || 'No acceptance criteria specified';

  // Generate branch suffix from task title
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

/**
 * Parse code generation response from AI
 */
function parseCodeGenerationResponse(
  content: string,
  taskIdentifier: string
): CodeGenerationFromPlanOutput {
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    let jsonString = jsonMatch ? jsonMatch[1] : content;

    // Also try to find raw JSON object
    if (!jsonMatch) {
      const objectMatch = content.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonString = objectMatch[0];
      }
    }

    const parsed = JSON.parse(jsonString);

    // Validate and normalize files
    const files: GeneratedFile[] = (parsed.files || []).map((f: any) => ({
      path: f.path,
      content: f.content || '',
      action: f.action || 'create',
      language: f.language || detectLanguage(f.path),
      reason: f.reason,
    }));

    // Generate defaults if not provided
    const branchName = parsed.branchName || `feat/${taskIdentifier.toLowerCase()}`;
    const commitMessage = parsed.commitMessage || `feat: implement ${taskIdentifier}`;
    const prTitle = parsed.prTitle || `feat: ${taskIdentifier}`;
    const prDescription = parsed.prDescription || generateDefaultPRDescription(files, taskIdentifier);

    // Calculate estimated changes
    const estimatedChanges = {
      additions: files.reduce((sum, f) => sum + (f.content?.split('\n').length || 0), 0),
      deletions: 0, // Can't know deletions without original files
      filesChanged: files.length,
    };

    return {
      files,
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

/**
 * Detect language from file path extension
 */
function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    rb: 'ruby',
    php: 'php',
    cs: 'csharp',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
    md: 'markdown',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    sql: 'sql',
    sh: 'bash',
    css: 'css',
    scss: 'scss',
    html: 'html',
  };
  return languageMap[ext || ''] || 'text';
}

/**
 * Generate default PR description if not provided by AI
 */
function generateDefaultPRDescription(
  files: GeneratedFile[],
  taskIdentifier: string
): string {
  const filesList = files
    .map((f) => `- \`${f.path}\` (${f.action})`)
    .join('\n');

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

// ============================================
// GitHub File Fetching Activity
// ============================================

export interface FetchFilesFromGitHubInput {
  /** Project ID for OAuth resolution */
  projectId: string;
  /** List of file paths to fetch (from technicalPlan.filesAffected) */
  filePaths: string[];
  /** Optional branch to fetch from (defaults to main/default branch) */
  branch?: string;
}

export interface FetchFilesFromGitHubOutput {
  /** Successfully fetched files with their contents */
  files: Array<{
    path: string;
    content: string;
  }>;
  /** Files that could not be fetched (new files or errors) */
  notFound: string[];
}

/**
 * Fetch full file contents from GitHub for files listed in technicalPlan.filesAffected
 * This provides the AI with complete context for modifications (not just RAG chunks)
 *
 * Privacy-first: Files are fetched via GitHub API using OAuth token
 */
export async function fetchFilesFromGitHub(
  input: FetchFilesFromGitHubInput
): Promise<FetchFilesFromGitHubOutput> {
  logger.info('Fetching full files from GitHub', {
    projectId: input.projectId,
    fileCount: input.filePaths.length,
  });

  const files: Array<{ path: string; content: string }> = [];
  const notFound: string[] = [];

  try {
    // Get repository config
    const repoConfig = await getProjectRepositoryConfig(input.projectId);

    // Resolve GitHub token via OAuth
    const token = await oauthResolver.resolveGitHubToken(input.projectId);
    const github = new GitHubProvider(token);

    // Fetch each file
    for (const filePath of input.filePaths) {
      try {
        const content = await github.getFileContent(
          repoConfig.owner,
          repoConfig.repo,
          filePath,
          input.branch
        );
        files.push({ path: filePath, content });
        logger.debug('Fetched file successfully', { filePath });
      } catch (error) {
        // File doesn't exist (will be created) or other error
        logger.info('File not found or error fetching', { filePath, error: (error as Error).message });
        notFound.push(filePath);
      }
    }

    logger.info('File fetching completed', {
      fetched: files.length,
      notFound: notFound.length,
    });

    return { files, notFound };
  } catch (error) {
    logger.error('Failed to fetch files from GitHub', error as Error);
    // Return empty result on total failure (don't block code generation)
    return { files: [], notFound: input.filePaths };
  }
}

// ============================================
// AI Failure Analysis Activity (Phase 4 V2)
// ============================================

export interface AnalyzeFailuresActivityInput {
  /** Project ID */
  projectId: string;
  /** Task ID */
  taskId: string;
  /** Generated files that failed validation */
  generatedFiles: GeneratedFile[];
  /** Container execution result with failure details */
  containerResult: ExecuteInContainerOutput;
  /** Number of previous retry attempts */
  previousAttempts: number;
  /** Original context for regeneration */
  originalPromptContext: {
    technicalPlan: {
      architecture: string[];
      implementationSteps: string[];
      testingStrategy: string;
      risks: string[];
    };
    codebaseContext?: string;
  };
  /** Organization ID for usage tracking */
  organizationId?: string;
  /** Workflow ID for usage tracking */
  workflowId?: string;
}

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
      temperature: 0.2, // Slightly higher for analysis
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

    // Return basic analysis on error
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
// Helper Functions for Failure Analysis
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

function determineFailedPhase(result: ExecuteInContainerOutput): 'lint' | 'typecheck' | 'test' {
  if (result.failedPhase) {
    if (result.failedPhase === 'lint' || result.failedPhase === 'typecheck' || result.failedPhase === 'test') {
      return result.failedPhase;
    }
  }

  // Determine from phase results
  if (result.phases.lint && !result.phases.lint.success) return 'lint';
  if (result.phases.typecheck && !result.phases.typecheck.success) return 'typecheck';
  if (result.phases.test && !result.phases.test.success) return 'test';

  return 'test'; // Default
}

function extractErrorDetails(
  result: ExecuteInContainerOutput,
  failedPhase: 'lint' | 'typecheck' | 'test'
): string {
  const phase = result.phases[failedPhase];
  if (!phase) return 'No error details available';

  let details = phase.output || '';

  // Extract key error lines
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

  // Limit to first 50 error lines to avoid token overflow
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
    // Extract JSON from response
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    let jsonString = jsonMatch ? jsonMatch[1] : content;

    // Try to find raw JSON
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

    // Return basic analysis from raw content
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
