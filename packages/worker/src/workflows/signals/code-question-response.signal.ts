/**
 * Code Question Response Signal - Phase 4 V3
 *
 * Temporal signal for receiving human responses to code generation questions.
 * Used for:
 * - Ambiguity clarification (design choices, missing details)
 * - Solution choice (when multiple fixes are possible)
 * - Pre-PR approval (optional human review)
 */

import { defineSignal } from '@temporalio/workflow';

/**
 * Response types for code generation questions
 */
export type CodeQuestionResponseType =
  | 'option_selected'
  | 'custom_text'
  | 'approved'
  | 'rejected'
  | 'timeout';

/**
 * Payload received when a developer responds to a code question
 */
export interface CodeQuestionResponsePayload {
  /** Unique identifier of the question being answered */
  questionId: string;
  /** Type of response */
  responseType: CodeQuestionResponseType;
  /** Selected option ID (for option_selected type) */
  selectedOption?: string;
  /** Custom text response (for custom_text or rejected types) */
  customText?: string;
  /** Who responded to the question */
  respondedBy: string;
  /** When the response was received */
  respondedAt: Date;
  /** Linear comment ID of the response */
  commentId?: string;
}

/**
 * Signal definition for receiving code question responses
 *
 * Usage in workflow:
 * ```typescript
 * import { setHandler, condition } from '@temporalio/workflow';
 * import { codeQuestionResponseSignal } from './signals/code-question-response.signal';
 *
 * let response: CodeQuestionResponsePayload | null = null;
 *
 * setHandler(codeQuestionResponseSignal, (payload) => {
 *   response = payload;
 * });
 *
 * // Wait for response or timeout
 * await condition(() => response !== null, timeoutMs);
 * ```
 */
export const codeQuestionResponseSignal = defineSignal<[CodeQuestionResponsePayload]>(
  'codeQuestionResponse'
);

/**
 * Question types that can be asked during code generation
 */
export type CodeQuestionType =
  | 'clarification'      // Pre-generation ambiguity
  | 'solution_choice'    // Post-failure multiple solutions
  | 'approval';          // Pre-PR human approval

/**
 * Option for a code question
 */
export interface CodeQuestionOption {
  /** Unique identifier for the option (e.g., 'A', 'B', 'C') */
  id: string;
  /** Short label for the option */
  label: string;
  /** Detailed description */
  description: string;
  /** Pros of this option */
  pros?: string[];
  /** Cons of this option */
  cons?: string[];
  /** Whether this is the recommended option */
  recommended?: boolean;
  /** Estimated effort level */
  effort?: 'low' | 'medium' | 'high';
}

/**
 * Code preview for approval questions
 */
export interface CodePreview {
  /** Files that will be created/modified/deleted */
  files: Array<{
    path: string;
    action: 'create' | 'modify' | 'delete';
    /** Diff preview for modified files */
    diffPreview?: string;
    /** Full content preview for new files (truncated) */
    contentPreview?: string;
    /** Lines added */
    linesAdded?: number;
    /** Lines removed */
    linesRemoved?: number;
  }>;
  /** Summary of changes */
  summary: string;
  /** Total files affected */
  totalFiles: number;
  /** Total lines changed */
  totalLinesChanged: number;
}

/**
 * Metadata about the question context
 */
export interface CodeQuestionMetadata {
  /** Workflow ID that posted the question */
  workflowId: string;
  /** Current step number */
  stepNumber: number;
  /** Total steps in workflow */
  totalSteps: number;
  /** Context description */
  context: string;
  /** When the question was posted */
  postedAt: Date;
  /** Timeout duration in hours */
  timeoutHours: number;
  /** Task identifier (e.g., DEV-123) */
  taskIdentifier: string;
}
