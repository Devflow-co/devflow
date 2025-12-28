/**
 * Save Documentation Context Step Workflow
 *
 * Saves project documentation context as a Linear Document for reuse.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';
import type { SaveDocumentationContextOutput } from '../../types';

const { saveDocumentationContextDocument } = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

// Input type matches activity (projectId, linearId, context, taskContext?)
export async function saveDocumentationContextWorkflow(input: any): Promise<SaveDocumentationContextOutput> {
  return saveDocumentationContextDocument(input);
}
