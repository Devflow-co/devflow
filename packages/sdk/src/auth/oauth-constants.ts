/**
 * OAuth Constants for all supported providers
 *
 * Multi-tenant OAuth Architecture:
 * - GitHub: Uses public client ID (Device Flow - RFC 8628)
 * - GitHub Issues: Same as GitHub but separate connection for issues
 * - Linear: Credentials stored per-project in database (Authorization Code Flow)
 * - Sentry: Credentials stored per-project in database (Authorization Code Flow)
 * - Figma: Credentials stored per-project in database (Authorization Code Flow)
 */

export const OAUTH_CONSTANTS = {
  GITHUB: {
    // GitHub OAuth App (supports both Device Flow and Authorization Code Flow)
    // Device Flow: Uses public client ID (RFC 8628) - no client secret needed
    // Authorization Code Flow: Credentials stored per-project in database
    // Register at: https://github.com/settings/developers
    CLIENT_ID: 'Iv1.b507a08c87ecfe98', // Public client for Device Flow
    DEVICE_CODE_URL: 'https://github.com/login/device/code',
    AUTHORIZE_URL: 'https://github.com/login/oauth/authorize',
    TOKEN_URL: 'https://github.com/login/oauth/access_token',
    USER_API_URL: 'https://api.github.com/user',
    SCOPES: ['repo', 'read:org', 'read:user'],
    FLOW_TYPE: 'authorization_code' as const, // Changed to authorization_code for multi-tenant support
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
  SENTRY: {
    // Sentry OAuth App (uses Authorization Code Flow)
    // Credentials are stored per-project in the database (OAuthApplication table)
    // Register at: https://sentry.io/settings/developer-settings/
    AUTHORIZE_URL: 'https://sentry.io/oauth/authorize/',
    TOKEN_URL: 'https://sentry.io/oauth/token/',
    USER_API_URL: 'https://sentry.io/api/0/users/me/',
    SCOPES: ['project:read', 'event:read', 'org:read'],
    FLOW_TYPE: 'authorization_code' as const,
  },
  FIGMA: {
    // Figma OAuth App (uses Authorization Code Flow)
    // Credentials are stored per-project in the database (OAuthApplication table)
    // Register at: https://www.figma.com/developers/apps
    // Note: Figma migrated token endpoint to api.figma.com/v1 (2024+)
    // Valid scopes: file_content:read, current_user:read, projects:read, file_comments:read, etc.
    // Make sure scopes are enabled in your Figma app settings
    AUTHORIZE_URL: 'https://www.figma.com/oauth',
    TOKEN_URL: 'https://api.figma.com/v1/oauth/token',
    USER_API_URL: 'https://api.figma.com/v1/me',
    SCOPES: ['file_content:read', 'current_user:read'],
    FLOW_TYPE: 'authorization_code' as const,
  },
  GITHUB_ISSUES: {
    // GitHub Issues - separate OAuth connection for issue context extraction
    // Uses Device Flow (RFC 8628) - same as GitHub but different scopes/purpose
    CLIENT_ID: 'Iv1.b507a08c87ecfe98',
    DEVICE_CODE_URL: 'https://github.com/login/device/code',
    TOKEN_URL: 'https://github.com/login/oauth/access_token',
    SCOPES: ['repo', 'read:user'],
    FLOW_TYPE: 'device' as const,
  },
  SLACK: {
    // Slack OAuth App (uses OAuth 2.0 v2 flow)
    // Credentials are stored per-project in the database (OAuthApplication table)
    // Register at: https://api.slack.com/apps
    // Note: Slack bot tokens (xoxb-) do NOT expire - no refresh_token
    AUTHORIZE_URL: 'https://slack.com/oauth/v2/authorize',
    TOKEN_URL: 'https://slack.com/api/oauth.v2.access',
    USER_API_URL: 'https://slack.com/api/auth.test',
    SCOPES: ['channels:read', 'channels:join', 'chat:write', 'team:read'],
    FLOW_TYPE: 'authorization_code' as const,
  },
} as const;

export type OAuthProvider = keyof typeof OAUTH_CONSTANTS;
