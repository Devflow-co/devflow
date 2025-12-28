/**
 * User Story Orchestrator - Phase 2 of Three-Phase Agile Workflow
 *
 * Coordinates all user story step workflows:
 * 1. Sync task from Linear
 * 2. Update status to In Progress (conditional)
 * 3. Extract refinement from description (local function)
 * 4. Get codebase context document (conditional)
 * 5. Get documentation context document (conditional)
 * 6. Check for task split (conditional)
 *    6a. Create split subtasks
 *    6b. Add split comment
 * 7. Generate user story (AI)
 * 8. Append user story to issue
 * 9. Update status to Ready (conditional)
 */

import { executeChild, ApplicationFailure } from '@temporalio/workflow';
import type { WorkflowConfig, UserStoryPhaseConfig } from '@devflow/common';
import { DEFAULT_WORKFLOW_CONFIG, DEFAULT_AUTOMATION_CONFIG } from '@devflow/common';

// Import step workflows
import { syncLinearTaskWorkflow } from '../steps/common/sync-linear-task.workflow';
import { updateLinearStatusWorkflow } from '../steps/common/update-linear-status.workflow';
import { getPhaseDocumentWorkflow } from '../steps/common/get-phase-document.workflow';
import { generateUserStoryWorkflow } from '../steps/user-story/generate-user-story.workflow';
import { appendUserStoryWorkflow } from '../steps/user-story/append-user-story.workflow';
import { createSplitSubtasksWorkflow } from '../steps/user-story/create-split-subtasks.workflow';
import { addSplitCommentWorkflow } from '../steps/user-story/add-split-comment.workflow';

export interface UserStoryOrchestratorInput {
  taskId: string;
  projectId: string;
  config?: WorkflowConfig;
}

export interface UserStoryOrchestratorResult {
  success: boolean;
  phase: 'user_story';
  message: string;
  userStory?: any;
  split?: boolean;
  subIssuesCreated?: Array<{ index: number; issueId: string; identifier: string; title: string }>;
}

/** Valid task types */
type TaskType = 'feature' | 'bug' | 'enhancement' | 'chore';

/** Valid complexity estimates */
type ComplexityEstimate = 'XS' | 'S' | 'M' | 'L' | 'XL';

/** Parsed suggested split from refinement */
interface ParsedSuggestedSplit {
  reason: string;
  proposedStories: Array<{
    title: string;
    description: string;
    dependencies?: number[];
    acceptanceCriteria?: string[];
  }>;
}

/** Parsed refinement from description */
interface ParsedRefinement {
  taskType: TaskType;
  suggestedTitle: string;
  reformulatedDescription: string;
  businessContext: string;
  objectives: string[];
  preliminaryAcceptanceCriteria: string[];
  complexityEstimate: ComplexityEstimate;
  suggestedSplit?: ParsedSuggestedSplit;
}

/**
 * Extract refinement from Linear issue description
 */
