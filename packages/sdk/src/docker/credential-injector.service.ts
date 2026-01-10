/**
 * Credential Injector Service - Phase 4 V2
 *
 * Securely injects credentials into container environments.
 * Handles token injection without persistence for security.
 */

export interface CredentialSet {
  /** GitHub token for repository access */
  githubToken?: string;
  /** NPM token for private packages */
  npmToken?: string;
  /** Additional environment variables */
  additionalEnv?: Record<string, string>;
}

export interface SecureEnvOptions {
  /** Mask secrets in logs */
  maskInLogs?: boolean;
  /** Prefix for env vars */
  prefix?: string;
}

/**
 * Service for securely injecting credentials into container environments
 */
export class CredentialInjectorService {
  private maskedValues: Set<string> = new Set();

  /**
   * Build secure environment variables for container execution
   */
  buildSecureEnv(
    baseEnv: Record<string, string>,
    credentials: CredentialSet,
    options: SecureEnvOptions = {}
  ): string[] {
    const env: Record<string, string> = { ...baseEnv };

    // Inject GitHub token
    if (credentials.githubToken) {
      env.GITHUB_TOKEN = credentials.githubToken;
      this.maskedValues.add(credentials.githubToken);
    }

    // Inject NPM token
    if (credentials.npmToken) {
      env.NPM_TOKEN = credentials.npmToken;
      this.maskedValues.add(credentials.npmToken);
    }

    // Inject additional environment variables
    if (credentials.additionalEnv) {
      for (const [key, value] of Object.entries(credentials.additionalEnv)) {
        env[key] = value;
        // Mark as sensitive if key contains common sensitive patterns
        if (this.isSensitiveKey(key)) {
          this.maskedValues.add(value);
        }
      }
    }

    // Add prefix if specified
    const prefix = options.prefix || '';

    // Convert to Docker-style array format
    return Object.entries(env).map(([key, value]) => `${prefix}${key}=${value}`);
  }

  /**
   * Build .npmrc content for private npm access
   */
  buildNpmrcContent(credentials: CredentialSet): string | null {
    if (!credentials.npmToken) {
      return null;
    }

    return `//registry.npmjs.org/:_authToken=${credentials.npmToken}
registry=https://registry.npmjs.org/
`;
  }

  /**
   * Build .netrc content for git authentication
   */
  buildNetrcContent(credentials: CredentialSet): string | null {
    if (!credentials.githubToken) {
      return null;
    }

    return `machine github.com
login x-access-token
password ${credentials.githubToken}
`;
  }

  /**
   * Mask sensitive values in log output
   */
  maskSensitiveValues(output: string): string {
    let masked = output;

    for (const value of this.maskedValues) {
      if (value && value.length > 8) {
        // Only mask values longer than 8 chars
        const regex = new RegExp(this.escapeRegex(value), 'g');
        masked = masked.replace(regex, '***MASKED***');
      }
    }

    // Also mask common patterns
    masked = this.maskCommonPatterns(masked);

    return masked;
  }

  /**
   * Clear stored masked values (for cleanup)
   */
  clearMaskedValues(): void {
    this.maskedValues.clear();
  }

  /**
   * Check if an environment key typically contains sensitive data
   */
  private isSensitiveKey(key: string): boolean {
    const sensitivePatterns = [
      /token/i,
      /secret/i,
      /password/i,
      /key/i,
      /auth/i,
      /credential/i,
      /api_key/i,
      /apikey/i,
      /private/i,
    ];

    return sensitivePatterns.some((pattern) => pattern.test(key));
  }

  /**
   * Mask common sensitive patterns in output
   */
  private maskCommonPatterns(output: string): string {
    let masked = output;

    // GitHub tokens (ghp_, gho_, ghu_, ghs_, ghr_)
    masked = masked.replace(/gh[pousr]_[a-zA-Z0-9]{36,}/g, '***GITHUB_TOKEN***');

    // NPM tokens
    masked = masked.replace(/npm_[a-zA-Z0-9]{36,}/g, '***NPM_TOKEN***');

    // Generic bearer tokens
    masked = masked.replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer ***TOKEN***');

    // Basic auth in URLs
    masked = masked.replace(
      /(https?:\/\/)[^:]+:[^@]+@/g,
      '$1***:***@'
    );

    return masked;
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Validate credentials before injection
   */
  validateCredentials(credentials: CredentialSet): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (credentials.githubToken) {
      // GitHub tokens should start with specific prefixes
      const validPrefixes = ['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_', 'github_pat_'];
      const hasValidPrefix = validPrefixes.some((prefix) =>
        credentials.githubToken!.startsWith(prefix)
      );

      if (!hasValidPrefix && !credentials.githubToken.startsWith('v1.')) {
        // Could be a fine-grained token or installation token
        if (credentials.githubToken.length < 30) {
          errors.push('GitHub token appears invalid (too short)');
        }
      }
    }

    if (credentials.npmToken) {
      if (!credentials.npmToken.startsWith('npm_') && credentials.npmToken.length < 30) {
        errors.push('NPM token appears invalid');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Build secure git config for container
   */
  buildGitConfigCommands(credentials: CredentialSet): string[] {
    const commands: string[] = [];

    if (credentials.githubToken) {
      // Configure git to use token for GitHub
      commands.push(
        `git config --global url."https://x-access-token:${credentials.githubToken}@github.com/".insteadOf "https://github.com/"`
      );
      commands.push(
        `git config --global url."https://x-access-token:${credentials.githubToken}@github.com/".insteadOf "git@github.com:"`
      );
    }

    return commands;
  }
}
