/**
 * Add Task Type Label Step Workflow
 *
 * Adds a label (feature/bug/enhancement/chore) to the Linear issue.
 * Non-blocking: Continues workflow even if labeling fails.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type { AddTaskTypeLabelInput, AddTaskTypeLabelOutput } from '../../types';

const { addTaskTypeLabel } = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    maximumAttempts: 2,
  },
});

export async function addTaskTypeLabelWorkflow(
  input: AddTaskTypeLabelInput
): Promise<AddTaskTypeLabelOutput> {
  return addTaskTypeLabel(input);
}
