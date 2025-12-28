/**
 * Sync Linear Task Step Workflow
 *
 * Fetches task details from Linear API.
 * Used as the first step in all phase workflows.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type { SyncLinearTaskInput, SyncLinearTaskOutput } from '../../types';

const { syncLinearTask } = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

export async function syncLinearTaskWorkflow(
  input: SyncLinearTaskInput
): Promise<SyncLinearTaskOutput> {
  return syncLinearTask(input);
}
