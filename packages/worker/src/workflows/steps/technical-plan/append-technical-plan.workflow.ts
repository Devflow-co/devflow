/**
 * Append Technical Plan Step Workflow
 *
 * Creates/updates the Technical Plan as a Linear Document linked to the issue.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type { AppendTechnicalPlanOutput } from '../../types';

const { appendTechnicalPlanToLinearIssue } = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

// Input type matches activity (projectId, linearId, plan, contextUsed?, council?, bestPractices?)
export async function appendTechnicalPlanWorkflow(input: any): Promise<AppendTechnicalPlanOutput> {
  return appendTechnicalPlanToLinearIssue(input);
}
