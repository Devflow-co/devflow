/**
 * Container Validation Step Workflow - Phase 4 Code Generation
 *
 * Executes generated code in a Docker container for validation.
 * Runs: clone → apply files → install → lint → typecheck → test
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type * as containerActivities from '@/activities/container-execution.activities';
import type * as codeGenActivities from '@/activities/code-generation';
import type { WorkflowConfig, GeneratedFile, ExecuteInContainerOutput } from '@devflow/common';

const { logWorkflowProgress } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
  retry: { maximumAttempts: 3 },
});

const { executeInContainer } = proxyActivities<typeof containerActivities>({
  startToCloseTimeout: '15 minutes', // Container execution can take time
  retry: { maximumAttempts: 1 }, // Don't retry container execution
});

const { analyzeFailuresWithAI } = proxyActivities<typeof codeGenActivities>({
  startToCloseTimeout: '3 minutes',
  retry: { maximumAttempts: 2 },
});

// ============================================
// Utility Functions (inlined for Temporal workflow compatibility)
// ============================================

interface ProjectMeta {
  language: string;
  framework?: string;
  testFramework?: string;
}

interface ContainerCommands {
  install: string;
  lint?: string;
  typecheck?: string;
  test?: string;
}

/**
 * Get default commands for a project based on detected language/framework
 * (Inlined because Temporal workflows cannot call external non-activity functions)
 */
function getDefaultCommands(project?: ProjectMeta): ContainerCommands {
  const language = project?.language?.toLowerCase() || 'typescript';
  const framework = project?.framework?.toLowerCase();

  // Node.js / TypeScript defaults
  if (language === 'typescript' || language === 'javascript' || framework === 'node') {
    return {
      install: 'npm ci',
      lint: 'npm run lint --if-present',
      typecheck: language === 'typescript' ? 'npm run typecheck --if-present' : undefined,
      test: 'npm test --if-present',
    };
  }

  // Python defaults
  if (language === 'python') {
    return {
      install: 'pip install -r requirements.txt',
      lint: 'ruff check . || flake8 .',
      typecheck: 'mypy . --ignore-missing-imports',
      test: 'pytest',
    };
  }

  // Go defaults
  if (language === 'go') {
    return {
      install: 'go mod download',
      lint: 'golangci-lint run',
      typecheck: 'go build ./...',
      test: 'go test ./...',
    };
  }

  // Default to Node.js
  return {
    install: 'npm ci',
    lint: 'npm run lint --if-present',
    typecheck: 'npm run typecheck --if-present',
    test: 'npm test --if-present',
  };
}

/**
 * Get default container image for a project based on detected language
 * (Inlined because Temporal workflows cannot call external non-activity functions)
 */
function getDefaultImage(project?: ProjectMeta): string {
  const language = project?.language?.toLowerCase() || 'typescript';

  const imageMap: Record<string, string> = {
    typescript: 'node:20-alpine',
    javascript: 'node:20-alpine',
    python: 'python:3.11-slim',
    go: 'golang:1.21-alpine',
    rust: 'rust:1.74-alpine',
    java: 'eclipse-temurin:21-jdk-alpine',
    kotlin: 'eclipse-temurin:21-jdk-alpine',
    ruby: 'ruby:3.2-alpine',
    php: 'php:8.2-cli-alpine',
  };

  return imageMap[language] || 'node:20-alpine';
}

// ============================================
// Types
// ============================================

export interface ContainerValidationWorkflowInput {
  projectId: string;
  taskId: string;
  config?: WorkflowConfig;
  /** Workflow ID for progress logging */
  parentWorkflowId: string;
  /** Organization ID for usage tracking */
  organizationId?: string;

  /** Generated files to validate */
  generatedFiles: GeneratedFile[];

  /** Which checks to run */
  enableLint: boolean;
  enableTypecheck: boolean;
  enableTests: boolean;

  /** Container configuration */
  containerImage?: string;
  containerMemory?: string;
  containerTimeoutMinutes?: number;

  /** Project metadata for default commands */
  project?: {
    language: string;
    framework?: string;
    testFramework?: string;
  };

  /** Number of previous retry attempts */
  attemptNumber: number;
}

export interface ContainerValidationWorkflowOutput {
  /** Whether validation passed */
  success: boolean;

  /** Container execution result */
  containerResult: ExecuteInContainerOutput;

  /** Which phase failed (if any) */
  failedPhase?: 'lint' | 'typecheck' | 'test';

  /** AI analysis of failures (if failed) */
  failureAnalysis?: {
    analysis: string;
    suggestedFixes: Array<{
      file: string;
      issue: string;
      suggestion: string;
    }>;
    retryPromptEnhancement: string;
    confidence: 'high' | 'medium' | 'low';
  };

  /** Execution duration in ms */
  duration: number;
}

