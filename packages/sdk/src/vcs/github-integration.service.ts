import { ITokenResolver } from '../auth/token-resolver.interface';
import { GitHubProvider } from './github.provider';
import { GitHubIssueContext, GitHubComment } from './vcs.interface';
import {
  Repository,
  Branch,
  PullRequest,
  Commit,
  CreatePROptions,
  CreateBranchOptions,
  CommitOptions,
} from '@devflow/common';

/**
 * GitHub Integration Service
 *
 * Unified service that combines token resolution and GitHub API calls.
 * This service is testable by injecting a mock ITokenResolver.
 *
 * Pattern: tokenResolver.getAccessToken() → new GitHubProvider() → provider.method()
 */
export class GitHubIntegrationService {
  constructor(private readonly tokenResolver: ITokenResolver) {}

  /**
   * Create a GitHub provider instance with resolved token
   */
  private async createProvider(projectId: string): Promise<GitHubProvider> {
    const token = await this.tokenResolver.getAccessToken(projectId, 'GITHUB');
    return new GitHubProvider(token);
  }

  /**
   * Get full issue context (issue details + comments)
   * This is the primary method used for GitHub issue context extraction in workflows.
   *
   * @param projectId - Project ID for token resolution
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param issueNumber - Issue number
   */
  async getIssueContext(
    projectId: string,
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<GitHubIssueContext> {
    const provider = await this.createProvider(projectId);
    return await provider.getIssueContext(owner, repo, issueNumber);
  }

  /**
   * Get repository details
   *
   * @param projectId - Project ID for token resolution
   * @param owner - Repository owner
   * @param repo - Repository name
   */
  async getRepository(
    projectId: string,
    owner: string,
    repo: string,
  ): Promise<Repository> {
    const provider = await this.createProvider(projectId);
    return await provider.getRepository(owner, repo);
  }

  /**
   * Get issue details only
   *
   * @param projectId - Project ID for token resolution
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param issueNumber - Issue number
   */
  async getIssue(
    projectId: string,
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<GitHubIssueContext> {
    const provider = await this.createProvider(projectId);
    return await provider.getIssue(owner, repo, issueNumber);
  }

  /**
   * Get issue comments
   *
   * @param projectId - Project ID for token resolution
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param issueNumber - Issue number
   */
  async getIssueComments(
    projectId: string,
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<GitHubComment[]> {
    const provider = await this.createProvider(projectId);
    return await provider.getIssueComments(owner, repo, issueNumber);
  }

  /**
   * Create a branch
   *
   * @param projectId - Project ID for token resolution
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param options - Branch creation options
   */
  async createBranch(
    projectId: string,
    owner: string,
    repo: string,
    options: CreateBranchOptions,
  ): Promise<Branch> {
    const provider = await this.createProvider(projectId);
    return await provider.createBranch(owner, repo, options);
  }

  /**
   * Commit files to a branch
   *
   * @param projectId - Project ID for token resolution
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param options - Commit options
   */
  async commitFiles(
    projectId: string,
    owner: string,
    repo: string,
    options: CommitOptions,
  ): Promise<Commit> {
    const provider = await this.createProvider(projectId);
    return await provider.commitFiles(owner, repo, options);
  }

  /**
   * Create a pull request
   *
   * @param projectId - Project ID for token resolution
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param options - PR creation options
   */
  async createPullRequest(
    projectId: string,
    owner: string,
    repo: string,
    options: CreatePROptions,
  ): Promise<PullRequest> {
    const provider = await this.createProvider(projectId);
    return await provider.createPullRequest(owner, repo, options);
  }

  /**
   * Get user info (for testing OAuth connection)
   *
   * @param projectId - Project ID for token resolution
   */
  async getUserInfo(projectId: string): Promise<any> {
    const provider = await this.createProvider(projectId);
    // GitHubProvider doesn't have getUserInfo yet, would need to add to the class
    throw new Error('getUserInfo not yet implemented in GitHubProvider');
  }
}

/**
 * Factory function to create a GitHubIntegrationService
 *
 * @param tokenResolver - Token resolver instance
 */
export function createGitHubIntegrationService(
  tokenResolver: ITokenResolver,
): GitHubIntegrationService {
  return new GitHubIntegrationService(tokenResolver);
}
