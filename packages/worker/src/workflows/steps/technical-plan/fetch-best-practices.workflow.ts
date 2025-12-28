/**
 * Fetch Best Practices Step Workflow
 *
 * Fetches best practices from Perplexity for the task context.
 * Provides industry best practices for technical planning.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';

const { fetchBestPractices } = proxyActivities<typeof activities>({
  startToCloseTimeout: '3 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

// Input/output types match activity types (FetchBestPracticesInput/Output)
export async function fetchBestPracticesWorkflow(input: any): Promise<any> {
  return fetchBestPractices(input);
}
