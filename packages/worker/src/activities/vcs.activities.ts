/**
 * VCS Activities - OAuth Integrated (Phase 5)
 *
 * Includes security validation for branch names, commit messages, and file paths.
 */

import { createLogger } from '@devflow/common';
import { createVCSDriver } from '@devflow/sdk';
import { getProjectRepositoryConfig } from '@/activities/codebase.activities';
import { oauthResolver } from '@/services/oauth-context';
import {
  validateBranchName,
  sanitizeCommitMessage,
  validateFilePath,
} from '@/utils/validation';

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
  // Validate and sanitize branch name
  const branchValidation = validateBranchName(input.branchName);
  if (!branchValidation.valid) {
    logger.warn('Branch name validation failed, using sanitized version', {
      original: input.branchName,
      sanitized: branchValidation.sanitizedName,
      error: branchValidation.error,
    });
  }
  const safeBranchName = branchValidation.valid
    ? branchValidation.sanitizedName
    : input.branchName.replace(/[^a-zA-Z0-9\-_\/]/g, '-').replace(/-+/g, '-');

  logger.info('Creating branch', { ...input, branchName: safeBranchName });

  // Get repository config from project
  const repoConfig = await getProjectRepositoryConfig(input.projectId);

  // Resolve GitHub token (OAuth or env var fallback)
  const token = await resolveGitHubToken(input.projectId);

  const vcs = createVCSDriver({
    provider: repoConfig.provider as any,
    token,
  });

  await vcs.createBranch(repoConfig.owner, repoConfig.repo, {
    name: safeBranchName,
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
  // Validate file paths (defense in depth - should already be validated)
  const validatedFiles: Array<{ path: string; content: string }> = [];
  const rejectedPaths: string[] = [];

  for (const file of input.files) {
    const pathValidation = validateFilePath(file.path);
    if (pathValidation.valid) {
      validatedFiles.push({
        path: pathValidation.normalizedPath,
        content: file.content,
      });
    } else {
      rejectedPaths.push(file.path);
      logger.warn('Rejected file during commit due to invalid path', {
        path: file.path,
        error: pathValidation.error,
      });
    }
  }

  if (rejectedPaths.length > 0) {
    logger.warn('Some files rejected during commit', {
      rejected: rejectedPaths.length,
      accepted: validatedFiles.length,
    });
  }

  if (validatedFiles.length === 0) {
    throw new Error('No valid files to commit after path validation');
  }

  // Sanitize commit message
  const safeMessage = sanitizeCommitMessage(input.message);

  // Validate branch name
  const branchValidation = validateBranchName(input.branchName);
  const safeBranchName = branchValidation.valid
    ? branchValidation.sanitizedName
    : input.branchName;

  logger.info('Committing files', {
    projectId: input.projectId,
    branchName: safeBranchName,
    filesCount: validatedFiles.length,
    rejectedCount: rejectedPaths.length,
  });

  // Get repository config from project
  const repoConfig = await getProjectRepositoryConfig(input.projectId);

  // Resolve GitHub token (OAuth or env var fallback)
  const token = await resolveGitHubToken(input.projectId);

  const vcs = createVCSDriver({
    provider: repoConfig.provider as any,
    token,
  });

  await vcs.commitFiles(repoConfig.owner, repoConfig.repo, {
    branch: safeBranchName,
    message: safeMessage,
    files: validatedFiles,
  });
}

export interface CreatePullRequestInput {
  projectId: string;
  branchName: string;
  title: string;
  description: string;
  /** Target branch for the PR (defaults to 'main') */
  targetBranch?: string;
  /** Create as draft PR (defaults to false) */
  draft?: boolean;
  /** Labels to add to the PR */
  labels?: string[];
  /** Linear issue identifier for linking */
  linearIdentifier?: string;
}

export interface CreatePullRequestOutput {
  number: number;
  url: string;
  /** Whether the PR was created as a draft */
  draft: boolean;
  /** Branch name */
  branchName: string;
}

export async function createPullRequest(
  input: CreatePullRequestInput,
): Promise<CreatePullRequestOutput> {
  const isDraft = input.draft ?? false;
  logger.info('Creating pull request', {
    projectId: input.projectId,
    branchName: input.branchName,
    title: input.title,
    draft: isDraft,
    targetBranch: input.targetBranch || 'main',
  });

  // Get repository config from project
  const repoConfig = await getProjectRepositoryConfig(input.projectId);

  // Resolve GitHub token (OAuth required)
  const token = await resolveGitHubToken(input.projectId);

  const vcs = createVCSDriver({
    provider: repoConfig.provider as any,
    token,
  });

  // Build PR description with Linear link if provided
  let description = input.description;
  if (input.linearIdentifier) {
    description += `\n\n---\n\n**Linear Issue:** ${input.linearIdentifier}`;
  }

  // Add draft badge to description if draft PR
  if (isDraft) {
    description = `> ⚠️ **Draft PR** - This PR was auto-generated and requires human review before merging.\n\n${description}`;
  }

  const pr = await vcs.createPullRequest(repoConfig.owner, repoConfig.repo, {
    title: input.title,
    body: description,
    sourceBranch: input.branchName,
    targetBranch: input.targetBranch || 'main',
    draft: isDraft,
    labels: input.labels,
  });

  logger.info('Pull request created successfully', {
    number: pr.number,
    url: pr.url,
    draft: isDraft,
  });

  return {
    number: pr.number,
    url: pr.url,
    draft: isDraft,
    branchName: input.branchName,
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

