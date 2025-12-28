/**
 * Step Workflow Input Types
 *
 * Input types for all atomic step workflows.
 * Each step workflow wraps a single activity call.
 */

import type { ExternalContextLinks } from '@/activities/context-extraction.activities';

// ============================================
// Common Step Inputs
// ============================================

export interface SyncLinearTaskInput {
  taskId: string;
  projectId: string;
}

export interface UpdateLinearStatusInput {
  projectId: string;
  linearId: string;
  status: string;
}

export interface UpdateLinearTaskInput {
  projectId: string;
  linearId: string;
  updates: {
    status?: string;
    title?: string;
    description?: string;
  };
}

export interface GetPhaseDocumentInput {
  projectId: string;
  linearId: string;
  phase: 'user_story' | 'technical_plan' | 'best_practices' | 'codebase_context' | 'documentation_context';
}

// ============================================
// Refinement Step Inputs
// ============================================

export interface GetPOAnswersInput {
  linearIssueId: string;
  projectId: string;
}

export interface RetrieveRagContextInput {
  projectId: string;
  query: string;
  topK?: number;
  useReranking?: boolean;
}

export interface SaveCodebaseContextInput {
  projectId: string;
  linearId: string;
  chunks: Array<{
    filePath: string;
    content: string;
    score: number;
    language: string;
    startLine?: number;
    endLine?: number;
    chunkType?: string;
  }>;
  taskContext?: {
    title: string;
    query: string;
  };
}

export interface AnalyzeDocumentationInput {
  projectId: string;
  taskQuery: string;
}

export interface SaveDocumentationContextInput {
  projectId: string;
  linearId: string;
  context: {
    projectStructure: {
      language: string;
      framework?: string;
      buildSystem?: string;
      testFramework?: string;
      directories: string[];
    };
    dependencies: {
      production: Array<{ name: string; version: string }>;
      development: Array<{ name: string; version: string }>;
    };
    documentation?: {
      readme?: string;
      contributing?: string;
      changelog?: string;
    };
    relevantDocs?: Array<{
      path: string;
      content: string;
      relevance: number;
    }>;
  };
  taskContext?: {
    title: string;
  };
}

export interface GenerateRefinementInput {
  task: {
    title: string;
    description: string;
    priority?: string;
    labels?: string[];
  };
  projectId: string;
  externalLinks?: ExternalContextLinks;
  poAnswers?: Array<{ question: string; answer: string }>;
  ragContext?: {
    chunks: Array<{
      filePath: string;
      content: string;
      score: number;
      language: string;
    }>;
  } | null;
  documentationContext?: {
    projectStructure: {
      language: string;
      framework?: string;
    };
    dependencies: {
      production: Array<{ name: string; version: string }>;
      development: Array<{ name: string; version: string }>;
    };
    documentation?: {
      readme?: string;
    };
    relevantDocs?: Array<{
      path: string;
      content: string;
      relevance: number;
    }>;
  };
  aiModel?: string;
  enableFigmaContext?: boolean;
  enableSentryContext?: boolean;
  enableGitHubIssueContext?: boolean;
}

export interface AddTaskTypeLabelInput {
  projectId: string;
  issueId: string;
  teamId: string;
  taskType: string;
}

export interface SaveExternalContextInput {
  projectId: string;
  linearId: string;
  context: {
    figma?: any;
    sentry?: any;
    githubIssue?: any;
  };
  taskContext: {
    title: string;
    identifier: string;
  };
}

export interface UpdateTaskContentInput {
  projectId: string;
  linearId: string;
  title?: string;
  description?: string;
}

export interface AppendRefinementInput {
  projectId: string;
  linearId: string;
  refinement: {
    taskType: string;
    suggestedTitle: string;
    reformulatedDescription: string;
    businessContext: string;
    objectives: string[];
    preliminaryAcceptanceCriteria: string[];
    complexityEstimate: string;
    suggestedSplit?: {
      reason: string;
      proposedStories: Array<{
        title: string;
        description: string;
        dependencies?: number[];
        acceptanceCriteria?: string[];
      }>;
    };
    questionsForPO?: string[];
  };
}

