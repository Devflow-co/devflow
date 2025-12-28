/**
 * Save External Context Step Workflow
 *
 * Saves external context (Figma, Sentry, GitHub Issue) as Linear Documents.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type { SaveExternalContextInput, SaveExternalContextOutput } from '../../types';

const { saveExternalContextDocuments } = proxyActivities<typeof activities>({
  startToCloseTimeout: '3 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

export async function saveExternalContextWorkflow(
  input: SaveExternalContextInput
): Promise<SaveExternalContextOutput> {
  return saveExternalContextDocuments(input);
}
