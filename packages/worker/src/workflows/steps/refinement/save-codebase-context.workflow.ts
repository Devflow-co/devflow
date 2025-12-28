/**
 * Save Codebase Context Step Workflow
 *
 * Saves RAG chunks as a Linear Document for reuse in later phases.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type { SaveCodebaseContextInput, SaveCodebaseContextOutput } from '../../types';

const { saveCodebaseContextDocument } = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

export async function saveCodebaseContextWorkflow(
  input: SaveCodebaseContextInput
): Promise<SaveCodebaseContextOutput> {
  return saveCodebaseContextDocument(input);
}
