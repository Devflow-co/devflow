/**
 * Generate Technical Plan Step Workflow
 *
 * Generates a detailed technical implementation plan using AI.
 * This is the core AI generation step of Phase 3.
 * Supports Council AI for multi-model deliberation.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';

const { generateTechnicalPlan } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes', // AI generation takes time, especially with Council AI
  retry: {
    maximumAttempts: 3,
  },
});

// Input/output types match activity types (GenerateTechnicalPlanInput/Output)
export async function generateTechnicalPlanWorkflow(input: any): Promise<any> {
  return generateTechnicalPlan(input);
}
