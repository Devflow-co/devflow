/**
 * OAuth Constants for GitHub Device Flow and Linear Authorization Code Flow
 *
 * Multi-tenant OAuth Architecture:
 * - GitHub: Uses public client ID (Device Flow - RFC 8628)
 * - Linear: Credentials (CLIENT_ID, CLIENT_SECRET, REDIRECT_URI) stored per-project in database
 */

export const OAUTH_CONSTANTS = {
  GITHUB: {
    // GitHub CLI public client (officially supported by GitHub)
    // Uses Device Flow (RFC 8628) - no client secret needed
    CLIENT_ID: 'Iv1.b507a08c87ecfe98',
    DEVICE_CODE_URL: 'https://github.com/login/device/code',
    TOKEN_URL: 'https://github.com/login/oauth/access_token',
    SCOPES: ['repo', 'workflow', 'admin:repo_hook'],
    FLOW_TYPE: 'device' as const,
  },
  LINEAR: {
    // Linear OAuth App (uses Authorization Code Flow)
    // Credentials are stored per-project in the database (OAuthApplication table)
    // Each project can have its own Linear OAuth app for multi-tenant support
    // Register via: POST /api/v1/auth/apps/register
    AUTHORIZE_URL: 'https://linear.app/oauth/authorize',
    TOKEN_URL: 'https://api.linear.app/oauth/token',
    REVOKE_URL: 'https://api.linear.app/oauth/revoke',
    USER_API_URL: 'https://api.linear.app/graphql',
    FLOW_TYPE: 'authorization_code' as const,
  },
} as const;

export type OAuthProvider = keyof typeof OAUTH_CONSTANTS;
