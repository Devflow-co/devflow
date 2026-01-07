import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Res,
  Req,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthGuard } from '@/user-auth/guards/auth.guard';
import { CurrentUser } from '@/user-auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { createLogger } from '@devflow/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '@/projects/projects.service';
import { GitHubAppAuthService } from '@devflow/sdk/dist/auth/github-app-auth.service';
import { GitHubAppInstallationService } from '@devflow/sdk/dist/auth/github-app-installation.service';
import type { RepositorySelection } from '@devflow/sdk/dist/auth/github-app-installation.service';
import { Inject, ForbiddenException } from '@nestjs/common';
import type { RedisClientType } from 'redis';
import * as crypto from 'crypto';

@Controller('auth/github-app')
export class GitHubAppController {
  private readonly logger = createLogger('GitHubAppController');

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubAppAuth: GitHubAppAuthService,
    private readonly githubAppInstallation: GitHubAppInstallationService,
    private readonly projectsService: ProjectsService,
    @Inject('REDIS_CLIENT') private readonly redis: RedisClientType,
  ) {}

  /**
   * Verify user has access to project
   */
  private async verifyProjectAccess(projectId: string, userId: string): Promise<void> {
    const hasAccess = await this.projectsService.userHasAccess(projectId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this project');
    }
  }

  /**
   * POST /auth/github-app/install
   * Initiate GitHub App installation flow
   */
  @Post('install')
  @UseGuards(AuthGuard)
  async initiateInstallation(
    @Body('projectId') projectId: string,
    @CurrentUser() user: User,
  ) {
    this.logger.info('Initiating GitHub App installation', {
      projectId,
      userId: user.id,
    });

    try {
      this.logger.debug('Step 1: Verifying project access');
      // Verify project access
      await this.verifyProjectAccess(projectId, user.id);

      this.logger.debug('Step 2: Getting GitHub App credentials');
      // Get GitHub App credentials
      const credentials = await this.githubAppAuth.getAppCredentials(projectId);
      this.logger.debug('Step 2 complete: Got credentials', { appId: credentials.appId });

      // Generate CSRF state token
      const state = crypto.randomBytes(32).toString('hex');

      // Store state in Redis (10 minutes TTL)
      await this.redis.set(
        `github-app:state:${state}`,
        JSON.stringify({ projectId, userId: user.id }),
        { EX: 600 },
      );

      // Build installation URL
      const installUrl = new URL(`https://github.com/apps/${credentials.slug || 'devflow'}/installations/new`);
      installUrl.searchParams.set('state', state);

      this.logger.info('GitHub App installation URL generated', {
        projectId,
        state: state.substring(0, 8) + '...',
      });

      return {
        installationUrl: installUrl.toString(),
        state,
      };
    } catch (error) {
      this.logger.error('Failed to initiate GitHub App installation', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to initiate installation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /auth/github-app/callback
   * Handle GitHub App installation callback
   */
  @Get('callback')
  async handleCallback(
    @Query('installation_id') installationId: string,
    @Query('setup_action') setupAction: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    this.logger.info('GitHub App installation callback received', {
      installationId,
      setupAction,
      state: state?.substring(0, 8) + '...',
    });

    try {
      // Verify state parameter (CSRF protection)
      const stateData = await this.redis.get(`github-app:state:${state}`);
      if (!stateData) {
        this.logger.error('Invalid or expired state parameter');
        return res.send(this.renderErrorPage('Invalid or expired state parameter'));
      }

      const { projectId, userId } = JSON.parse(stateData);

      // Delete state (one-time use)
      await this.redis.del(`github-app:state:${state}`);

      // Verify project access
      await this.verifyProjectAccess(projectId, userId);

      if (setupAction === 'install') {
        // Fetch installation details from GitHub
        const app = await this.githubAppAuth.createApp(projectId);
        const octokit = await app.getInstallationOctokit(Number(installationId));

        // Get installation
        const { data: installation } = await octokit.request('GET /app/installations/{installation_id}', {
          installation_id: Number(installationId),
        });

        // Get accessible repositories
        const { data: reposResponse } = await octokit.request('GET /installation/repositories', {
          per_page: 100,
        });

        const repositories = reposResponse.repositories;
        const selectedRepos = repositories.map((r) => r.full_name);
        const uniqueOrgs = [...new Set(repositories.map((r) => r.owner.login))];

        // Create installation payload
        const accountLogin = 'login' in installation.account ? installation.account.login : installation.account.name;
        const accountType = 'type' in installation.account ? installation.account.type : 'Organization';

        const payload = {
          installation: {
            id: installation.id,
            app_id: installation.app_id,
            account: {
              login: accountLogin,
              type: accountType,
            },
            target_type: installation.target_type,
            suspended_at: installation.suspended_at,
            permissions: installation.permissions,
            events: installation.events,
          },
          repositories: repositories.map((r) => ({
            id: r.id,
            full_name: r.full_name,
          })),
          repository_selection: installation.repository_selection as 'all' | 'selected',
        };

        // Store installation in database
        await this.githubAppInstallation.handleInstallationCreated(projectId, payload);

        this.logger.info('GitHub App installation completed successfully', {
          projectId,
          installationId,
          repoCount: selectedRepos.length,
          orgCount: uniqueOrgs.length,
        });

        return res.send(
          this.renderSuccessPage(
            'GitHub App installed successfully',
            `Connected ${selectedRepos.length} repositories from ${uniqueOrgs.length} organization(s)`,
          ),
        );
      } else {
        this.logger.warn('Unknown setup action', { setupAction });
        return res.send(this.renderErrorPage('Unknown setup action'));
      }
    } catch (error) {
      this.logger.error('GitHub App installation callback failed', error);
      return res.send(
        this.renderErrorPage(
          error instanceof Error ? error.message : 'Installation failed',
        ),
      );
    }
  }

  /**
   * GET /auth/github-app/repositories
   * Get installation repositories and configuration
   */
  @Get('repositories')
  @UseGuards(AuthGuard)
  async getRepositories(
    @Query('projectId') projectId: string,
    @CurrentUser() user: User,
  ) {
    this.logger.info('Fetching GitHub App repositories', {
      projectId,
      userId: user.id,
    });

    try {
      // Verify project access
      await this.verifyProjectAccess(projectId, user.id);

      // Get installation
      const installation = await this.githubAppInstallation.getInstallation(projectId);

      if (!installation) {
        this.logger.debug('No GitHub App installation found', { projectId });
        return null; // Return null instead of throwing error
      }

      // Sync repositories from GitHub
      await this.githubAppInstallation.syncInstallationRepositories(
        Number(installation.installationId),
      );

      // Fetch updated installation
      const updatedInstallation = await this.githubAppInstallation.getInstallation(projectId);

      if (!updatedInstallation) {
        return null;
      }

      return {
        installationId: updatedInstallation.installationId.toString(),
        accountLogin: updatedInstallation.accountLogin,
        accountType: updatedInstallation.accountType,
        repositorySelection: updatedInstallation.repositorySelection,
        selectedRepos: updatedInstallation.selectedRepos,
        selectedOrgs: updatedInstallation.selectedOrgs,
        lastSyncedAt: updatedInstallation.lastSyncedAt,
        syncError: updatedInstallation.syncError,
      };
    } catch (error) {
      this.logger.error('Failed to fetch repositories', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to fetch repositories',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /auth/github-app/repositories
   * Update repository selection
   */
  @Post('repositories')
  @UseGuards(AuthGuard)
  async updateRepositories(
    @Body('projectId') projectId: string,
    @Body('selection') selection: RepositorySelection,
    @CurrentUser() user: User,
  ) {
    this.logger.info('Updating GitHub App repository selection', {
      projectId,
      userId: user.id,
      selectionType: selection.selectionType,
    });

    try {
      // Verify project access
      await this.verifyProjectAccess(projectId, user.id);

      // Validate selection
      if (!selection.selectionType || !['all', 'selected'].includes(selection.selectionType)) {
        throw new HttpException('Invalid selection type', HttpStatus.BAD_REQUEST);
      }

      if (selection.selectionType === 'selected' && (!selection.repos || selection.repos.length === 0)) {
        throw new HttpException(
          'At least one repository must be selected',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (selection.selectionType === 'all' && (!selection.orgs || selection.orgs.length === 0)) {
        throw new HttpException(
          'At least one organization must be selected',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Update selection
      await this.githubAppInstallation.updateRepositorySelection(projectId, selection);

      this.logger.info('Repository selection updated successfully', {
        projectId,
        selectionType: selection.selectionType,
        repoCount: selection.repos?.length || 0,
        orgCount: selection.orgs?.length || 0,
      });

      return {
        success: true,
        message: 'Repository selection updated',
      };
    } catch (error) {
      this.logger.error('Failed to update repository selection', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to update selection',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /auth/github-app/uninstall
   * Uninstall GitHub App (mark as inactive)
   */
  @Post('uninstall')
  @UseGuards(AuthGuard)
  async uninstall(
    @Body('projectId') projectId: string,
    @CurrentUser() user: User,
  ) {
    this.logger.info('Uninstalling GitHub App', {
      projectId,
      userId: user.id,
    });

    try {
      // Verify project access
      await this.verifyProjectAccess(projectId, user.id);

      // Get installation
      const installation = await this.githubAppInstallation.getInstallation(projectId);

      if (!installation) {
        throw new HttpException(
          'No GitHub App installation found',
          HttpStatus.NOT_FOUND,
        );
      }

      // Mark as inactive
      await this.githubAppInstallation.handleInstallationDeleted(
        Number(installation.installationId),
      );

      this.logger.info('GitHub App uninstalled successfully', {
        projectId,
        installationId: installation.installationId.toString(),
      });

      return {
        success: true,
        message: 'GitHub App uninstalled',
      };
    } catch (error) {
      this.logger.error('Failed to uninstall GitHub App', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to uninstall',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Render success page with postMessage
   */
  private renderSuccessPage(title: string, message: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${title}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 3rem;
              border-radius: 12px;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
              text-align: center;
              max-width: 500px;
            }
            .icon {
              font-size: 4rem;
              margin-bottom: 1rem;
            }
            h1 {
              color: #2d3748;
              margin: 0 0 1rem 0;
              font-size: 1.75rem;
            }
            p {
              color: #4a5568;
              margin: 0 0 2rem 0;
              font-size: 1.1rem;
            }
            .countdown {
              color: #718096;
              font-size: 0.9rem;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">✅</div>
            <h1>${title}</h1>
            <p>${message}</p>
            <p class="countdown">This window will close in <span id="timer">3</span> seconds...</p>
          </div>
          <script>
            // Notify parent window
            if (window.opener) {
              window.opener.postMessage({ type: 'GITHUB_APP_SUCCESS' }, '*');
            }

            // Auto-close countdown
            let seconds = 3;
            const timerEl = document.getElementById('timer');
            const interval = setInterval(() => {
              seconds--;
              if (timerEl) timerEl.textContent = seconds.toString();
              if (seconds <= 0) {
                clearInterval(interval);
                window.close();
              }
            }, 1000);
          </script>
        </body>
      </html>
    `;
  }

  /**
   * Render error page with postMessage
   */
  private renderErrorPage(message: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Installation Failed</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            }
            .container {
              background: white;
              padding: 3rem;
              border-radius: 12px;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
              text-align: center;
              max-width: 500px;
            }
            .icon {
              font-size: 4rem;
              margin-bottom: 1rem;
            }
            h1 {
              color: #e53e3e;
              margin: 0 0 1rem 0;
              font-size: 1.75rem;
            }
            p {
              color: #4a5568;
              margin: 0 0 2rem 0;
              font-size: 1.1rem;
            }
            button {
              background: #e53e3e;
              color: white;
              border: none;
              padding: 0.75rem 2rem;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              transition: background 0.2s;
            }
            button:hover {
              background: #c53030;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h1>Installation Failed</h1>
            <p>${message}</p>
            <button onclick="window.close()">Close Window</button>
          </div>
          <script>
            // Notify parent window
            if (window.opener) {
              window.opener.postMessage({
                type: 'GITHUB_APP_ERROR',
                error: '${message.replace(/'/g, "\\'")}'
              }, '*');
            }
          </script>
        </body>
      </html>
    `;
  }
}
