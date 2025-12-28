/**
 * Post PO Questions Step Workflow
 *
 * Posts questions for the Product Owner as Linear comments.
 * Each question becomes a separate comment for easy threading.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type { PostPOQuestionsInput, PostPOQuestionsOutput } from '../../types';

const { postQuestionsAsComments } = proxyActivities<typeof activities>({
  startToCloseTimeout: '3 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

export async function postPOQuestionsWorkflow(
  input: PostPOQuestionsInput
): Promise<PostPOQuestionsOutput> {
  return postQuestionsAsComments(input);
}
