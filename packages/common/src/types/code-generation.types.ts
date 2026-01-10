/**
 * Code Generation Types - Phase 4 of Four-Phase Agile Workflow
 *
 * Types for automated code generation using local LLM (Ollama)
 * and draft PR creation.
 */

// ============================================
// Generated File Types
// ============================================

export interface GeneratedFile {
  /** Relative path from repository root */
  path: string;
  /** Full file content */
  content: string;
  /** Type of change */
  action: 'create' | 'modify' | 'delete';
  /** Programming language (detected from extension) */
  language?: string;
  /** Reason for this change */
  reason?: string;
}

// ============================================
// Code Generation Input/Output
// ============================================

export interface CodeGenerationFromPlanInput {
  /** Task information from Linear */
  task: {
    id: string;
    linearId: string;
    title: string;
    description: string;
    identifier: string;
  };

  /** Technical plan from Phase 3 */
  technicalPlan: {
    architecture: string[];
    implementationSteps: string[];
    testingStrategy: string;
    risks: string[];
    dependencies: string[];
    technicalDecisions: string[];
  };

  /** User story from Phase 2 */
  userStory?: {
    actor: string;
    goal: string;
    benefit: string;
    acceptanceCriteria: string[];
    storyPoints?: number;
  };

  /** Codebase context from RAG */
  codebaseContext?: {
    chunks: Array<{
      filePath: string;
      content: string;
      score: number;
      language: string;
    }>;
  };

  /** Project configuration */
  project: {
    language: string;
    framework?: string;
    testFramework?: string;
    repositoryUrl: string;
    defaultBranch: string;
  };
}

export interface CodeGenerationFromPlanOutput {
  /** Generated files */
  files: GeneratedFile[];

  /** Suggested commit message */
  commitMessage: string;

  /** Suggested branch name */
  branchName: string;

  /** PR title */
  prTitle: string;

  /** PR description (markdown) */
  prDescription: string;

  /** Estimated changes */
  estimatedChanges: {
    additions: number;
    deletions: number;
    filesChanged: number;
  };

  /** AI metrics */
  aiMetrics?: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
  };
}

// ============================================
// PR Types
// ============================================

export interface DraftPRInput {
  projectId: string;
  taskId: string;

  /** Branch name for the PR */
  branchName: string;

  /** PR title */
  title: string;

  /** PR description (markdown) */
  description: string;

  /** Files to commit */
  files: GeneratedFile[];

  /** Commit message */
  commitMessage: string;

  /** Linear issue identifier for linking */
  linearIdentifier?: string;

  /** User story acceptance criteria for checklist */
  acceptanceCriteria?: string[];
}

export interface DraftPROutput {
  /** PR number */
  number: number;

  /** PR URL */
  url: string;

  /** Whether it's a draft PR */
  draft: boolean;

  /** Branch name */
  branchName: string;

  /** Commit SHA */
  commitSha: string;
}

// ============================================
// Test Execution Types (V2)
// ============================================

export interface TestExecutionInput {
  /** Project ID for OAuth token resolution */
  projectId: string;

  /** Repository to clone */
  repository: {
    url: string;
    branch: string;
  };

  /** Generated files to apply */
  files: GeneratedFile[];

  /** Test command to run (e.g., "npm test", "pytest") */
  testCommand?: string;

  /** Timeout in seconds */
  timeout?: number;
}

export interface TestExecutionOutput {
  /** Whether all tests passed */
  success: boolean;

  /** Number of passed tests */
  passed: number;

  /** Number of failed tests */
  failed: number;

  /** Number of skipped tests */
  skipped: number;

  /** Total duration in seconds */
  duration: number;

  /** Test output logs */
  logs: string;

  /** Individual test failures */
  failures?: Array<{
    testName: string;
    testPath: string;
    error: string;
    stackTrace?: string;
  }>;

  /** Code coverage (if available) */
  coverage?: {
    lines: number;
    branches: number;
    functions: number;
    statements: number;
  };
}

// ============================================
// Code Validation Types (V2)
// ============================================

export interface CodeValidationInput {
  /** Generated files to validate */
  files: GeneratedFile[];

  /** Project language */
  language: string;

  /** Enable lint check */
  enableLint?: boolean;

  /** Enable typecheck */
  enableTypecheck?: boolean;
}

export interface CodeValidationOutput {
  /** Whether validation passed */
  valid: boolean;

  /** Validation errors */
  errors: Array<{
    file: string;
    line?: number;
    column?: number;
    message: string;
    type: 'lint' | 'typecheck' | 'format';
    severity: 'error' | 'warning';
  }>;
}

