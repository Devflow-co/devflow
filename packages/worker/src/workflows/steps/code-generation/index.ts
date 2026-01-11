/**
 * Code Generation Sub-Workflows Index
 *
 * Exports all sub-workflows for Phase 4 (Code Generation).
 * These workflows are called by the main orchestrator.
 */

// Setup & Context (Phase A)
export { setupCodeGenerationWorkflow } from './setup.workflow';
export type { SetupWorkflowInput, SetupWorkflowOutput } from './setup.workflow';

export { contextRetrievalWorkflow } from './context-retrieval.workflow';
export type {
  ContextRetrievalInput,
  ContextRetrievalOutput,
  ParsedTechnicalPlan,
  CodebaseContextChunk,
  FullFileContent,
} from './context-retrieval.workflow';

// Core Generation (Phase C)
export { generateCodeWorkflow } from './generate-code.workflow';
export type { GenerateCodeWorkflowInput, GenerateCodeWorkflowOutput } from './generate-code.workflow';

export { containerValidationWorkflow } from './container-validation.workflow';
export type {
  ContainerValidationWorkflowInput,
  ContainerValidationWorkflowOutput,
} from './container-validation.workflow';

// V3 Interactive (Phases B & D)
export { ambiguityDetectionWorkflow } from './ambiguity-detection.workflow';
export type {
  AmbiguityDetectionWorkflowInput,
  AmbiguityDetectionWorkflowOutput,
} from './ambiguity-detection.workflow';

export { solutionDetectionWorkflow } from './solution-detection.workflow';
export type {
  SolutionDetectionWorkflowInput,
  SolutionDetectionWorkflowOutput,
} from './solution-detection.workflow';

export { preApprovalWorkflow } from './pre-approval.workflow';
export type { PreApprovalWorkflowInput, PreApprovalWorkflowOutput } from './pre-approval.workflow';

// Commit & PR (Phase E)
export { commitPRWorkflow } from './commit-pr.workflow';
export type { CommitPRWorkflowInput, CommitPRWorkflowOutput } from './commit-pr.workflow';

// Finalization (Phase F)
export { finalizationWorkflow } from './finalization.workflow';
export type { FinalizationWorkflowInput, FinalizationWorkflowOutput } from './finalization.workflow';
