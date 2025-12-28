/**
 * Append User Story Step Workflow
 *
 * Creates/updates the User Story as a Linear Document linked to the issue.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type { AppendUserStoryInput, AppendUserStoryOutput } from '../../types';

const { appendUserStoryToLinearIssue } = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

export async function appendUserStoryWorkflow(
  input: AppendUserStoryInput
): Promise<AppendUserStoryOutput> {
  return appendUserStoryToLinearIssue(input);
}
