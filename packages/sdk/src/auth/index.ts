/**
 * Auth module exports
 */

export { OAUTH_CONSTANTS } from '@/auth/oauth-constants';
export { OAuthResolverService } from '@/auth/oauth-resolver.service';
export { TokenEncryptionService } from '@/auth/token-encryption.service';
export { TokenStorageService } from '@/auth/token-storage.service';
export { TokenRefreshService } from '@/auth/token-refresh.service';
export { OAuthService } from '@/auth/oauth.service';

// GitHub App services are exported separately to avoid loading @octokit/app
// unless explicitly needed. Import directly from files if needed:
// import { GitHubAppAuthService } from '@devflow/sdk/auth/github-app-auth.service';
// import { GitHubAppInstallationService } from '@devflow/sdk/auth/github-app-installation.service';
// export { GitHubAppAuthService } from '@/auth/github-app-auth.service';
// export { GitHubAppInstallationService } from '@/auth/github-app-installation.service';

export type { ITokenResolver } from '@/auth/token-resolver.interface';
export type {
  OAuthProvider,
  OAuthConnection,
  OAuthApplication,
  OAuthDatabase,
} from '@/auth/oauth.types';

// GitHub App types are still exported (no runtime dependency)
export type {
  GitHubAppCredentials,
} from '@/auth/github-app-auth.service';
export type {
  RepositorySelection,
  InstallationPayload,
} from '@/auth/github-app-installation.service';
