/**
 * Context Extraction Activities
 *
 * Extract context from external sources (Figma, Sentry, GitHub Issues)
 * for use in the refinement workflow.
 */

import { createLogger, loadConfig } from '@devflow/common';
import {
  createFigmaClient,
  createSentryClient,
  GitHubProvider,
  createCodeAgentDriver,
  createLinearClient,
  formatFigmaContextDocument,
  formatSentryContextDocument,
  formatGitHubIssueContextDocument,
  type FigmaDesignContext,
  type FigmaScreenshot,
  type SentryIssueContext,
  type GitHubIssueContext,
} from '@devflow/sdk';
import { PrismaClient } from '@prisma/client';
import { oauthResolver } from '@/services/oauth-context';

const logger = createLogger('ContextExtractionActivities');

// ============================================
// Types
// ============================================

export interface ExternalContextLinks {
  figmaFileKey?: string;
  figmaNodeId?: string;
  sentryIssueId?: string;
  githubIssueRef?: string; // Format: "owner/repo#123"
}

export interface ExternalContext {
  figma?: FigmaDesignContext;
  sentry?: SentryIssueContext;
  githubIssue?: GitHubIssueContext;
}

export interface ExtractContextInput {
  projectId: string;
  links: ExternalContextLinks;
}

export interface ExtractContextOutput {
  context: ExternalContext;
  errors: Array<{
    source: 'figma' | 'sentry' | 'github_issues';
    error: string;
  }>;
}

// ============================================
// URL Parsing Functions
// ============================================

/**
 * Parse external links from Linear issue description
 * Extracts Figma, Sentry, and GitHub issue URLs
 */
export function parseExternalLinksFromDescription(
  description: string,
): ExternalContextLinks {
  const links: ExternalContextLinks = {};

  if (!description) return links;

  // Figma: https://www.figma.com/file/FILEKEY/... or https://www.figma.com/design/FILEKEY/...
  const figmaMatch = description.match(
    /figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/,
  );
  if (figmaMatch) {
    links.figmaFileKey = figmaMatch[1];
    // Optional: nodeId from ?node-id=...
    const nodeMatch = description.match(/node-id=([^&\s]+)/);
    if (nodeMatch) {
      links.figmaNodeId = decodeURIComponent(nodeMatch[1]);
    }
  }

  // Sentry: https://sentry.io/issues/123456 or https://org.sentry.io/issues/123456
  const sentryMatch = description.match(/sentry\.io\/issues\/(\d+)/);
  if (sentryMatch) {
    links.sentryIssueId = sentryMatch[1];
  }

  // GitHub Issue: https://github.com/owner/repo/issues/123
  const githubMatch = description.match(
    /github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/,
  );
  if (githubMatch) {
    links.githubIssueRef = `${githubMatch[1]}/${githubMatch[2]}#${githubMatch[3]}`;
  }

  logger.debug('Parsed external links from description', { links });

  return links;
}

/**
 * Check if any external links are present
 */
export function hasAnyLink(links: ExternalContextLinks): boolean {
  return !!(
    links.figmaFileKey ||
    links.sentryIssueId ||
    links.githubIssueRef
  );
}

// ============================================
// Vision Analysis Functions
// ============================================

/**
 * Analyze a Figma screenshot using a vision-capable AI model
 */