function extractRefinementFromDescription(description: string): ParsedRefinement {
  let refinementText = '';

  const collapsibleMatch = description.match(
    /<details[^>]*>\s*<summary[^>]*>📋 Backlog Refinement<\/summary>([\s\S]*?)<\/details>/
  );
  if (collapsibleMatch) {
    refinementText = collapsibleMatch[1];
  } else {
    const h1Match = description.match(/# Backlog Refinement[\s\S]*?(?=\n# |$)/);
    if (h1Match) {
      refinementText = h1Match[0];
    }
  }

  if (!refinementText) {
    return {
      taskType: 'feature' as TaskType,
      suggestedTitle: '',
      reformulatedDescription: description,
      businessContext: description,
      objectives: [],
      preliminaryAcceptanceCriteria: [],
      complexityEstimate: 'M' as ComplexityEstimate,
    };
  }

  const taskTypeMatch = refinementText.match(/\*\*Type:\*\* [^\s]+ (\w+)/);
  const rawTaskType = taskTypeMatch ? taskTypeMatch[1].toLowerCase() : 'feature';
  const validTaskTypes: TaskType[] = ['feature', 'bug', 'enhancement', 'chore'];
  const taskType: TaskType = validTaskTypes.includes(rawTaskType as TaskType)
    ? (rawTaskType as TaskType)
    : 'feature';

  const contextMatch = refinementText.match(/###?\s*Business Context\n\n?([\s\S]*?)(?=\n###? |$)/);
  const businessContext = contextMatch ? contextMatch[1].trim() : '';

  const objectivesMatch = refinementText.match(/###?\s*Objectives\n\n?([\s\S]*?)(?=\n###? |$)/);
  const objectives = objectivesMatch
    ? objectivesMatch[1]
        .split('\n')
        .filter((line) => line.match(/^\d+\./))
        .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    : [];

  const criteriaMatch = refinementText.match(
    /###?\s*Preliminary Acceptance Criteria\n\n?([\s\S]*?)(?=\n###? |$)/
  );
  const preliminaryAcceptanceCriteria = criteriaMatch
    ? criteriaMatch[1]
        .split('\n')
        .filter((line) => line.match(/^\d+\./))
        .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    : [];

  const complexityMatch = refinementText.match(/\*\*(XS|S|M|L|XL)\*\*/);
  const complexityEstimate: ComplexityEstimate = complexityMatch
    ? (complexityMatch[1] as ComplexityEstimate)
    : 'M';

  const suggestedSplit = extractSuggestedSplit(refinementText);

  return {
    taskType,
    suggestedTitle: '',
    reformulatedDescription: '',
    businessContext,
    objectives,
    preliminaryAcceptanceCriteria,
    complexityEstimate,
    suggestedSplit,
  };
}

/**
 * Extract suggested split from refinement markdown
 */
function extractSuggestedSplit(refinementText: string): ParsedSuggestedSplit | undefined {
  const splitMatch = refinementText.match(
    /###?\s*🔀 Suggested Split\n\n?([\s\S]*?)(?=\n###?\s*Complexity Estimate|$)/
  );
  if (!splitMatch) {
    return undefined;
  }

  const splitText = splitMatch[1];

  const reasonMatch = splitText.match(/\*\*Reason:\*\*\s*(.+?)(?:\n|$)/);
  const reason = reasonMatch ? reasonMatch[1].trim() : '';

  if (!reason) {
    return undefined;
  }

  const proposedStories: ParsedSuggestedSplit['proposedStories'] = [];

  const storyBlocks = splitText.split(/####\s*\d+\.\s*/);

  for (let i = 1; i < storyBlocks.length; i++) {
    const block = storyBlocks[i].trim();
    if (!block) continue;

    const lines = block.split('\n');
    const title = lines[0].trim();

    const descMatch = block.match(
      /^[^\n]+\n\n?([\s\S]*?)(?=\n\*\*Dependencies:\*\*|\n\*\*Acceptance Criteria:\*\*|$)/
    );
    const description = descMatch ? descMatch[1].trim() : '';

    const dependencies: number[] = [];
    const depsMatch = block.match(/\*\*Dependencies:\*\*([\s\S]*?)(?=\n\*\*Acceptance Criteria:\*\*|$)/);
    if (depsMatch) {
      const depLines = depsMatch[1].match(/- Depends on:\s*(.+)/g);
      if (depLines) {
        depLines.forEach((depLine) => {
          const depTitleMatch = depLine.match(/- Depends on:\s*(.+)/);
          if (depTitleMatch) {
            const depTitle = depTitleMatch[1].trim();
            const depIndex = proposedStories.findIndex((s) => s.title === depTitle);
            if (depIndex >= 0) {
              dependencies.push(depIndex);
            }
          }
        });
      }
    }

    const acceptanceCriteria: string[] = [];
    const acMatch = block.match(/\*\*Acceptance Criteria:\*\*([\s\S]*?)$/);
    if (acMatch) {
      const acLines = acMatch[1]
        .split('\n')
        .filter((line) => line.match(/^\d+\./))
        .map((line) => line.replace(/^\d+\.\s*/, '').trim());
      acceptanceCriteria.push(...acLines);
    }

    proposedStories.push({
      title,
      description,
      dependencies: dependencies.length > 0 ? dependencies : undefined,
      acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : undefined,
    });
  }

  if (proposedStories.length === 0) {
    return undefined;
  }

  return {
    reason,
    proposedStories,
  };
}

/**
 * Format split comment for parent issue
 */
function formatSplitComment(
  suggestedSplit: ParsedSuggestedSplit,
  subIssuesResult: {
    created: Array<{ index: number; issueId: string; identifier: string; title: string }>;
    failed: Array<{ index: number; title: string; error: string }>;
  }
): string {
  const lines: string[] = [];

  lines.push('🔀 **This task has been split into sub-issues**');
  lines.push('');
  lines.push(`> ${suggestedSplit.reason}`);
  lines.push('');

  if (subIssuesResult.created.length > 0) {
    lines.push('### Sub-Issues Created');
    lines.push('');
    lines.push('| # | Issue | Title |');
    lines.push('|---|-------|-------|');

    subIssuesResult.created.forEach((issue, idx) => {
      lines.push(`| ${idx + 1} | ${issue.identifier} | ${issue.title} |`);
    });
    lines.push('');
  }

  if (subIssuesResult.failed.length > 0) {
    lines.push('### ⚠️ Failed Sub-Issues');
    lines.push('');
    subIssuesResult.failed.forEach((failure) => {
      lines.push(`- **${failure.title}**: ${failure.error}`);
    });
    lines.push('');
  }

  lines.push('Each sub-issue will go through its own refinement → user story → technical plan cycle.');
  lines.push('');
  lines.push('---');
  lines.push('*Generated by DevFlow*');

  return lines.join('\n');
}

export async function userStoryOrchestrator(
  input: UserStoryOrchestratorInput
): Promise<UserStoryOrchestratorResult> {
  const config = input.config || DEFAULT_WORKFLOW_CONFIG;
  const LINEAR_STATUSES = config.linear.statuses;

  // Get automation config with defaults
  const automation: UserStoryPhaseConfig =
    config.automation?.phases?.userStory || DEFAULT_AUTOMATION_CONFIG.phases.userStory;
  const features = automation.features;

  try {
    // Step 1: Sync task from Linear
    const task = await executeChild(syncLinearTaskWorkflow, {
      workflowId: `sync-task-${input.taskId}-${Date.now()}`,
      args: [{ taskId: input.taskId, projectId: input.projectId }],
    });

    // Step 2: Update status to UserStory In Progress (conditional)
    if (features.enableAutoStatusUpdate) {
      await executeChild(updateLinearStatusWorkflow, {
        workflowId: `status-in-progress-${input.taskId}-${Date.now()}`,
        args: [
          {
            projectId: input.projectId,
            linearId: task.linearId,
            status: LINEAR_STATUSES.userStoryInProgress,
          },
        ],
      });
    }

    // Step 3: Extract refinement from description (local function)
    const refinement = extractRefinementFromDescription(task.description);

    // Step 4: Get codebase context document (conditional)
    let codebaseContext: string | undefined;
    if (features.reuseCodebaseContext) {
      const codebaseContextDoc = await executeChild(getPhaseDocumentWorkflow, {
        workflowId: `get-codebase-${input.taskId}-${Date.now()}`,
        args: [
          {
            projectId: input.projectId,
            linearId: task.linearId,
            phase: 'codebase_context' as const,
          },
        ],
      });

      if (codebaseContextDoc.content) {
        codebaseContext = codebaseContextDoc.content;
      }
    }

    // Step 5: Get documentation context document (conditional)
    let documentationContext: string | undefined;
    if (features.reuseDocumentationContext) {
      const documentationContextDoc = await executeChild(getPhaseDocumentWorkflow, {
        workflowId: `get-docs-${input.taskId}-${Date.now()}`,
        args: [
          {
            projectId: input.projectId,
            linearId: task.linearId,
            phase: 'documentation_context' as const,
          },
        ],
      });

      if (documentationContextDoc.content) {
        documentationContext = documentationContextDoc.content;
      }
    }

    // Step 6: Check for task split (conditional)
    if (
      features.enableTaskSplitting &&
      refinement.suggestedSplit &&
      refinement.suggestedSplit.proposedStories.length > 0
    ) {
      // Step 6a: Create split subtasks
      const subIssuesResult = await executeChild(createSplitSubtasksWorkflow, {
        workflowId: `create-split-${input.taskId}-${Date.now()}`,
        args: [
          {
            projectId: input.projectId,
            parentIssueId: task.linearId,
            proposedStories: refinement.suggestedSplit.proposedStories,
            initialStatus: LINEAR_STATUSES.toRefinement,
          },
        ],
      });

      // Step 6b: Add split comment
      const splitComment = formatSplitComment(refinement.suggestedSplit, subIssuesResult);
      await executeChild(addSplitCommentWorkflow, {
        workflowId: `add-split-comment-${input.taskId}-${Date.now()}`,
        args: [
          {
            projectId: input.projectId,
            linearId: task.linearId,
            body: splitComment,
          },
        ],
      });

      // Update status to Ready (conditional)
      if (features.enableAutoStatusUpdate) {
        await executeChild(updateLinearStatusWorkflow, {
          workflowId: `status-ready-${input.taskId}-${Date.now()}`,
          args: [
            {
              projectId: input.projectId,
              linearId: task.linearId,
              status: LINEAR_STATUSES.userStoryReady,
            },
          ],
        });
      }

      return {
        success: true,
        phase: 'user_story',
        message: `Task ${task.identifier} split into ${subIssuesResult.created.length} sub-issues`,
        split: true,
        subIssuesCreated: subIssuesResult.created,
      };
    }

    // Step 7: Generate user story (AI)
    const result = await executeChild(generateUserStoryWorkflow, {
      workflowId: `generate-user-story-${input.taskId}-${Date.now()}`,
      args: [
        {
          task: {
            title: task.title,
            description: task.description,
            priority: task.priority,
          },
          refinement,
          projectId: input.projectId,
          codebaseContext,
          documentationContext,
          aiModel: automation.aiModel,
        },
      ],
    });

    // Step 8: Append user story to issue
    await executeChild(appendUserStoryWorkflow, {
      workflowId: `append-user-story-${input.taskId}-${Date.now()}`,
      args: [
        {
          projectId: input.projectId,
          linearId: task.linearId,
          userStory: result.userStory,
        },
      ],
    });

    // Step 9: Update status to Ready (conditional)
    if (features.enableAutoStatusUpdate) {
      await executeChild(updateLinearStatusWorkflow, {
        workflowId: `status-ready-${input.taskId}-${Date.now()}`,
        args: [
          {
            projectId: input.projectId,
            linearId: task.linearId,
            status: LINEAR_STATUSES.userStoryReady,
          },
        ],
      });
    }

    return {
      success: true,
      phase: 'user_story',
      message: `User story generated for task ${task.identifier}`,
      userStory: result.userStory,
    };
  } catch (error) {
    // Update status to Failed (conditional)
    if (features.enableAutoStatusUpdate) {
      try {
        const task = await executeChild(syncLinearTaskWorkflow, {
          workflowId: `sync-task-error-${input.taskId}-${Date.now()}`,
          args: [{ taskId: input.taskId, projectId: input.projectId }],
        });

        await executeChild(updateLinearStatusWorkflow, {
          workflowId: `status-failed-${input.taskId}-${Date.now()}`,
          args: [
            {
              projectId: input.projectId,
              linearId: task.linearId,
              status: LINEAR_STATUSES.userStoryFailed,
            },
          ],
        });
      } catch (updateError) {
        console.error('[userStoryOrchestrator] Failed to update status to Failed:', updateError);
      }
    }

    throw ApplicationFailure.create({
      message: `User story orchestrator failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      type: 'UserStoryOrchestratorFailure',
      cause: error instanceof Error ? error : undefined,
    });
  }
}
