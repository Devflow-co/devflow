/**
 * Configuration that can be safely passed to Temporal workflows
 * Must be serializable (no functions, no complex objects)
 */
export interface WorkflowConfig {
  linear: {
    statuses: {
      specInProgress: string;
      specReady: string;
      specFailed: string;
      specification: string;
      inReview: string;
      done: string;
      blocked: string;
      triggerStatus: string;
      nextStatus: string;
    };
  };
  // Can add more workflow-safe config here as needed
}

/**
 * Default workflow configuration (used as fallback)
 */
export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  linear: {
    statuses: {
      specInProgress: 'Spec In Progress',
      specReady: 'Spec Ready',
      specFailed: 'Spec Failed',
      specification: 'Specification',
      inReview: 'In Review',
      done: 'Done',
      blocked: 'Blocked',
      triggerStatus: 'To Spec',
      nextStatus: 'Spec Ready',
    },
  },
};