async function analyzeFigmaScreenshotWithVision(
  screenshot: FigmaScreenshot,
  config: { model: string; timeout: number },
): Promise<string> {
  if (!screenshot.imageBase64) {
    return '';
  }

  logger.info('Analyzing Figma screenshot with vision', {
    nodeName: screenshot.nodeName,
    nodeId: screenshot.nodeId,
    model: config.model,
    timeout: config.timeout,
  });

  try {
    const agent = createCodeAgentDriver({
      provider: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      model: config.model, // Use configured model instead of hard-coded
    });

    const response = await agent.generate({
      system: `You are a UI/UX design analyst. Your task is to analyze Figma design screenshots and provide detailed descriptions for developers.

Focus on:
- Layout structure and hierarchy
- UI components present (buttons, inputs, cards, navigation, etc.)
- Visual styling (colors, typography, spacing)
- Interactive elements and their states
- Accessibility considerations
- Implementation hints for developers

Be concise but thorough. Format your response as markdown.`,
      user: `Analyze this Figma design screenshot named "${screenshot.nodeName}".

Provide a detailed description that will help developers understand:
1. What this design represents
2. The key UI components
3. The layout structure
4. Any notable styling or interaction patterns`,
      images: [
        {
          type: 'base64',
          mediaType: 'image/png',
          data: screenshot.imageBase64,
        },
      ],
    });

    logger.info('Vision analysis complete', {
      nodeName: screenshot.nodeName,
      responseLength: response.content.length,
    });

    return response.content;
  } catch (error) {
    logger.warn('Failed to analyze screenshot with vision', {
      nodeName: screenshot.nodeName,
      error: error instanceof Error ? error.message : String(error),
    });
    return '';
  }
}

// ============================================
// Individual Context Extraction Functions
// ============================================

/**
 * Extract Figma design context with optional vision analysis
 */
async function extractFigmaContext(
  projectId: string,
  fileKey: string,
  nodeId?: string,
  config?: {
    enabled: boolean;
    model: string;
    maxScreenshots: number;
    timeout: number;
  },
): Promise<FigmaDesignContext> {
  // Fallback to default values if config not provided
  const visionConfig = config || {
    enabled: true,
    model: 'anthropic/claude-sonnet-4',
    maxScreenshots: 3,
    timeout: 30000,
  };

  logger.info('Extracting Figma context', {
    projectId,
    fileKey,
    nodeId,
    visionEnabled: visionConfig.enabled,
  });

  const token = await oauthResolver.resolveFigmaToken(projectId);
  const client = createFigmaClient(token);

  const context = await client.getDesignContext(fileKey, nodeId);

  // Analyze screenshots with vision if enabled and screenshots exist
  if (visionConfig.enabled && context.screenshots.length > 0) {
    logger.info('Analyzing screenshots with vision', {
      count: Math.min(context.screenshots.length, visionConfig.maxScreenshots),
      model: visionConfig.model,
    });

    // Use maxScreenshots from config
    const screenshotsToAnalyze = context.screenshots.slice(0, visionConfig.maxScreenshots);

    for (const screenshot of screenshotsToAnalyze) {
      if (screenshot.imageBase64) {
        screenshot.visionAnalysis = await analyzeFigmaScreenshotWithVision(screenshot, {
          model: visionConfig.model,
          timeout: visionConfig.timeout,
        });
      }
    }
  } else if (!visionConfig.enabled) {
    logger.info('Vision analysis disabled by configuration');
  }

  logger.info('Figma context extracted', {
    fileName: context.fileName,
    commentsCount: context.comments.length,
    screenshotsCount: context.screenshots.length,
    screenshotsWithVision: context.screenshots.filter(s => s.visionAnalysis).length,
  });

  return context;
}

/**
 * Extract Sentry issue context
 */
async function extractSentryContext(
  projectId: string,
  issueId: string,
): Promise<SentryIssueContext> {
  logger.info('Extracting Sentry context', { projectId, issueId });

  const token = await oauthResolver.resolveSentryToken(projectId);
  const client = createSentryClient(token);

  const context = await client.getIssueContext(issueId);

  logger.info('Sentry context extracted', {
    issueId: context.issueId,
    title: context.title,
    hasStacktrace: !!context.stacktrace,
  });

  return context;
}

/**
 * Extract GitHub issue context
 */
