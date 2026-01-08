/**
 * OAuth Context for Worker Activities
 * Provides OAuth token resolution for GitHub and Linear
 * Supports both OAuth and GitHub App authentication
 */

import { PrismaClient } from '@prisma/client';
import { createClient, RedisClientType } from 'redis';
import {
  TokenRefreshService,
  TokenEncryptionService,
  TokenStorageService,
  OAuthService,
  GitHubAppAuthService,
} from '@devflow/sdk';
import { createLogger } from '@devflow/common';

const logger = createLogger('OAuthContext');

export type OAuthProvider = 'GITHUB' | 'LINEAR' | 'SENTRY' | 'FIGMA' | 'GITHUB_ISSUES';

class OAuthResolver {
  private prisma: PrismaClient;
  private redis: RedisClientType;
  private tokenRefresh: TokenRefreshService;
  private tokenEncryption: TokenEncryptionService;
  private tokenStorage: TokenStorageService;
  private githubAppAuth: GitHubAppAuthService;
  private initialized = false;

  constructor() {
    this.prisma = new PrismaClient();
    this.redis = createClient({
      url: process.env.REDIS_URL,
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.redis.connect();
      logger.info('Redis connected for OAuth context');

      // Initialize services
      this.tokenEncryption = new TokenEncryptionService();
      this.tokenStorage = new TokenStorageService(this.redis);
      const oauthService = new OAuthService(this.prisma, this.tokenEncryption, this.tokenStorage);
      this.tokenRefresh = new TokenRefreshService(
        this.prisma,
        this.tokenEncryption,
        this.tokenStorage,
        oauthService,
      );

      // Initialize GitHub App auth service
      this.githubAppAuth = new GitHubAppAuthService(
        this.tokenEncryption,
        this.tokenStorage,
        this.prisma,
      );

      this.initialized = true;
      logger.info('OAuth context initialized');
    } catch (error) {
      logger.error('Failed to initialize OAuth context', error);
      throw error;
    }
  }

  /**
   * Resolve GitHub token for a project via GitHub App Installation
   * GitHub App is the only supported authentication method for GitHub
   */
  async resolveGitHubToken(projectId: string): Promise<string> {
    if (!this.initialized) {
      throw new Error('OAuth context not initialized');
    }

    // Find GitHub App installation for the project
    const installation = await this.prisma.gitHubAppInstallation.findFirst({
      where: {
        projectId,
        isActive: true,
        isSuspended: false,
      },
    });

    if (!installation) {
      throw new Error(
        `No GitHub App installation found for project ${projectId}. ` +
        `Please install the DevFlow GitHub App for this project.`,
      );
    }

    logger.info('Using GitHub App installation token', {
      projectId,
      installationId: installation.installationId.toString(),
    });

    return await this.githubAppAuth.getInstallationToken(
      projectId,
      Number(installation.installationId),
    );
  }

  async resolveLinearToken(projectId: string): Promise<string> {
    if (!this.initialized) {
      throw new Error('OAuth context not initialized');
    }

    try {
      return await this.tokenRefresh.getAccessToken(projectId, 'LINEAR');
    } catch (error) {
      logger.warn('Failed to resolve Linear OAuth token', { projectId, error });
      throw error;
    }
  }

  async resolveSentryToken(projectId: string): Promise<string> {
    if (!this.initialized) {
      throw new Error('OAuth context not initialized');
    }

    try {
      return await this.tokenRefresh.getAccessToken(projectId, 'SENTRY');
    } catch (error) {
      logger.warn('Failed to resolve Sentry OAuth token', { projectId, error });
      throw error;
    }
  }

  async resolveFigmaToken(projectId: string): Promise<string> {
    if (!this.initialized) {
      throw new Error('OAuth context not initialized');
    }

    try {
      return await this.tokenRefresh.getAccessToken(projectId, 'FIGMA');
    } catch (error) {
      logger.warn('Failed to resolve Figma OAuth token', { projectId, error });
      throw error;
    }
  }

  async resolveGitHubIssuesToken(projectId: string): Promise<string> {
    if (!this.initialized) {
      throw new Error('OAuth context not initialized');
    }

    try {
      return await this.tokenRefresh.getAccessToken(projectId, 'GITHUB_ISSUES');
    } catch (error) {
      logger.warn('Failed to resolve GitHub Issues OAuth token', { projectId, error });
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect();
    }
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
    this.initialized = false;
    logger.info('OAuth context cleaned up');
  }
}

// Singleton instance
const oauthResolver = new OAuthResolver();

export { oauthResolver };
