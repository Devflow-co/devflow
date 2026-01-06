// Dynamic import for @octokit/app (ESM-only package)
import type { App as AppType } from '@octokit/app';
import { createLogger } from '@devflow/common';
import type { PrismaClient } from '@prisma/client';
import { TokenEncryptionService } from './token-encryption.service';
import { TokenStorageService } from './token-storage.service';

// Cache for the App class to avoid multiple dynamic imports
let AppClass: typeof AppType | null = null;

async function getAppClass(): Promise<typeof AppType> {
  if (!AppClass) {
    const module = await import('@octokit/app');
    AppClass = module.App;
  }
  return AppClass;
}

/**
 * GitHub App Credentials
 */
export interface GitHubAppCredentials {
  appId: number;
  privateKey: string;
  clientId: string;
  clientSecret: string;
  webhookSecret?: string;
  slug?: string;
  name?: string;
}

/**
 * GitHub App Authentication Service
 *
 * Manages GitHub App authentication, including:
 * - Loading encrypted credentials from database
 * - Creating Octokit App instances
 * - Generating installation access tokens (1h TTL)
 * - Caching tokens in Redis with 50min TTL (10min buffer)
 * - Auto-refresh on expiration
 */
export class GitHubAppAuthService {
  private readonly logger = createLogger('GitHubAppAuthService');

  constructor(
    private readonly tokenEncryption: TokenEncryptionService,
    private readonly tokenStorage: TokenStorageService,
    private readonly db: PrismaClient,
  ) {}

  /**
   * Get GitHub App credentials from environment variables
   * Single global GitHub App for all projects
   *
   * @param projectId Project ID (unused, kept for API compatibility)
   * @returns GitHub App credentials
   */
  async getAppCredentials(projectId: string | null): Promise<GitHubAppCredentials> {
    // Read from environment variables
    if (
      !process.env.GITHUB_APP_ID ||
      !process.env.GITHUB_CLIENT_ID ||
      !process.env.GITHUB_CLIENT_SECRET ||
      !process.env.GITHUB_PRIVATE_KEY
    ) {
      throw new Error(
        'GitHub App not configured. Please set environment variables: GITHUB_APP_ID, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_PRIVATE_KEY',
      );
    }

    this.logger.debug('Using GitHub App credentials from environment variables');

    return {
      appId: parseInt(process.env.GITHUB_APP_ID, 10),
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      privateKey: process.env.GITHUB_PRIVATE_KEY,
      webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
      name: process.env.GITHUB_APP_NAME || 'DevFlow',
      slug: process.env.GITHUB_APP_SLUG || 'devflow',
    };
  }

  /**
   * Create Octokit App instance
   *
   * @param projectId Project ID (null for global config)
   * @returns Configured Octokit App instance
   */
  async createApp(projectId: string | null): Promise<AppType> {
    const credentials = await this.getAppCredentials(projectId);
    const App = await getAppClass();

    return new App({
      appId: credentials.appId,
      privateKey: credentials.privateKey,
      oauth: {
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
      },
      webhooks: credentials.webhookSecret
        ? {
            secret: credentials.webhookSecret,
          }
        : undefined,
    });
  }

  /**
   * Get installation access token (1 hour TTL, auto-refresh)
   * Cached in Redis with 50-minute TTL (10-minute safety buffer)
   *
   * Installation tokens provide access to selected repositories
   * and must be refreshed regularly as they expire in 1 hour.
   *
   * @param projectId Project ID
   * @param installationId GitHub App installation ID
   * @returns Installation access token
   */
  async getInstallationToken(projectId: string, installationId: number): Promise<string> {
    const cacheKey = `GITHUB_APP_${installationId}`;

    // Check Redis cache first
    const cached = await this.tokenStorage.getAccessToken(projectId, cacheKey);
    if (cached) {
      this.logger.debug('Using cached installation token', { installationId });
      return cached;
    }

    this.logger.info('Generating new installation token', { installationId });

    // Generate new token using GitHub App
    const app = await this.createApp(projectId);
    const octokit = await app.getInstallationOctokit(installationId);

    // Get installation token
    // Note: The token is embedded in the octokit instance's auth
    const { token } = await octokit.auth({ type: 'installation' }) as { token: string };

    // Cache for 50 minutes (10 minute buffer before 1h expiration)
    const expiresIn = 50 * 60; // 3000 seconds
    await this.tokenStorage.cacheAccessToken(projectId, cacheKey, token, expiresIn);

    // Update cached expiry in database
    await this.db.gitHubAppInstallation.update({
      where: { installationId: BigInt(installationId) },
      data: {
        cachedTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      },
    });

    return token;
  }

  /**
   * Verify GitHub App installation access
   *
   * @param installationId GitHub App installation ID
   * @returns true if installation is active and not suspended
   */
  async verifyInstallation(installationId: number): Promise<boolean> {
    try {
      const installation = await this.db.gitHubAppInstallation.findUnique({
        where: { installationId: BigInt(installationId) },
      });

      return !!(installation?.isActive && !installation?.isSuspended);
    } catch (error) {
      this.logger.error('Failed to verify installation', error);
      return false;
    }
  }

  /**
   * Invalidate cached installation token
   * Useful for forcing token refresh
   *
   * @param projectId Project ID
   * @param installationId GitHub App installation ID
   */
  async invalidateInstallationToken(projectId: string, installationId: number): Promise<void> {
    const cacheKey = `GITHUB_APP_${installationId}`;
    await this.tokenStorage.clearAccessToken(projectId, cacheKey);
    this.logger.info('Invalidated installation token cache', { installationId });
  }
}
