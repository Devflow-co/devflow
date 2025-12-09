/**
 * VCS Activities - OAuth Integrated (Phase 5)
 */

import { createLogger } from '@devflow/common';
import { createVCSDriver } from '@devflow/sdk';
import { getProjectRepositoryConfig } from '@/activities/codebase.activities';
import { oauthResolver } from '@/services/oauth-context';

const logger = createLogger('VCSActivities');

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

export interface CreateBranchInput {
  projectId: string;
  branchName: string;
  baseBranch: string;
}

export async function createBranch(input: CreateBranchInput): Promise<void> {
  logger.info('Creating branch', input);

  // Get repository config from project
  const repoConfig = await getProjectRepositoryConfig(input.projectId);

  // Resolve GitHub token (OAuth or env var fallback)
  const token = await resolveGitHubToken(input.projectId);

  const vcs = createVCSDriver({
    provider: repoConfig.provider as any,
    token,
  });

  await vcs.createBranch(repoConfig.owner, repoConfig.repo, {
    name: input.branchName,
    from: input.baseBranch,
  });
}

export interface CommitFilesInput {
  projectId: string;
  branchName: string;
  files: Array<{ path: string; content: string }>;
  message: string;
}

export async function commitFiles(input: CommitFilesInput): Promise<void> {
  logger.info('Committing files', { ...input, filesCount: input.files.length });

  // Get repository config from project
  const repoConfig = await getProjectRepositoryConfig(input.projectId);

  // Resolve GitHub token (OAuth or env var fallback)
  const token = await resolveGitHubToken(input.projectId);

  const vcs = createVCSDriver({
    provider: repoConfig.provider as any,
    token,
  });

  await vcs.commitFiles(repoConfig.owner, repoConfig.repo, {
    branch: input.branchName,
    message: input.message,
    files: input.files,
  });
}

export interface CreatePullRequestInput {
  projectId: string;
  branchName: string;
  title: string;
  description: string;
}

export interface CreatePullRequestOutput {
  number: number;
  url: string;
}

export async function createPullRequest(
  input: CreatePullRequestInput,
): Promise<CreatePullRequestOutput> {
  logger.info('Creating pull request', input);

  // Get repository config from project
  const repoConfig = await getProjectRepositoryConfig(input.projectId);

  // Resolve GitHub token (OAuth or env var fallback)
  const token = await resolveGitHubToken(input.projectId);

  const vcs = createVCSDriver({
    provider: repoConfig.provider as any,
    token,
  });

  const pr = await vcs.createPullRequest(repoConfig.owner, repoConfig.repo, {
    title: input.title,
    body: input.description,
    sourceBranch: input.branchName,
    targetBranch: 'main',
  });

  return {
    number: pr.number,
    url: pr.url,
  };
}

export interface MergePullRequestInput {
  projectId: string;
  prNumber: number;
}

export async function mergePullRequest(input: MergePullRequestInput): Promise<void> {
  logger.info('Merging pull request', input);

  // Get repository config from project
  const repoConfig = await getProjectRepositoryConfig(input.projectId);

  // Resolve GitHub token (OAuth or env var fallback)
  const token = await resolveGitHubToken(input.projectId);

  const vcs = createVCSDriver({
    provider: repoConfig.provider as any,
    token,
  });

  await vcs.mergePullRequest(repoConfig.owner, repoConfig.repo, input.prNumber);
}

