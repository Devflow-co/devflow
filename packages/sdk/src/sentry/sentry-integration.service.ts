import { ITokenResolver } from '../auth/token-resolver.interface';
import { createSentryClient } from './sentry.client';
import { SentryIssue, SentryEvent, SentryIssueContext } from './sentry.types';

/**
 * Sentry Integration Service
 *
 * Unified service that combines token resolution and Sentry API calls.
 * This service is testable by injecting a mock ITokenResolver.
 *
 * Pattern: tokenResolver.getAccessToken() → createSentryClient() → client.method()
 */
export class SentryIntegrationService {
  constructor(private readonly tokenResolver: ITokenResolver) {}

  /**
   * Get full issue context (issue details + latest event stacktrace)
   * This is the primary method used for error context extraction in workflows.
   *
   * @param projectId - Project ID for token resolution
   * @param issueId - Sentry issue ID
   */
  async getIssueContext(
    projectId: string,
    issueId: string,
  ): Promise<SentryIssueContext> {
    const token = await this.tokenResolver.getAccessToken(projectId, 'SENTRY');
    const client = createSentryClient(token);
    return await client.getIssueContext(issueId);
  }

  /**
   * Get issue details only
   *
   * @param projectId - Project ID for token resolution
   * @param issueId - Sentry issue ID
   */
  async getIssue(projectId: string, issueId: string): Promise<SentryIssue> {
    const token = await this.tokenResolver.getAccessToken(projectId, 'SENTRY');
    const client = createSentryClient(token);
    return await client.getIssue(issueId);
  }

  /**
   * Get latest event for an issue (includes full stacktrace)
   *
   * @param projectId - Project ID for token resolution
   * @param issueId - Sentry issue ID
   */
  async getLatestEvent(
    projectId: string,
    issueId: string,
  ): Promise<SentryEvent | null> {
    const token = await this.tokenResolver.getAccessToken(projectId, 'SENTRY');
    const client = createSentryClient(token);
    return await client.getLatestEvent(issueId);
  }

  /**
   * Get user info (for testing OAuth connection)
   * Uses /api/0/users/me/ endpoint
   *
   * @param projectId - Project ID for token resolution
   */
  async getUserInfo(projectId: string): Promise<any> {
    const token = await this.tokenResolver.getAccessToken(projectId, 'SENTRY');
    const client = createSentryClient(token);
    // SentryClient doesn't have getUserInfo yet, but we can add it or call directly
    throw new Error('getUserInfo not yet implemented in SentryClient');
  }
}

/**
 * Factory function to create a SentryIntegrationService
 *
 * @param tokenResolver - Token resolver instance
 */
export function createSentryIntegrationService(
  tokenResolver: ITokenResolver,
): SentryIntegrationService {
  return new SentryIntegrationService(tokenResolver);
}