export interface CreateSubtasksInput {
  projectId: string;
  parentIssueId: string;
  proposedStories: Array<{
    title: string;
    description: string;
    dependencies?: number[];
    acceptanceCriteria?: string[];
  }>;
  initialStatus?: string;
}

export interface PostPOQuestionsInput {
  taskId: string;
  projectId: string;
  linearIssueId: string;
  questions: string[];
}

// ============================================
// User Story Step Inputs
// ============================================

export interface GenerateUserStoryInput {
  task: {
    title: string;
    description: string;
    priority?: string;
  };
  refinement: {
    taskType: string;
    businessContext: string;
    objectives: string[];
    preliminaryAcceptanceCriteria: string[];
    complexityEstimate: string;
    suggestedSplit?: {
      reason: string;
      proposedStories: Array<{
        title: string;
        description: string;
        dependencies?: number[];
        acceptanceCriteria?: string[];
      }>;
    };
  };
  projectId: string;
  codebaseContext?: string;
  documentationContext?: string;
  aiModel?: string;
}

export interface AppendUserStoryInput {
  projectId: string;
  linearId: string;
  userStory: {
    userStory: {
      actor: string;
      goal: string;
      benefit: string;
    };
    acceptanceCriteria: string[];
    definitionOfDone: string[];
    businessValue: string;
    storyPoints: number;
    technicalNotes?: string;
    risks?: string[];
  };
}

export interface CreateSplitSubtasksInput {
  projectId: string;
  parentIssueId: string;
  proposedStories: Array<{
    title: string;
    description: string;
    dependencies?: number[];
    acceptanceCriteria?: string[];
  }>;
  initialStatus: string;
}

export interface AddSplitCommentInput {
  projectId: string;
  linearId: string;
  body: string;
}

// ============================================
// Technical Plan Step Inputs
// ============================================

export interface FetchBestPracticesInput {
  task: {
    title: string;
    description: string;
  };
  projectId: string;
  context?: {
    language?: string;
    framework?: string;
  };
}

export interface SaveBestPracticesInput {
  projectId: string;
  linearId: string;
  bestPractices: {
    bestPractices: string;
    perplexityModel: string;
    sources?: string[];
  };
  taskContext?: {
    title: string;
    language?: string;
    framework?: string;
  };
}

export interface GenerateTechnicalPlanInput {
  task: {
    id: string;
    linearId: string;
    identifier: string;
    title: string;
    description: string;
    priority?: string;
    labels?: string[];
  };
  projectId: string;
  userStory: {
    userStory: {
      actor: string;
      goal: string;
      benefit: string;
    };
    acceptanceCriteria: string[];
    definitionOfDone: string[];
    businessValue: string;
    storyPoints: number;
  };
  ragContext?: {
    chunks: Array<{
      filePath: string;
      content: string;
      score: number;
      language: string;
      startLine?: number;
      endLine?: number;
      chunkType?: string;
    }>;
    retrievalTimeMs: number;
    totalChunks: number;
  } | null;
  bestPractices?: {
    bestPractices: string;
    perplexityModel: string;
    sources?: string[];
  };
  documentationContext?: string;
  aiModel?: string;
  enableCouncilAI?: boolean;
  councilModels?: string[];
  councilChairmanModel?: string;
}

export interface AppendTechnicalPlanInput {
  projectId: string;
  linearId: string;
  plan: {
    summary: string;
    architecture: {
      approach: string;
      components: Array<{
        name: string;
        responsibility: string;
        interactions: string[];
      }>;
      dataFlow?: string;
    };
    implementationSteps: Array<{
      order: number;
      title: string;
      description: string;
      files: string[];
      estimatedEffort: string;
      dependencies?: number[];
    }>;
    testingStrategy: {
      unitTests: string[];
      integrationTests: string[];
      e2eTests?: string[];
    };
    risks: Array<{
      risk: string;
      mitigation: string;
      severity: 'low' | 'medium' | 'high';
    }>;
    openQuestions?: string[];
  };
  contextUsed?: {
    language: string;
    framework?: string;
    dependencies: number;
    conventions: number;
    filesAnalyzed: string[];
    usingRAG: boolean;
  };
  council?: {
    models: string[];
    chosenModel: string;
    agreementScore: number;
    deliberationSummary: string;
  };
  bestPractices?: {
    bestPractices: string;
    perplexityModel: string;
  };
}
