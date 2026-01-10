/**
 * Interactive Activities - Phase 4 V3
 *
 * Activities for posting questions and handling human interaction
 * during code generation workflow.
 */

import {
  CodeQuestionType,
  CodeQuestionOption,
  CodePreview,
  CodeQuestionMetadata,
} from '../workflows/signals/code-question-response.signal';
import { getLinearClient } from './linear.activities';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// ============================================
// Types
// ============================================

export interface PostCodeQuestionInput {
  /** Project ID */
  projectId: string;
  /** Task ID (internal) */
  taskId: string;
  /** Linear issue ID */
  linearId: string;
  /** Type of question */
  questionType: CodeQuestionType;
  /** The main question text */
  question: string;
  /** Available options (for clarification/solution_choice) */
  options?: CodeQuestionOption[];
  /** Code preview (for approval questions) */
  preview?: CodePreview;
  /** Question metadata */
  metadata: CodeQuestionMetadata;
}

export interface PostCodeQuestionOutput {
  /** Generated question ID */
  questionId: string;
  /** Linear comment ID where question was posted */
  commentId: string;
  /** Indicates workflow should wait for response */
  waitingForResponse: true;
}

export interface GenerateCodePreviewInput {
  /** Generated files to preview */
  files: Array<{
    path: string;
    action: 'create' | 'modify' | 'delete';
    content: string;
    originalContent?: string;
  }>;
  /** Summary of changes */
  summary: string;
}

export interface GenerateCodePreviewOutput {
  /** Generated preview */
  preview: CodePreview;
}

export interface RecordQuestionInput {
  /** Question ID */
  questionId: string;
  /** Project ID */
  projectId: string;
  /** Task ID */
  taskId: string;
  /** Workflow ID waiting for response */
  workflowId: string;
  /** Question type */
  questionType: CodeQuestionType;
  /** Linear comment ID */
  commentId: string;
  /** Timeout timestamp */
  timeoutAt: Date;
}

// ============================================
// Activities
// ============================================

/**
 * Post a question to Linear as a comment on the task
 */
export async function postCodeQuestion(
  input: PostCodeQuestionInput
): Promise<PostCodeQuestionOutput> {
  const { projectId, linearId, questionType, question, options, preview, metadata } = input;

  // Generate unique question ID
  const questionId = uuidv4();

  // Build the comment body
  const commentBody = buildQuestionComment({
    questionId,
    questionType,
    question,
    options,
    preview,
    metadata,
  });

  // Get Linear client and post comment
  const linearClient = await getLinearClient(projectId);
  const commentId = await linearClient.addComment(linearId, commentBody);

  if (!commentId) {
    throw new Error('Failed to post question comment to Linear');
  }

  // Record the pending question in database for webhook lookup
  await recordPendingQuestion({
    questionId,
    projectId,
    taskId: input.taskId,
    workflowId: metadata.workflowId,
    questionType,
    commentId,
    timeoutAt: new Date(Date.now() + metadata.timeoutHours * 60 * 60 * 1000),
  });

  return {
    questionId,
    commentId,
    waitingForResponse: true,
  };
}

/**
 * Record a pending question for webhook lookup
 */
async function recordPendingQuestion(input: RecordQuestionInput): Promise<void> {
  // Store in database for webhook handler to find
  await prisma.pendingCodeQuestion.create({
    data: {
      id: input.questionId,
      projectId: input.projectId,
      taskId: input.taskId,
      workflowId: input.workflowId,
      questionType: input.questionType,
      commentId: input.commentId,
      timeoutAt: input.timeoutAt,
      status: 'pending',
      createdAt: new Date(),
    },
  });
}

/**
 * Generate a code preview for approval questions
 */
export async function generateCodePreview(
  input: GenerateCodePreviewInput
): Promise<GenerateCodePreviewOutput> {
  const { files, summary } = input;

  let totalLinesAdded = 0;
  let totalLinesRemoved = 0;

  const previewFiles = files.map((file) => {
    const lines = file.content.split('\n');
    const originalLines = file.originalContent?.split('\n') || [];

    let linesAdded = 0;
    let linesRemoved = 0;
    let diffPreview = '';
    let contentPreview = '';

    if (file.action === 'create') {
      linesAdded = lines.length;
      // Show first 30 lines of new file
      contentPreview = lines.slice(0, 30).join('\n');
      if (lines.length > 30) {
        contentPreview += `\n// ... ${lines.length - 30} more lines`;
      }
    } else if (file.action === 'modify') {
      // Generate simple diff preview
      const diff = generateSimpleDiff(originalLines, lines);
      linesAdded = diff.added;
      linesRemoved = diff.removed;
      diffPreview = diff.preview;
    } else if (file.action === 'delete') {
      linesRemoved = originalLines.length;
      diffPreview = `- (${linesRemoved} lines deleted)`;
    }

    totalLinesAdded += linesAdded;
    totalLinesRemoved += linesRemoved;

    return {
      path: file.path,
      action: file.action,
      diffPreview: diffPreview || undefined,
      contentPreview: contentPreview || undefined,
      linesAdded,
      linesRemoved,
    };
  });

  return {
    preview: {
      files: previewFiles,
      summary,
      totalFiles: files.length,
      totalLinesChanged: totalLinesAdded + totalLinesRemoved,
    },
  };
}

/**
 * Mark a pending question as answered
 */
