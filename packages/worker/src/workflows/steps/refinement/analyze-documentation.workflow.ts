/**
 * Analyze Documentation Step Workflow
 *
 * Analyzes project structure, dependencies, and documentation.
 * Provides context about the project for better refinement.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type { AnalyzeDocumentationInput } from '../../types';

const { analyzeProjectContext } = proxyActivities<typeof activities>({
  startToCloseTimeout: '3 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

// Output type matches activity return type (AnalyzeProjectContextOutput)
export async function analyzeDocumentationWorkflow(input: AnalyzeDocumentationInput): Promise<any> {
  return analyzeProjectContext(input);
}
