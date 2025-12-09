/**
 * Codebase Analysis Activities - OAuth Integrated (Phase 5)
 */

import { createLogger } from '@devflow/common';
import { GitHubProvider, analyzeRepository, CodebaseContext } from '@devflow/sdk';
import { PrismaClient } from '@prisma/client';
import { oauthResolver } from '@/services/oauth-context';

const logger = createLogger('CodebaseActivities');
const prisma = new PrismaClient();

/**
 * Resolve GitHub token for a project via OAuth
 * No fallback - OAuth required
 */
async function resolveGitHubToken(projectId: string): Promise<string> {
  try {
    const token = await oauthResolver.resolveGitHubToken(projectId);
    logger.info('Using OAuth token for GitHub', { projectId });
    return token;
  } catch (error) {
    throw new Error(
      `No GitHub OAuth connection configured for project ${projectId}. Please configure OAuth via: POST /api/v1/auth/github/device/initiate`,
    );
  }
}

export interface AnalyzeRepositoryInput {
  projectId: string;
  taskDescription?: string;
}

/**
 * Analyze repository context using GitHub API
 */
export async function analyzeRepositoryContext(
  input: AnalyzeRepositoryInput,
): Promise<CodebaseContext> {
  logger.info('Analyzing repository context', input);

  try {
    // Get project from database
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
    });

    if (!project) {
      throw new Error(`Project ${input.projectId} not found`);
    }

    const config = project.config as any;

    // Extract repository info from config
    const owner = config?.vcs?.owner || config?.project?.owner;
    const repo = config?.vcs?.repo || config?.project?.repo;

    if (!owner || !repo) {
      throw new Error(`Repository owner/repo not configured for project ${input.projectId}`);
    }

    logger.info('Repository info extracted', { owner, repo });

    // Resolve GitHub token via OAuth
    const token = await resolveGitHubToken(input.projectId);

    // Create GitHub provider
    const github = new GitHubProvider(token);

    // Verify repository access
    try {
      await github.getRepository(owner, repo);
    } catch (error) {
      logger.error('Cannot access repository', error as Error, { owner, repo });
      throw new Error(`Cannot access repository ${owner}/${repo}. Check token permissions.`);
    }

    // Analyze repository
    logger.info('Starting repository analysis', { owner, repo });
    const context = await analyzeRepository(github, owner, repo, input.taskDescription);

    // If no similar code found (likely due to empty description), get example files
    if (context.similarCode.length === 0) {
      logger.info('No similar code found, fetching example files');

      try {
        const { findFilesByExtension } = await import('@devflow/sdk');
        const language = context.structure.language.toLowerCase();

        // Map language to file extensions
        const extensionMap: Record<string, string> = {
          'javascript': 'js',
          'typescript': 'ts',
          'python': 'py',
          'php': 'php',
          'java': 'java',
          'go': 'go',
          'ruby': 'rb',
        };

        const extension = extensionMap[language] || language.toLowerCase();
        const exampleFiles = await findFilesByExtension(github, owner, repo, extension, 5);

        // Add example files to context
        context.similarCode = exampleFiles;

        logger.info('Added example files', { count: exampleFiles.length });
      } catch (error) {
        logger.warn('Failed to fetch example files', error as Error);
      }
    }

    logger.info('Repository analysis completed', {
      owner,
      repo,
      language: context.structure.language,
      framework: context.structure.framework,
      dependencies: context.dependencies.mainLibraries.length,
      similarCode: context.similarCode.length,
    });

    return context;
  } catch (error) {
    logger.error('Failed to analyze repository context', error as Error, input);
    throw error;
  }
}

/**
 * Get project repository configuration
 */
export async function getProjectRepositoryConfig(projectId: string): Promise<{
  owner: string;
  repo: string;
  provider: string;
  url: string;
}> {
  logger.info('Getting project repository config', { projectId });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const config = project.config as any;

  const owner = config?.vcs?.owner || config?.project?.owner;
  const repo = config?.vcs?.repo || config?.project?.repo;
  const provider = config?.vcs?.provider || 'github';

  if (!owner || !repo) {
    throw new Error(`Repository not configured for project ${projectId}`);
  }

  return {
    owner,
    repo,
    provider,
    url: project.repository,
  };
}