export async function markQuestionAnswered(
  questionId: string,
  response: {
    responseType: string;
    selectedOption?: string;
    customText?: string;
    respondedBy: string;
  }
): Promise<void> {
  await prisma.pendingCodeQuestion.update({
    where: { id: questionId },
    data: {
      status: 'answered',
      responseType: response.responseType,
      selectedOption: response.selectedOption,
      customText: response.customText,
      respondedBy: response.respondedBy,
      respondedAt: new Date(),
    },
  });
}

/**
 * Mark a pending question as timed out
 */
export async function markQuestionTimedOut(questionId: string): Promise<void> {
  await prisma.pendingCodeQuestion.update({
    where: { id: questionId },
    data: {
      status: 'timeout',
      respondedAt: new Date(),
    },
  });
}

/**
 * Find a pending question by Linear issue ID
 */
export async function findPendingQuestionByIssue(
  linearId: string
): Promise<{
  questionId: string;
  workflowId: string;
  questionType: CodeQuestionType;
} | null> {
  // First get the task by linearId
  const task = await prisma.task.findFirst({
    where: { linearId },
  });

  if (!task) return null;

  // Then find pending question for this task
  const question = await prisma.pendingCodeQuestion.findFirst({
    where: {
      taskId: task.id,
      status: 'pending',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!question) return null;

  return {
    questionId: question.id,
    workflowId: question.workflowId,
    questionType: question.questionType as CodeQuestionType,
  };
}

// ============================================
// Helper Functions
// ============================================

interface BuildQuestionCommentInput {
  questionId: string;
  questionType: CodeQuestionType;
  question: string;
  options?: CodeQuestionOption[];
  preview?: CodePreview;
  metadata: CodeQuestionMetadata;
}

function buildQuestionComment(input: BuildQuestionCommentInput): string {
  const { questionId, questionType, question, options, preview, metadata } = input;

  const typeLabels: Record<CodeQuestionType, string> = {
    clarification: 'Design Clarification',
    solution_choice: 'Solution Choice',
    approval: 'Approval Request',
  };

  let comment = `## DevFlow Code Generation Question\n\n`;
  comment += `**Type:** ${typeLabels[questionType]}\n\n`;
  comment += `### Question\n${question}\n\n`;

  // Add options section for clarification/solution_choice
  if (options && options.length > 0) {
    comment += `### Options\n`;
    comment += `Reply with \`OPTION:X\` where X is the option letter:\n\n`;

    for (const option of options) {
      comment += `**${option.id}) ${option.label}**${option.recommended ? ' (Recommended)' : ''}\n`;
      if (option.description) {
        comment += `${option.description}\n`;
      }
      if (option.pros && option.pros.length > 0) {
        comment += option.pros.map((p) => `- ${p}`).join('\n') + '\n';
      }
      if (option.cons && option.cons.length > 0) {
        comment += option.cons.map((c) => `- ${c}`).join('\n') + '\n';
      }
      comment += '\n';
    }

    comment += `**Custom Response:**\nReply with your preferred approach if neither option fits.\n\n`;
  }

  // Add preview section for approval
  if (preview) {
    comment += `### Files to be committed (${preview.totalFiles} files)\n\n`;

    for (const file of preview.files) {
      const actionSymbol = file.action === 'create' ? '+' : file.action === 'delete' ? '-' : '~';
      comment += `**${actionSymbol} ${file.path}** (${file.action})\n`;

      if (file.diffPreview) {
        comment += '```diff\n' + file.diffPreview + '\n```\n';
      } else if (file.contentPreview) {
        // Detect language from file extension
        const ext = file.path.split('.').pop() || '';
        const lang = getLanguageFromExtension(ext);
        comment += '```' + lang + '\n' + file.contentPreview + '\n```\n';
      }
      comment += '\n';
    }

    comment += `### Summary\n${preview.summary}\n\n`;
    comment += `---\n**Reply with:**\n`;
    comment += `- \`APPROVE\` to create the PR\n`;
    comment += `- \`REJECT:reason\` to request changes\n\n`;
  }

  // Add metadata footer
  comment += `---\n`;
  comment += `_Workflow: ${metadata.workflowId.substring(0, 16)}... | `;
  comment += `Step: ${metadata.stepNumber}/${metadata.totalSteps} | `;
  comment += `Timeout: ${metadata.timeoutHours}h | `;
  comment += `ID: ${questionId.substring(0, 8)}_\n`;

  return comment;
}

function generateSimpleDiff(
  original: string[],
  modified: string[]
): { added: number; removed: number; preview: string } {
  // Simple diff: show up to 20 lines of changes
  const maxLines = 20;
  const diffLines: string[] = [];
  let added = 0;
  let removed = 0;

  // Find differences (simple line-by-line comparison)
  const originalSet = new Set(original);
  const modifiedSet = new Set(modified);

  // Lines only in original (removed)
  for (const line of original) {
    if (!modifiedSet.has(line) && line.trim()) {
      removed++;
      if (diffLines.length < maxLines) {
        diffLines.push(`- ${line}`);
      }
    }
  }

  // Lines only in modified (added)
  for (const line of modified) {
    if (!originalSet.has(line) && line.trim()) {
      added++;
      if (diffLines.length < maxLines) {
        diffLines.push(`+ ${line}`);
      }
    }
  }

  let preview = diffLines.join('\n');
  if (added + removed > maxLines) {
    preview += `\n... and ${added + removed - maxLines} more changes`;
  }

  return { added, removed, preview };
}

function getLanguageFromExtension(ext: string): string {
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    cs: 'csharp',
    cpp: 'cpp',
    c: 'c',
    php: 'php',
    vue: 'vue',
    svelte: 'svelte',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
  };

  return languageMap[ext] || '';
}
