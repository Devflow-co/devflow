/**
 * Update Linear Status Step Workflow
 *
 * Updates the status of a Linear issue.
 * Used for status transitions (In Progress, Ready, Failed).
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type { UpdateLinearStatusInput, UpdateLinearStatusOutput } from '../../types';

const { updateLinearTask } = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

export async function updateLinearStatusWorkflow(
  input: UpdateLinearStatusInput
): Promise<UpdateLinearStatusOutput> {
  await updateLinearTask({
    projectId: input.projectId,
    linearId: input.linearId,
    updates: { status: input.status },
  });

  return { success: true };
}
