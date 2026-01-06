import {
  Controller,
  Post,
  Headers,
  Body,
  HttpException,
  HttpStatus,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { createLogger } from '@devflow/common';
import { PrismaService } from '../prisma/prisma.service';
import { GitHubAppAuthService } from '@devflow/sdk/dist/auth/github-app-auth.service';
import { GitHubAppInstallationService } from '@devflow/sdk/dist/auth/github-app-installation.service';
import type { InstallationPayload } from '@devflow/sdk/dist/auth/github-app-installation.service';
import * as crypto from 'crypto';

@Controller('webhooks/github-app')
export class GitHubAppWebhooksController {
  private readonly logger = createLogger('GitHubAppWebhooksController');

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubAppAuth: GitHubAppAuthService,
    private readonly githubAppInstallation: GitHubAppInstallationService,
  ) {}

  /**
   * POST /webhooks/github-app
   * Handle all GitHub App webhooks
   */
  @Post()
  async handleWebhook(
    @Headers('x-github-event') event: string,
    @Headers('x-github-delivery') delivery: string,
    @Headers('x-hub-signature-256') signature: string,
    @Body() payload: any,
    @Req() req: RawBodyRequest<Request>,
  ) {
    this.logger.info('GitHub App webhook received', {
      event,
      delivery,
      action: payload.action,
    });

    try {
      // Verify webhook signature
      await this.verifySignature(signature, req.rawBody || Buffer.from(JSON.stringify(payload)));

      // Route to appropriate handler
      switch (event) {
        case 'installation':
          await this.handleInstallationEvent(payload);
          break;

        case 'installation_repositories':
          await this.handleInstallationRepositoriesEvent(payload);
          break;

        case 'installation.suspend':
        case 'installation.unsuspend':
          await this.handleInstallationSuspensionEvent(payload);
          break;

        case 'ping':
          this.logger.info('Ping webhook received');
          break;

        default:
          this.logger.warn('Unhandled webhook event', { event });
      }

      return { received: true };
    } catch (error) {
      this.logger.error('Webhook handling failed', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Webhook handling failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Verify webhook signature using HMAC SHA-256
   */
  private async verifySignature(signature: string, body: Buffer): Promise<void> {
    if (!signature) {
      throw new HttpException('Missing signature', HttpStatus.UNAUTHORIZED);
    }

    // Extract installation ID from body to find correct webhook secret
    let installationId: number;
    try {
      const payload = JSON.parse(body.toString());
      installationId = payload.installation?.id;
    } catch {
      throw new HttpException('Invalid payload', HttpStatus.BAD_REQUEST);
    }

    if (!installationId) {
      throw new HttpException('Missing installation ID', HttpStatus.BAD_REQUEST);
    }

    // Find installation and get project ID
    const installation = await this.prisma.gitHubAppInstallation.findUnique({
      where: { installationId: BigInt(installationId) },
    });

    if (!installation) {
      this.logger.warn('Installation not found for webhook', { installationId });
      // Don't fail - this could be a new installation
      return;
    }

    // Get app credentials for webhook secret
    const credentials = await this.githubAppAuth.getAppCredentials(installation.projectId);

    if (!credentials.webhookSecret) {
      this.logger.warn('No webhook secret configured', {
        projectId: installation.projectId,
      });
      return;
    }

    // Compute expected signature
    const hmac = crypto.createHmac('sha256', credentials.webhookSecret);
    hmac.update(body);
    const expectedSignature = `sha256=${hmac.digest('hex')}`;

    // Compare signatures (timing-safe)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );

    if (!isValid) {
      this.logger.error('Invalid webhook signature', new Error('Invalid webhook signature'), {
        installationId,
        projectId: installation.projectId,
      });
      throw new HttpException('Invalid signature', HttpStatus.UNAUTHORIZED);
    }

    this.logger.debug('Webhook signature verified', { installationId });
  }

  /**
   * Handle installation.created, installation.deleted, installation.suspend, installation.unsuspend
   */
  private async handleInstallationEvent(payload: any): Promise<void> {
    const action = payload.action;
    const installationId = payload.installation?.id;

    this.logger.info('Handling installation event', { action, installationId });

    switch (action) {
      case 'created':
        // Find project by installation account (or create mapping)
        // For now, we expect the installation to be created via our UI flow
        // So this webhook is mainly for confirmation
        this.logger.info('Installation created (confirmation)', {
          installationId,
          account: payload.installation?.account?.login,
        });
        break;

      case 'deleted':
        await this.githubAppInstallation.handleInstallationDeleted(installationId);
        this.logger.info('Installation deleted', { installationId });
        break;

      case 'suspend':
        await this.githubAppInstallation.handleInstallationSuspended(installationId);
        this.logger.info('Installation suspended', { installationId });
        break;

      case 'unsuspend':
        await this.githubAppInstallation.handleInstallationUnsuspended(installationId);
        this.logger.info('Installation unsuspended', { installationId });
        break;

      case 'new_permissions_accepted':
        this.logger.info('New permissions accepted', { installationId });
        // Optionally sync installation to update permissions
        await this.githubAppInstallation.syncInstallationRepositories(installationId);
        break;

      default:
        this.logger.warn('Unhandled installation action', { action });
    }
  }

  /**
   * Handle installation_repositories.added, installation_repositories.removed
   */
  private async handleInstallationRepositoriesEvent(payload: any): Promise<void> {
    const action = payload.action;
    const installationId = payload.installation?.id;
    const repositoriesAdded = payload.repositories_added || [];
    const repositoriesRemoved = payload.repositories_removed || [];

    this.logger.info('Handling installation repositories event', {
      action,
      installationId,
      added: repositoriesAdded.length,
      removed: repositoriesRemoved.length,
    });

    // Sync repositories from GitHub to get latest state
    await this.githubAppInstallation.handleRepositoriesChanged(installationId);

    this.logger.info('Installation repositories synced', {
      installationId,
      added: repositoriesAdded.map((r: any) => r.full_name),
      removed: repositoriesRemoved.map((r: any) => r.full_name),
    });
  }

  /**
   * Handle installation.suspend, installation.unsuspend
   */
  private async handleInstallationSuspensionEvent(payload: any): Promise<void> {
    const action = payload.action;
    const installationId = payload.installation?.id;

    this.logger.info('Handling installation suspension event', {
      action,
      installationId,
    });

    if (action === 'suspend') {
      await this.githubAppInstallation.handleInstallationSuspended(installationId);
    } else if (action === 'unsuspend') {
      await this.githubAppInstallation.handleInstallationUnsuspended(installationId);
    }
  }
}
