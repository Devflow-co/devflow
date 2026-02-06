/**
 * Code Generation Activities - GitHub File Fetching
 */

import { createLogger } from '@devflow/common';
import { GitHubProvider } from '@devflow/sdk';
import { getProjectRepositoryConfig } from '../codebase.activities';
import { oauthResolver } from '@/services/oauth-context';
import type { FetchFilesFromGitHubInput, FetchFilesFromGitHubOutput } from './types';

const logger = createLogger('FetchFilesActivities');

/**
 * Fetch full file contents from GitHub for files listed in technicalPlan.filesAffected
 * This provides the AI with complete context for modifications (not just RAG chunks)
 *
 * Privacy-first: Files are fetched via GitHub API using OAuth token
 */
export async function fetchFilesFromGitHub(
  input: FetchFilesFromGitHubInput
): Promise<FetchFilesFromGitHubOutput> {
  logger.info('Fetching full files from GitHub', {
    projectId: input.projectId,
    fileCount: input.filePaths.length,
  });

  const files: Array<{ path: string; content: string }> = [];
  const notFound: string[] = [];

  try {
    // Get repository config
    const repoConfig = await getProjectRepositoryConfig(input.projectId);

    // Resolve GitHub token via OAuth
    const token = await oauthResolver.resolveGitHubToken(input.projectId);
    const github = new GitHubProvider(token);

    // Fetch each file
    for (const filePath of input.filePaths) {
      try {
        const content = await github.getFileContent(
          repoConfig.owner,
          repoConfig.repo,
          filePath,
          input.branch
        );
        files.push({ path: filePath, content });
        logger.debug('Fetched file successfully', { filePath });
      } catch (error) {
        logger.info('File not found or error fetching', { filePath, error: (error as Error).message });
        notFound.push(filePath);
      }
    }

    logger.info('File fetching completed', {
      fetched: files.length,
      notFound: notFound.length,
    });

    return { files, notFound };
  } catch (error) {
    logger.error('Failed to fetch files from GitHub', error as Error);
    return { files: [], notFound: input.filePaths };
  }
}
