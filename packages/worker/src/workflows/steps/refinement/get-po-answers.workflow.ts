/**
 * Get PO Answers Step Workflow
 *
 * Retrieves existing Product Owner answers for a task.
 * Used to inject previous answers into refinement prompt on re-run.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type { GetPOAnswersInput, GetPOAnswersOutput } from '../../types';

const { getPOAnswersForTask } = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

export async function getPOAnswersWorkflow(
  input: GetPOAnswersInput
): Promise<GetPOAnswersOutput> {
  return getPOAnswersForTask(input);
}
