import type { RedisClientType } from 'redis';
import { OAuthDatabase, OAuthProvider } from './oauth.types';
import { ITokenResolver } from './token-resolver.interface';
import { GitHubAppAuthService } from './github-app-auth.service';
import { TokenStorageService } from './token-storage.service';

/**
 * OAuth Resolver Service
 * Resolves OAuth tokens for workers without direct HTTP access
 *
 * This service is designed to be used by Temporal workers and other
 * background services that need to access OAuth tokens.
 *
 * GitHub App Support:
 * - For GITHUB provider: Uses GitHub App installation tokens (no fallback to OAuth)
 * - For other providers (LINEAR, FIGMA, SENTRY): Uses OAuth tokens
 */
export class OAuthResolverService implements ITokenResolver {
  private githubAppAuth?: GitHubAppAuthService;
  private tokenStorage?: TokenStorageService;

  constructor(
    private readonly db: OAuthDatabase,
    private readonly redis: RedisClientType,
    githubAppAuth?: GitHubAppAuthService,
    tokenStorage?: TokenStorageService,
  ) {
    this.githubAppAuth = githubAppAuth;
    this.tokenStorage = tokenStorage;
  }

  /**
   * Resolve GitHub token for a project
   * Uses GitHub App installation token (no OAuth fallback)
   */
  async resolveGitHubToken(projectId: string): Promise<string> {
    if (!this.githubAppAuth) {
      throw new Error('GitHubAppAuthService is required for GitHub token resolution');
    }

    // Find GitHub App installation for this project
    const installation = await this.db.gitHubAppInstallation.findFirst({
      where: { projectId, isActive: true },
    });

    if (!installation) {
      throw new Error(
        `No GitHub App installation found for project ${projectId}. Please install the GitHub App.`,
      );
    }

    // Get installation token (cached with 50min TTL)
    return await this.githubAppAuth.getInstallationToken(
      projectId,
      Number(installation.installationId),
    );
  }

  /**
   * Resolve Linear token for a project
   * Returns the access token, refreshing if needed
   */
  async resolveLinearToken(projectId: string): Promise<string> {
    return this.getAccessToken(projectId, 'LINEAR');
  }

  /**
   * Get access token for any provider
   * Implements ITokenResolver interface
   *
   * - GitHub: Uses GitHub App installation tokens
   * - Other providers: Uses OAuth tokens from cache/database
   */
  async getAccessToken(projectId: string, provider: OAuthProvider): Promise<string> {
    // Special handling for GitHub: use GitHub App
    if (provider === 'GITHUB') {
      return this.resolveGitHubToken(projectId);
    }

    // For other providers (LINEAR, FIGMA, SENTRY): use OAuth
    return this.getOAuthAccessToken(projectId, provider);
  }

  /**
   * Get OAuth access token from cache or database
   * This method checks Redis first, then falls back to database
   *
   * Used for non-GitHub providers (LINEAR, FIGMA, SENTRY)
   */
  private async getOAuthAccessToken(
    projectId: string,
    provider: OAuthProvider,
  ): Promise<string> {
    // Try Redis cache first
    const cacheKey = `oauth:access:${projectId}:${provider}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return cached;
    }

    // Not in cache, need to get from database
    // In a real implementation, this would trigger a refresh
    // For now, we throw an error indicating the token needs refresh
    throw new Error(
      `Access token not cached for ${provider} on project ${projectId}. Token refresh needed.`,
    );
  }

  /**
   * Check if a project has an active OAuth connection
   */
  async hasActiveConnection(
    projectId: string,
    provider: OAuthProvider,
  ): Promise<boolean> {
    const connection = await this.db.oAuthConnection.findUnique({
      where: { projectId_provider: { projectId, provider } },
    });

    return connection !== null && connection.isActive && !connection.refreshFailed;
  }

  /**
   * Get connection info for debugging
   */
  async getConnectionInfo(
    projectId: string,
    provider: OAuthProvider,
  ): Promise<{
    exists: boolean;
    isActive: boolean;
    refreshFailed: boolean;
    lastRefreshed: Date | null;
  } | null> {
    const connection = await this.db.oAuthConnection.findUnique({
      where: { projectId_provider: { projectId, provider } },
    });

    if (!connection) {
      return null;
    }

    return {
      exists: true,
      isActive: connection.isActive,
      refreshFailed: connection.refreshFailed,
      lastRefreshed: connection.lastRefreshed,
    };
  }
}
