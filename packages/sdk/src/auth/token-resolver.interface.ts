import { OAuthProvider } from './oauth.types';

/**
 * Interface for resolving OAuth access tokens.
 * This abstraction allows for easy mocking in tests.
 */
export interface ITokenResolver {
  /**
   * Get a valid access token for a given project and provider.
   * Handles token refresh if necessary.
   *
   * @param projectId - The project ID
   * @param provider - The OAuth provider
   * @returns A valid access token
   * @throws Error if no OAuth connection exists or token refresh fails
   */
  getAccessToken(projectId: string, provider: OAuthProvider): Promise<string>;
}
