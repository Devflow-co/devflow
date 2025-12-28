/**
 * Generate User Story Step Workflow
 *
 * Generates a formal user story using AI.
 * This is the core AI generation step of Phase 2.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';

const { generateUserStory } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

// Input/output types match activity types (GenerateUserStoryInput/Output)
export async function generateUserStoryWorkflow(input: any): Promise<any> {
  return generateUserStory(input);
}