async function extractGitHubIssueContext(
  projectId: string,
  issueRef: string,
): Promise<GitHubIssueContext> {
  logger.info('Extracting GitHub issue context', { projectId, issueRef });

  // Parse issue reference: "owner/repo#123"
  const match = issueRef.match(/^([^/]+)\/([^#]+)#(\d+)$/);
  if (!match) {
    throw new Error(
      `Invalid GitHub issue reference: ${issueRef}. Expected format: owner/repo#123`,
    );
  }

  const [, owner, repo, issueNumber] = match;

  const token = await oauthResolver.resolveGitHubIssuesToken(projectId);
  const provider = new GitHubProvider(token);

  const context = await provider.getIssueContext(
    owner,
    repo,
    parseInt(issueNumber, 10),
  );

  logger.info('GitHub issue context extracted', {
    number: context.number,
    title: context.title,
    commentsCount: context.comments?.length || 0,
  });

  return context;
}

// ============================================
// Main Activity
// ============================================

/**
 * Extract all available external contexts
 *
 * This activity extracts context from Figma, Sentry, and GitHub Issues
 * based on the provided links. It handles errors gracefully and returns
 * partial results if some extractions fail.
 */
export async function extractExternalContext(
  input: ExtractContextInput,
): Promise<ExtractContextOutput> {
  // Load configuration at the beginning
  const config = loadConfig();

  logger.info('Extracting external context', {
    projectId: input.projectId,
    links: input.links,
  });

  const result: ExtractContextOutput = {
    context: {},
    errors: [],
  };

  // Extract Figma context if link provided
  if (input.links.figmaFileKey) {
    try {
      result.context.figma = await extractFigmaContext(
        input.projectId,
        input.links.figmaFileKey,
        input.links.figmaNodeId,
        {
          enabled: config.figma.vision.enabled,
          model: config.figma.vision.model,
          maxScreenshots: config.figma.vision.maxScreenshots,
          timeout: config.figma.vision.timeout,
        },
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('Failed to extract Figma context', { error: errorMessage });
      result.errors.push({
        source: 'figma',
        error: errorMessage,
      });
    }
  }

  // Extract Sentry context if link provided
  if (input.links.sentryIssueId) {
    try {
      result.context.sentry = await extractSentryContext(
        input.projectId,
        input.links.sentryIssueId,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('Failed to extract Sentry context', { error: errorMessage });
      result.errors.push({
        source: 'sentry',
        error: errorMessage,
      });
    }
  }

  // Extract GitHub issue context if link provided
  if (input.links.githubIssueRef) {
    try {
      result.context.githubIssue = await extractGitHubIssueContext(
        input.projectId,
        input.links.githubIssueRef,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('Failed to extract GitHub issue context', { error: errorMessage });
      result.errors.push({
        source: 'github_issues',
        error: errorMessage,
      });
    }
  }

  const extractedCount = Object.keys(result.context).length;
  logger.info('External context extraction complete', {
    extractedCount,
    errorsCount: result.errors.length,
  });

  return result;
}

// ============================================
// Context Formatting for Prompts
// ============================================

/**
 * Format external context as markdown for inclusion in prompts
 */
export function formatExternalContextAsMarkdown(context: ExternalContext): string {
  const sections: string[] = [];

  // Figma context
  if (context.figma) {
    const figma = context.figma;
    let section = `## Figma Design Context\n\n`;
    section += `**File:** ${figma.fileName}\n`;
    section += `**Last Modified:** ${figma.lastModified}\n\n`;

    if (figma.comments.length > 0) {
      section += `### Design Comments (${figma.comments.length})\n\n`;
      figma.comments.forEach((comment, i) => {
        section += `${i + 1}. **${comment.user.handle}**: ${comment.message}\n`;
      });
      section += '\n';
    }

    if (figma.screenshots.length > 0) {
      section += `### Screenshots & Design Analysis\n\n`;
      figma.screenshots.forEach((screenshot) => {
        section += `#### ${screenshot.nodeName}\n`;
        section += `Node ID: ${screenshot.nodeId}\n\n`;
        if (screenshot.visionAnalysis) {
          section += `**AI Design Analysis:**\n\n${screenshot.visionAnalysis}\n\n`;
        }
      });
    }

    sections.push(section);
  }

  // Sentry context
  if (context.sentry) {
    const sentry = context.sentry;
    let section = `## Sentry Error Context\n\n`;
    section += `**Issue:** ${sentry.shortId} - ${sentry.title}\n`;
    section += `**Level:** ${sentry.level} | **Status:** ${sentry.status}\n`;
    section += `**Platform:** ${sentry.platform}\n`;
    section += `**Occurrences:** ${sentry.count} | **Users Affected:** ${sentry.userCount}\n`;
    section += `**First Seen:** ${sentry.firstSeen} | **Last Seen:** ${sentry.lastSeen}\n\n`;

    if (sentry.errorType || sentry.errorMessage) {
      section += `### Error Details\n\n`;
      if (sentry.errorType) section += `**Type:** ${sentry.errorType}\n`;
      if (sentry.errorMessage) section += `**Message:** ${sentry.errorMessage}\n`;
      section += '\n';
    }

    if (sentry.stacktrace && sentry.stacktrace.frames.length > 0) {
      section += `### Stacktrace (Top ${sentry.stacktrace.frames.length} frames)\n\n`;
      section += '```\n';
      sentry.stacktrace.frames.forEach((frame) => {
        section += `${frame.filename}:${frame.lineNo} in ${frame.function}\n`;
      });
      section += '```\n\n';
    }

    if (sentry.tags.length > 0) {
      section += `### Tags\n\n`;
      sentry.tags.slice(0, 5).forEach((tag) => {
        section += `- **${tag.key}:** ${tag.value}\n`;
      });
      section += '\n';
    }

    sections.push(section);
  }

  // GitHub issue context
  if (context.githubIssue) {
    const issue = context.githubIssue;
    let section = `## GitHub Issue Context\n\n`;
    section += `**Issue:** #${issue.number} - ${issue.title}\n`;
    section += `**State:** ${issue.state} | **Author:** ${issue.author}\n`;
    section += `**URL:** ${issue.url}\n\n`;

    if (issue.labels.length > 0) {
      section += `**Labels:** ${issue.labels.join(', ')}\n`;
    }

    if (issue.body) {
      section += `### Issue Description\n\n${issue.body}\n\n`;
    }

    if (issue.comments && issue.comments.length > 0) {
      section += `### Discussion (${issue.comments.length} comments)\n\n`;
      issue.comments.slice(0, 5).forEach((comment, i) => {
        section += `**${comment.author}** (${comment.createdAt}):\n`;
        section += `> ${comment.body.slice(0, 200)}${comment.body.length > 200 ? '...' : ''}\n\n`;
      });
    }

    sections.push(section);
  }

  if (sections.length === 0) {
    return '';
  }

  return `# External Context\n\nThe following external context has been gathered to help with refinement:\n\n${sections.join('\n---\n\n')}`;
}

// ============================================
// Save External Context as Linear Documents
// ============================================

const prisma = new PrismaClient();

export interface SaveExternalContextDocumentsInput {
  projectId: string;
  linearId: string;
  context: ExternalContext;
  taskContext?: {
    title: string;
    identifier: string;
  };
}

export interface SaveExternalContextDocumentsOutput {
  figmaDocumentId?: string;
  sentryDocumentId?: string;
  githubIssueDocumentId?: string;
}

/**
 * Save external context as separate Linear Documents linked to the issue
 * Creates documents for each available context type (Figma, Sentry, GitHub Issue)
 * and updates the Task record with the document IDs
 */
export async function saveExternalContextDocuments(
  input: SaveExternalContextDocumentsInput,
): Promise<SaveExternalContextDocumentsOutput> {
  logger.info('Saving external context documents', {
    projectId: input.projectId,
    linearId: input.linearId,
    hasFigma: !!input.context.figma,
    hasSentry: !!input.context.sentry,
    hasGitHubIssue: !!input.context.githubIssue,
  });

  const result: SaveExternalContextDocumentsOutput = {};

  // Get Linear token for creating documents
  const linearToken = await oauthResolver.resolveLinearToken(input.projectId);
  const linearClient = createLinearClient(linearToken);

  // Save Figma context document
  if (input.context.figma) {
    try {
      const content = formatFigmaContextDocument({
        fileKey: input.context.figma.fileKey,
        fileName: input.context.figma.fileName,
        lastModified: input.context.figma.lastModified,
        thumbnailUrl: input.context.figma.thumbnailUrl,
        comments: input.context.figma.comments,
        screenshots: input.context.figma.screenshots,
        taskContext: input.taskContext,
      });

      const title = input.taskContext
        ? `${input.taskContext.identifier} - Figma Context`
        : 'Figma Context';

      const document = await linearClient.createIssueDocument({
        issueId: input.linearId,
        title,
        content,
      });

      result.figmaDocumentId = document.id;

      // Update Task in database
      await prisma.task.update({
        where: { linearId: input.linearId },
        data: { figmaContextDocumentId: document.id },
      });

      logger.info('Figma context document created', {
        documentId: document.id,
        title,
      });
    } catch (error) {
      logger.error('Failed to create Figma context document', error);
    }
  }

  // Save Sentry context document
  if (input.context.sentry) {
    try {
      const content = formatSentryContextDocument({
        issueId: input.context.sentry.issueId,
        shortId: input.context.sentry.shortId,
        title: input.context.sentry.title,
        culprit: input.context.sentry.culprit,
        level: input.context.sentry.level,
        status: input.context.sentry.status,
        platform: input.context.sentry.platform,
        count: input.context.sentry.count,
        userCount: input.context.sentry.userCount,
        firstSeen: input.context.sentry.firstSeen,
        lastSeen: input.context.sentry.lastSeen,
        project: input.context.sentry.project,
        errorType: input.context.sentry.errorType,
        errorMessage: input.context.sentry.errorMessage,
        stacktrace: input.context.sentry.stacktrace,
        tags: input.context.sentry.tags,
        taskContext: input.taskContext,
      });

      const title = input.taskContext
        ? `${input.taskContext.identifier} - Sentry Context`
        : 'Sentry Context';

      const document = await linearClient.createIssueDocument({
        issueId: input.linearId,
        title,
        content,
      });

      result.sentryDocumentId = document.id;

      // Update Task in database
      await prisma.task.update({
        where: { linearId: input.linearId },
        data: { sentryContextDocumentId: document.id },
      });

      logger.info('Sentry context document created', {
        documentId: document.id,
        title,
      });
    } catch (error) {
      logger.error('Failed to create Sentry context document', error);
    }
  }

  // Save GitHub Issue context document
  if (input.context.githubIssue) {
    try {
      const content = formatGitHubIssueContextDocument({
        id: input.context.githubIssue.id,
        number: input.context.githubIssue.number,
        title: input.context.githubIssue.title,
        state: input.context.githubIssue.state,
        body: input.context.githubIssue.body,
        author: input.context.githubIssue.author,
        url: input.context.githubIssue.url,
        labels: input.context.githubIssue.labels,
        assignees: input.context.githubIssue.assignees,
        createdAt: input.context.githubIssue.createdAt,
        updatedAt: input.context.githubIssue.updatedAt,
        closedAt: input.context.githubIssue.closedAt,
        comments: input.context.githubIssue.comments,
        taskContext: input.taskContext,
      });

      const title = input.taskContext
        ? `${input.taskContext.identifier} - GitHub Issue Context`
        : 'GitHub Issue Context';

      const document = await linearClient.createIssueDocument({
        issueId: input.linearId,
        title,
        content,
      });

      result.githubIssueDocumentId = document.id;

      // Update Task in database
      await prisma.task.update({
        where: { linearId: input.linearId },
        data: { githubIssueContextDocumentId: document.id },
      });

      logger.info('GitHub Issue context document created', {
        documentId: document.id,
        title,
      });
    } catch (error) {
      logger.error('Failed to create GitHub Issue context document', error);
    }
  }

  const createdCount = Object.keys(result).length;
  logger.info('External context documents saved', {
    createdCount,
    figma: !!result.figmaDocumentId,
    sentry: !!result.sentryDocumentId,
    githubIssue: !!result.githubIssueDocumentId,
  });

  return result;
}
