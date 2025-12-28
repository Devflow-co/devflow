/**
 * Create Subtasks Step Workflow
 *
 * Creates Linear sub-issues from refinement split suggestion.
 * Called when complexity is L or XL.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type { CreateSubtasksInput, CreateSubtasksOutput } from '../../types';

const { createLinearSubtasks } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

export async function createSubtasksWorkflow(
  input: CreateSubtasksInput
): Promise<CreateSubtasksOutput> {
  return createLinearSubtasks(input);
}