// ============================================
// Container Execution Types (V2)
// ============================================

export interface ContainerPhaseResult {
  /** Whether this phase succeeded */
  success: boolean;
  /** Exit code from command */
  exitCode: number;
  /** Command output */
  output: string;
  /** Duration in milliseconds */
  duration: number;
}

export interface ExecuteInContainerInput {
  /** Project ID for OAuth token resolution */
  projectId: string;
  /** Task ID for logging */
  taskId: string;
  /** Repository to clone */
  repository: {
    owner: string;
    repo: string;
    branch: string;
  };
  /** Generated files to apply */
  generatedFiles: GeneratedFile[];
  /** Commands to run in container */
  commands: {
    /** Install command (e.g., "npm ci", "pip install -r requirements.txt") */
    install?: string;
    /** Lint command (e.g., "npm run lint") */
    lint?: string;
    /** Typecheck command (e.g., "npm run typecheck") */
    typecheck?: string;
    /** Test command (e.g., "npm test") */
    test?: string;
  };
  /** Timeout in milliseconds (default: 600000 = 10 min) */
  timeout?: number;
  /** Docker image to use (default: node:20-alpine) */
  image?: string;
  /** Memory limit (default: 2g) */
  memory?: string;
}

export interface ExecuteInContainerOutput {
  /** Whether all phases succeeded */
  success: boolean;
  /** Overall exit code (0 if all passed) */
  exitCode: number;
  /** Phase-by-phase results */
  phases: {
    clone: ContainerPhaseResult;
    applyFiles: ContainerPhaseResult;
    install: ContainerPhaseResult;
    lint?: ContainerPhaseResult;
    typecheck?: ContainerPhaseResult;
    test?: ContainerPhaseResult;
  };
  /** Aggregated logs */
  logs: string;
  /** Total duration in milliseconds */
  duration: number;
  /** Parsed test results (if test phase ran) */
  testResults?: TestExecutionOutput;
  /** Which phase failed (if any) */
  failedPhase?: 'clone' | 'applyFiles' | 'install' | 'lint' | 'typecheck' | 'test';
}

// ============================================
// AI Failure Analysis Types (V2)
// ============================================

export interface AnalyzeFailuresWithAIInput {
  /** Project ID */
  projectId: string;
  /** Task ID */
  taskId: string;
  /** Generated files that failed */
  generatedFiles: GeneratedFile[];
  /** Container execution result */
  containerResult: ExecuteInContainerOutput;
  /** Number of previous retry attempts */
  previousAttempts: number;
  /** Original context for regeneration */
  originalPromptContext: {
    technicalPlan: CodeGenerationFromPlanInput['technicalPlan'];
    codebaseContext?: string;
  };
}

export interface SuggestedFix {
  /** File path to fix */
  file: string;
  /** Description of the issue */
  issue: string;
  /** Suggested fix */
  suggestion: string;
}

export interface AnalyzeFailuresWithAIOutput {
  /** Root cause analysis */
  analysis: string;
  /** Which phase failed */
  failedPhase: 'lint' | 'typecheck' | 'test';
  /** Suggested fixes */
  suggestedFixes: SuggestedFix[];
  /** Enhanced prompt for retry generation */
  retryPromptEnhancement: string;
  /** Confidence in the analysis */
  confidence: 'high' | 'medium' | 'low';
}

// ============================================
// Orchestrator Types
// ============================================

export interface CodeGenerationOrchestratorInput {
  taskId: string;
  projectId: string;
}

export interface CodeGenerationOrchestratorResult {
  success: boolean;
  phase: 'code_generation';
  message: string;

  /** Created PR info */
  pr?: {
    number: number;
    url: string;
    draft: boolean;
  };

  /** Test results (V2) */
  testResults?: {
    passed: number;
    failed: number;
    retryAttempts: number;
  };

  /** Container execution results (V2) */
  containerResult?: {
    success: boolean;
    failedPhase?: string;
    duration: number;
  };

  /** Retry metrics (V2) */
  retryMetrics?: {
    totalAttempts: number;
    validationRetries: number;
    testRetries: number;
  };

  /** Number of files generated */
  generatedFiles?: number;

  /** AI metrics */
  aiMetrics?: {
    model: string;
    totalTokens: number;
    latencyMs: number;
  };
}

// Note: CodeGenerationFeatures and DEFAULT_CODE_GENERATION_FEATURES
// are defined in automation-config.types.ts for consistency with other phases
