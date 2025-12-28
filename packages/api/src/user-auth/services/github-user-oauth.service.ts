import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface GitHubTokenResponse {
  access_token: string;
  scope: string;
  token_type: string;
}

interface GitHubUser {
  id: number;
  login: string;
  name?: string;
  email?: string;
  avatar_url?: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}

@Injectable()
export class GitHubUserOAuthService {
  private readonly logger = new Logger(GitHubUserOAuthService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly callbackUrl: string;

  constructor(private readonly configService: ConfigService) {
    // Use separate env vars for user OAuth (different from API integration OAuth)
    this.clientId = this.configService.get<string>('GITHUB_USER_CLIENT_ID', '');
    this.clientSecret = this.configService.get<string>('GITHUB_USER_CLIENT_SECRET', '');
    this.callbackUrl = this.configService.get<string>(
      'GITHUB_USER_CALLBACK_URL',
      'http://localhost:3000/api/v1/user-auth/github/callback',
    );
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  getAuthorizationUrl(state?: string): string {
    if (!this.isConfigured()) {
      throw new Error('GitHub OAuth not configured');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      scope: 'user:email read:user',
    });

    if (state) {
      params.append('state', state);
    }

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<GitHubTokenResponse> {
    if (!this.isConfigured()) {
      throw new Error('GitHub OAuth not configured');
    }

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.callbackUrl,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to exchange code for tokens: ${error}`);
      throw new UnauthorizedException('Failed to authenticate with GitHub');
    }

    const data = await response.json();

    if (data.error) {
      this.logger.error(`GitHub OAuth error: ${data.error_description || data.error}`);
      throw new UnauthorizedException(data.error_description || 'Failed to authenticate with GitHub');
    }

    return data;
  }

  async getUser(accessToken: string): Promise<GitHubUser> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to get user: ${error}`);
      throw new UnauthorizedException('Failed to get user information from GitHub');
    }

    return response.json();
  }

  async getUserEmails(accessToken: string): Promise<GitHubEmail[]> {
    const response = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to get user emails: ${error}`);
      throw new UnauthorizedException('Failed to get user email from GitHub');
    }

    return response.json();
  }

  async authenticate(code: string): Promise<{
    ssoId: string;
    email: string;
    name?: string;
    avatar?: string;
  }> {
    const tokens = await this.exchangeCodeForTokens(code);
    const user = await this.getUser(tokens.access_token);

    // Get primary verified email
    let email = user.email;
    if (!email) {
      const emails = await this.getUserEmails(tokens.access_token);
      const primaryEmail = emails.find((e) => e.primary && e.verified);
      if (!primaryEmail) {
        throw new UnauthorizedException('No verified email found on GitHub account');
      }
      email = primaryEmail.email;
    }

    return {
      ssoId: user.id.toString(),
      email,
      name: user.name || user.login,
      avatar: user.avatar_url,
    };
  }
}
