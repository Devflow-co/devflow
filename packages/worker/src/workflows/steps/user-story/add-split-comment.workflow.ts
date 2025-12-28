/**
 * Add Split Comment Step Workflow
 *
 * Adds a comment explaining the task split to the parent issue.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type { AddSplitCommentInput, AddSplitCommentOutput } from '../../types';

const { addCommentToLinearIssue } = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

export async function addSplitCommentWorkflow(
  input: AddSplitCommentInput
): Promise<AddSplitCommentOutput> {
  return addCommentToLinearIssue(input);
}
