/**
 * Step Workflow Output Types
 *
 * Output types for all atomic step workflows.
 * Each step workflow wraps a single activity call.
 */

import type { ExternalContextLinks } from '@/activities/context-extraction.activities';

// ============================================
// Common Step Outputs
// ============================================

export interface SyncLinearTaskOutput {
  id: string;
  linearId: string;
  identifier: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  assignee?: string;
  labels?: string[];
  url: string;
  teamId?: string;
  acceptanceCriteria?: string[];
  externalLinks?: ExternalContextLinks;
  figmaUrl?: string;
  sentryUrl?: string;
  githubIssueUrl?: string;
}

export interface UpdateLinearStatusOutput {
  success: boolean;
}

export interface UpdateLinearTaskOutput {
  success: boolean;
}

export interface GetPhaseDocumentOutput {
  content: string | null;
  documentId: string | null;
  documentUrl: string | null;
}

// ============================================
// Refinement Step Outputs
// ============================================

export interface GetPOAnswersOutput {
  answers: Array<{
    question: string;
    answer: string;
  }>;
}

export interface RetrieveRagContextOutput {
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
}

export interface SaveCodebaseContextOutput {
  documentId: string;
  documentUrl: string;
}

export interface AnalyzeDocumentationOutput {
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
}

export interface SaveDocumentationContextOutput {
  documentId: string;
  documentUrl: string;
}

export interface GenerateRefinementOutput {
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
  externalContext?: {
    figma?: any;
    sentry?: any;
    githubIssue?: any;
  };
}

export interface AddTaskTypeLabelOutput {
  labelId: string;
  created: boolean;
}

export interface SaveExternalContextOutput {
  figmaDocumentId?: string;
  sentryDocumentId?: string;
  githubIssueDocumentId?: string;
}

export interface UpdateTaskContentOutput {
  success: boolean;
}

export interface AppendRefinementOutput {
  success: boolean;
}

export interface CreateSubtasksOutput {
  created: Array<{
    index: number;
    issueId: string;
    identifier: string;
    title: string;
  }>;
  failed: Array<{
    index: number;
    title: string;
    error: string;
  }>;
}

export interface PostPOQuestionsOutput {
  questionCommentIds: string[];
}

// ============================================
// User Story Step Outputs
// ============================================

export interface GenerateUserStoryOutput {
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

export interface AppendUserStoryOutput {
  documentId: string;
  documentUrl: string;
}

export interface CreateSplitSubtasksOutput {
  created: Array<{
    index: number;
    issueId: string;
    identifier: string;
    title: string;
  }>;
  failed: Array<{
    index: number;
    title: string;
    error: string;
  }>;
}

export interface AddSplitCommentOutput {
  commentId: string;
}

// ============================================
// Technical Plan Step Outputs
// ============================================

export interface FetchBestPracticesOutput {
  bestPractices: string;
  perplexityModel: string;
  sources?: string[];
  searchQueries?: string[];
}

export interface SaveBestPracticesOutput {
  documentId: string;
  documentUrl: string;
}

export interface GenerateTechnicalPlanOutput {
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
  contextUsed: {
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
}

export interface AppendTechnicalPlanOutput {
  documentId: string;
  documentUrl: string;
}
