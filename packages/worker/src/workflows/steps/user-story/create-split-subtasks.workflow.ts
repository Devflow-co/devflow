/**
 * Create Split Subtasks Step Workflow
 *
 * Creates sub-issues when task is split during User Story phase.
 * Sets initial status to "To Refinement" for the new sub-issues.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type { CreateSplitSubtasksInput, CreateSplitSubtasksOutput } from '../../types';

const { createLinearSubtasks } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

export async function createSplitSubtasksWorkflow(
  input: CreateSplitSubtasksInput
): Promise<CreateSplitSubtasksOutput> {
  return createLinearSubtasks(input);
}
