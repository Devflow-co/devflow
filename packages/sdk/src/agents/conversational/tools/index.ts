/**
 * Tool Types and Definitions Export
 */

// Types
export * from './tool.types';

// Linear Tools
export { linearTools } from './linear.tools';
export {
  linearGetIssue,
  linearCreateIssue,
  linearUpdateStatus,
  linearAddComment,
  linearQueryIssues,
} from './linear.tools';

// GitHub Tools
export { githubTools } from './github.tools';
export {
  githubGetRepo,
  githubGetFile,
  githubCreateBranch,
  githubCommitFiles,
  githubCreatePR,
  githubGetPipelineStatus,
} from './github.tools';

// RAG Tools
export { ragTools } from './rag.tools';
export {
  ragSearchCodebase,
  ragGetFile,
  ragGetDirectoryTree,
} from './rag.tools';

// Workflow Tools
export { workflowTools } from './workflow.tools';
export {
  workflowStartRefinement,
  workflowStartUserStory,
  workflowStartTechnicalPlan,
  workflowStartCodeGeneration,
  workflowGetStatus,
  workflowCancel,
} from './workflow.tools';

// Project Tools
export { projectTools } from './project.tools';
export {
  projectGetContext,
  projectListTasks,
  projectGetTask,
} from './project.tools';

// Import all tools for convenience
import { linearTools } from './linear.tools';
import { githubTools } from './github.tools';
import { ragTools } from './rag.tools';
import { workflowTools } from './workflow.tools';
import { projectTools } from './project.tools';
import { RegisteredTool } from './tool.types';

/**
 * All available tools combined
 */
export const allTools: RegisteredTool[] = [
  ...linearTools,
  ...githubTools,
  ...ragTools,
  ...workflowTools,
  ...projectTools,
];

/**
 * Register all tools in a registry
 */
import { ToolRegistry } from '../tool-registry';

export function registerAllTools(registry: ToolRegistry): void {
  registry.registerAll(allTools);
}
