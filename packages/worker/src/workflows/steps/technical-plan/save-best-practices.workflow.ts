/**
 * Save Best Practices Step Workflow
 *
 * Saves best practices as a Linear Document linked to the issue.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type { SaveBestPracticesInput, SaveBestPracticesOutput } from '../../types';

const { saveBestPracticesDocument } = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

export async function saveBestPracticesWorkflow(
  input: SaveBestPracticesInput
): Promise<SaveBestPracticesOutput> {
  return saveBestPracticesDocument(input);
}
