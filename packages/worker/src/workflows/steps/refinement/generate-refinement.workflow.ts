/**
 * Generate Refinement Step Workflow
 *
 * Generates backlog refinement using AI.
 * This is the core AI generation step of Phase 1.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';

const { generateRefinement } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

// Input/output types match activity types (GenerateRefinementInput/Output)
export async function generateRefinementWorkflow(input: any): Promise<any> {
  return generateRefinement(input);
}
