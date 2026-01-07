import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient, OAuthProvider } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { TokenEncryptionService } from './token-encryption.service';

@Injectable()
export class SystemOAuthInitService implements OnModuleInit {
  private readonly logger = new Logger(SystemOAuthInitService.name);
  private readonly SYSTEM_PROJECT_ID = 'SYSTEM_OAUTH_PROJECT';

  constructor(
    private readonly prisma: PrismaClient,
    private readonly tokenEncryption: TokenEncryptionService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing system-wide OAuth applications...');

    try {
      await this.ensureSystemProject();
      await this.registerSystemOAuthApps();
      this.logger.log('✓ System OAuth initialization complete');
    } catch (error) {
      this.logger.error('Failed to initialize system OAuth apps', error);
      // Don't throw - allow app to start even if this fails
    }
  }

  /**
   * Create system project if it doesn't exist
   */
  private async ensureSystemProject() {
    const existing = await this.prisma.project.findUnique({
      where: { id: this.SYSTEM_PROJECT_ID },
    });

    if (existing) {
      this.logger.debug('System project already exists');
      return;
    }

    await this.prisma.project.create({
      data: {
        id: this.SYSTEM_PROJECT_ID,
        name: 'System OAuth Applications',
        description:
          'Reserved project for system-wide OAuth credentials from .env',
        repository: 'N/A',
        config: {},
        isActive: true,
      },
    });

    this.logger.log('✓ Created system project for OAuth apps');
  }

  /**
   * Register system OAuth apps from environment variables
   */
  private async registerSystemOAuthApps() {
    const providers = [
      {
        provider: 'GITHUB' as OAuthProvider,
        clientIdVar: 'GITHUB_APP_CLIENT_ID',
        clientSecretVar: 'GITHUB_APP_CLIENT_SECRET',
        redirectUriVar: 'GITHUB_APP_REDIRECT_URI',
        scopes: ['repo', 'read:org', 'read:user', 'user:email', 'write:repo_hook'],
        flowType: 'authorization_code',
      },
      {
        provider: 'LINEAR' as OAuthProvider,
        clientIdVar: 'LINEAR_APP_CLIENT_ID',
        clientSecretVar: 'LINEAR_APP_CLIENT_SECRET',
        redirectUriVar: 'LINEAR_APP_REDIRECT_URI',
        scopes: ['read', 'write', 'issues:create', 'comments:create'],
        flowType: 'authorization_code',
      },
      {
        provider: 'SENTRY' as OAuthProvider,
        clientIdVar: 'SENTRY_APP_CLIENT_ID',
        clientSecretVar: 'SENTRY_APP_CLIENT_SECRET',
        redirectUriVar: 'SENTRY_APP_REDIRECT_URI',
        scopes: ['project:read', 'event:read', 'org:read'],
        flowType: 'authorization_code',
      },
      {
        provider: 'FIGMA' as OAuthProvider,
        clientIdVar: 'FIGMA_APP_CLIENT_ID',
        clientSecretVar: 'FIGMA_APP_CLIENT_SECRET',
        redirectUriVar: 'FIGMA_APP_REDIRECT_URI',
        scopes: ['file_content:read', 'current_user:read', 'projects:read'],
        flowType: 'authorization_code',
      },
    ];

    let registeredCount = 0;

    for (const providerConfig of providers) {
      const clientId = this.config.get<string>(providerConfig.clientIdVar);
      const clientSecret = this.config.get<string>(
        providerConfig.clientSecretVar,
      );
      const redirectUri = this.config.get<string>(providerConfig.redirectUriVar);

      // Skip if credentials not configured
      if (!clientId || !clientSecret || !redirectUri) {
        this.logger.debug(
          `Skipping ${providerConfig.provider} - credentials not in .env`,
        );
        continue;
      }

      await this.registerSystemApp(
        providerConfig.provider,
        clientId,
        clientSecret,
        redirectUri,
        providerConfig.scopes,
        providerConfig.flowType,
      );

      registeredCount++;
    }

    if (registeredCount > 0) {
      this.logger.log(`✓ Registered ${registeredCount} system OAuth app(s)`);
    } else {
      this.logger.warn(
        'No system OAuth apps configured in .env. Users will not be able to connect integrations.',
      );
    }
  }

  /**
   * Register or update a single system OAuth app
   */
  private async registerSystemApp(
    provider: OAuthProvider,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    scopes: string[],
    flowType: string,
  ) {
    // Encrypt client secret
    const encrypted = this.tokenEncryption.encrypt(clientSecret);

    // Upsert OAuth application
    await this.prisma.oAuthApplication.upsert({
      where: {
        projectId_provider: {
          projectId: this.SYSTEM_PROJECT_ID,
          provider,
        },
      },
      create: {
        projectId: this.SYSTEM_PROJECT_ID,
        provider,
        clientId,
        clientSecret: encrypted.ciphertext,
        encryptionIv: encrypted.iv,
        redirectUri,
        scopes,
        flowType,
        name: `System ${provider} OAuth`,
        description: 'System-wide OAuth application from environment variables',
        isActive: true,
      },
      update: {
        clientId,
        clientSecret: encrypted.ciphertext,
        encryptionIv: encrypted.iv,
        redirectUri,
        scopes,
        flowType,
        isActive: true,
      },
    });

    this.logger.debug(`✓ Registered system OAuth app: ${provider}`);
  }
}
