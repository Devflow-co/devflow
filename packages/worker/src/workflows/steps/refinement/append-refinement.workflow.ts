/**
 * Append Refinement Step Workflow
 *
 * Appends the refinement content to the Linear issue description.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type { AppendRefinementOutput } from '../../types';

const { appendRefinementToLinearIssue } = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

// Input type matches activity (projectId, linearId, refinement, council?)
export async function appendRefinementWorkflow(input: any): Promise<AppendRefinementOutput> {
  await appendRefinementToLinearIssue(input);
  return { success: true };
}
