/**
 * DevFlow SDK - Main exports
 */

// VCS Drivers
export * from './vcs';

// CI Drivers
export * from './ci';

// Linear Client
export { LinearClient, createLinearClient, type LinearCustomField, type LinearComment, type LinearDocument } from './linear/linear.client';
export {
  LinearIntegrationService,
  createLinearIntegrationService,
} from './linear/linear-integration.service';
export { LinearMapper } from './linear/linear.mapper';
export {
  LinearSetupService,
  createLinearSetupService,
  DEVFLOW_CUSTOM_FIELDS,
  DEVFLOW_WORKFLOW_STATES,
  type DevFlowCustomFieldKey,
  type LinearWorkflowStateType,
  type SetupCustomFieldsResult,
  type ValidateSetupResult,
  type ValidateWorkflowStatesResult,
  type CreateWorkflowStatesResult,
} from './linear/linear-setup.service';
export {
  LabelService,
  createLabelService,
  TASK_TYPE_LABELS,
  type TaskType,
} from './linear/label.service';
export {
  formatSpecAsMarkdown,
  formatWarningMessage,
  formatSpecWithWarning,
  formatRefinementAsMarkdown,
  formatUserStoryAsMarkdown,
  formatTechnicalPlanAsMarkdown,
  formatCouncilSummaryAsMarkdown,
  // New structured formatting functions
  parseDevFlowDescription,
  formatDevFlowDescription,
  formatRefinementContent,
  formatUserStoryContent,
  formatTechnicalPlanContent,
  // Standalone document formatters (for Linear Documents)
  formatUserStoryDocument,
  formatTechnicalPlanDocument,
  formatBestPracticesDocument,
  formatCodebaseContextDocument,
  formatDocumentationContextDocument,
  // External context document formatters (Figma, Sentry, GitHub Issue)
  formatFigmaContextDocument,
  formatSentryContextDocument,
  formatGitHubIssueContextDocument,
  type ParsedDevFlowDescription,
  type DevFlowDescriptionParts,
  type DocumentationContextInput,
  type FigmaContextDocumentInput,
  type SentryContextDocumentInput,
  type GitHubIssueContextDocumentInput,
} from './linear/spec-formatter';
export {
  LinearSyncService,
  createLinearSyncService,
  TASK_TO_LINEAR_FIELD_MAP,
  type TaskFieldKey,
  type SyncDirection,
  type LinearFullIssue,
  type TaskSyncData,
  type SyncDiff,
  type SyncResult,
} from './linear/linear-sync.service';
export type {
  LinearConfig,
  LinearIssue,
  LinearLabel,
  LinearTask,
  LinearState,
  LinearTeam,
  LinearUser,
  LinearWebhookPayload,
  LinearQueryOptions,
} from './linear/linear.types';

// Phase 3: Project Adapter & Agents
export * from './project-adapter';
export * from './agents';

// Phase 4: Security & Governance
export * from './security';

// Codebase Analysis
export * from './codebase';

// RAG (Retrieval-Augmented Generation)
export * from './rag';

// Auth
export * from './auth';

// Figma
export * from './figma';

// Sentry
export * from './sentry';

// Slack
export * from './slack';

// Storage (Supabase)
export * from './storage';

// Docker (Container Execution)
export * from './docker';

// Factory functions
export * from './factories';
