/**
 * Code Generation Activities - Shared Types
 */

import type {
  TechnicalPlanGenerationOutput,
  UserStoryGenerationOutput,
  StepAIMetrics,
  StepResultSummary,
  CodeGenerationFromPlanOutput,
  GeneratedFile,
  ExecuteInContainerOutput,
} from '@devflow/common';

// ============================================
// Generate Code Types
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
// Fetch Files Types
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

// ============================================
// Analyze Failures Types
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

// ============================================
// Ambiguity Detection Types
// ============================================

export interface DetectAmbiguityInput {
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

  /** Project configuration */
  projectId: string;

  /** RAG context from codebase */
  codebaseContext?: string;

  /** Documentation context */
  documentationContext?: string;

  /** Organization ID for usage tracking */
  organizationId?: string;

  /** Workflow ID for usage tracking */
  workflowId?: string;
}

export interface AmbiguityOption {
  id: string;
  label: string;
  description: string;
  pros: string[];
  cons: string[];
  recommended: boolean;
}

export interface DetectedAmbiguity {
  id: string;
  type: 'architectural' | 'integration' | 'behavior' | 'data' | 'api';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  options: AmbiguityOption[];
}

export interface DetectAmbiguityOutput {
  /** Whether any significant ambiguities were found */
  hasAmbiguities: boolean;

  /** Confidence in the analysis */
  confidence: 'high' | 'medium' | 'low';

  /** Overall analysis summary */
  analysis: string;

  /** Detected ambiguities with options */
  ambiguities: DetectedAmbiguity[];
}

// ============================================
// Solution Detection Types
// ============================================

export interface DetectSolutionsInput {
  /** Task information */
  task: {
    id: string;
    linearId: string;
    title: string;
    identifier: string;
  };

  /** Generated files that failed validation */
  generatedFiles: GeneratedFile[];

  /** Container execution result with failure details */
  containerResult: ExecuteInContainerOutput;

  /** Number of previous retry attempts */
  attemptNumber: number;
  maxAttempts: number;

  /** Technical plan for context */
  technicalPlan: TechnicalPlanGenerationOutput;

  /** Codebase context for context */
  codebaseContext?: string;

  /** Project configuration */
  projectId: string;

  /** Organization ID for usage tracking */
  organizationId?: string;

  /** Workflow ID for usage tracking */
  workflowId?: string;
}

export interface SolutionOption {
  id: string;
  label: string;
  description: string;
  changes: string;
  pros: string[];
  cons: string[];
  risk: 'low' | 'medium' | 'high';
  recommended: boolean;
}

export interface DetectSolutionsOutput {
  /** Whether multiple valid solutions exist */
  hasMultipleSolutions: boolean;

  /** Error analysis */
  errorAnalysis: {
    phase: 'lint' | 'typecheck' | 'test';
    errorType: string;
    file: string;
    line?: number;
    message: string;
    rootCause: string;
  };

  /** Single solution (when obvious) */
  solution?: {
    description: string;
    changes: string;
    confidence: 'high' | 'medium' | 'low';
  };

  /** Multiple solutions (when choices exist) */
  solutions?: SolutionOption[];

  /** Recommended solution ID */
  recommendation?: string;

  /** Reason for recommendation */
  recommendationReason?: string;
}
