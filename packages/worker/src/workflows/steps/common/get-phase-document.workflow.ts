/**
 * Get Phase Document Step Workflow
 *
 * Retrieves a Linear Document for a specific phase.
 * Used to get context from previous phases (User Story, Codebase Context, etc.).
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type { GetPhaseDocumentInput, GetPhaseDocumentOutput } from '../../types';

const { getPhaseDocumentContent } = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

export async function getPhaseDocumentWorkflow(
  input: GetPhaseDocumentInput
): Promise<GetPhaseDocumentOutput> {
  return getPhaseDocumentContent(input);
}
