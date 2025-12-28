/**
 * Update Task Content Step Workflow
 *
 * Updates the Linear issue title and/or description.
 * Used to apply reformulated title/description after refinement.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type { UpdateTaskContentInput, UpdateTaskContentOutput } from '../../types';

const { updateLinearTask } = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

export async function updateTaskContentWorkflow(
  input: UpdateTaskContentInput
): Promise<UpdateTaskContentOutput> {
  await updateLinearTask({
    projectId: input.projectId,
    linearId: input.linearId,
    updates: {
      title: input.title,
      description: input.description,
    },
  });

  return { success: true };
}
