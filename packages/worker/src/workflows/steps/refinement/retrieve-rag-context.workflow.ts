/**
 * Retrieve RAG Context Step Workflow
 *
 * Retrieves relevant code context from the RAG index.
 * Used to provide codebase-aware refinement.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type { RetrieveRagContextInput, RetrieveRagContextOutput } from '../../types';

const { retrieveContext } = proxyActivities<typeof activities>({
  startToCloseTimeout: '3 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

export async function retrieveRagContextWorkflow(
  input: RetrieveRagContextInput
): Promise<RetrieveRagContextOutput | null> {
  return retrieveContext(input);
}