// ============================================
// Workflow
// ============================================

/**
 * Container validation workflow for code generation phase.
 * Executes generated code in Docker for lint/typecheck/test validation.
 */
export async function containerValidationWorkflow(
  input: ContainerValidationWorkflowInput
): Promise<ContainerValidationWorkflowOutput> {
  const {
    projectId,
    taskId,
    config,
    parentWorkflowId,
    organizationId,
    generatedFiles,
    enableLint,
    enableTypecheck,
    enableTests,
    containerImage,
    containerMemory,
    containerTimeoutMinutes,
    project,
    attemptNumber,
  } = input;

  const totalSteps = 2; // Container execution + failure analysis (if needed)
  const attemptLabel = attemptNumber > 0 ? ` (Attempt ${attemptNumber + 1})` : '';

  // Step 1: Execute in container
  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: `Execute in Container${attemptLabel}`,
    stepNumber: 1,
    totalSteps,
    status: 'in_progress',
    startedAt: new Date(),
    metadata: {
      enableLint,
      enableTypecheck,
      enableTests,
      fileCount: generatedFiles.length,
      containerImage: containerImage || 'node:20-alpine',
    },
  });

  const containerStart = Date.now();

  // Get default commands based on project language
  const defaultCommands = getDefaultCommands(project);
  const defaultImage = getDefaultImage(project);

  // Build container commands based on enabled checks
  const commands: {
    install?: string;
    lint?: string;
    typecheck?: string;
    test?: string;
  } = {
    install: defaultCommands.install,
    lint: enableLint ? defaultCommands.lint : undefined,
    typecheck: enableTypecheck ? defaultCommands.typecheck : undefined,
    test: enableTests ? defaultCommands.test : undefined,
  };

  // Execute in container
  const containerResult = await executeInContainer({
    projectId,
    taskId,
    generatedFiles,
    commands,
    containerConfig: {
      image: containerImage || defaultImage,
      memory: containerMemory || '2g',
      timeout: (containerTimeoutMinutes || 10) * 60 * 1000,
    },
  });

  const duration = Date.now() - containerStart;
  const success = containerResult.success;
  const failedPhase = containerResult.failedPhase as 'lint' | 'typecheck' | 'test' | undefined;

  await logWorkflowProgress({
    workflowId: parentWorkflowId,
    projectId,
    taskId,
    phase: 'code_generation',
    stepName: `Execute in Container${attemptLabel}`,
    stepNumber: 1,
    totalSteps,
    status: success ? 'completed' : 'failed',
    startedAt: new Date(containerStart),
    completedAt: new Date(),
    metadata: {
      success,
      failedPhase,
      duration,
      exitCode: containerResult.exitCode,
      testResults: containerResult.testResults,
    },
  });

  // Step 2: Analyze failures with AI (if validation failed)
  let failureAnalysis: ContainerValidationWorkflowOutput['failureAnalysis'] | undefined;

  if (!success && failedPhase) {
    await logWorkflowProgress({
      workflowId: parentWorkflowId,
      projectId,
      taskId,
      phase: 'code_generation',
      stepName: 'Analyze Failures with AI',
      stepNumber: 2,
      totalSteps,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const analysisStart = Date.now();

    const analysis = await analyzeFailuresWithAI({
      projectId,
      taskId,
      generatedFiles,
      containerResult,
      previousAttempts: attemptNumber,
      originalPromptContext: {
        technicalPlan: {
          architecture: [],
          implementationSteps: [],
          testingStrategy: '',
          risks: [],
        },
      },
      organizationId,
      workflowId: parentWorkflowId,
    });

    failureAnalysis = {
      analysis: analysis.analysis,
      suggestedFixes: analysis.suggestedFixes,
      retryPromptEnhancement: analysis.retryPromptEnhancement,
      confidence: analysis.confidence,
    };

    await logWorkflowProgress({
      workflowId: parentWorkflowId,
      projectId,
      taskId,
      phase: 'code_generation',
      stepName: 'Analyze Failures with AI',
      stepNumber: 2,
      totalSteps,
      status: 'completed',
      startedAt: new Date(analysisStart),
      completedAt: new Date(),
      metadata: {
        confidence: analysis.confidence,
        suggestedFixCount: analysis.suggestedFixes.length,
      },
    });
  } else {
    // Skip failure analysis if validation passed
    await logWorkflowProgress({
      workflowId: parentWorkflowId,
      projectId,
      taskId,
      phase: 'code_generation',
      stepName: 'Analyze Failures with AI (skipped)',
      stepNumber: 2,
      totalSteps,
      status: 'skipped',
      startedAt: new Date(),
      completedAt: new Date(),
      metadata: { reason: 'Validation passed' },
    });
  }

  return {
    success,
    containerResult,
    failedPhase,
    failureAnalysis,
    duration,
  };
}
