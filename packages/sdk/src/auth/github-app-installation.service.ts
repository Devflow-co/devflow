import { createLogger } from '@devflow/common';
import type { PrismaClient } from '@prisma/client';
import { GitHubAppAuthService } from './github-app-auth.service';

/**
 * Repository Selection Options
 */
export interface RepositorySelection {
  repos?: string[]; // ["owner/repo1", "owner/repo2"]
  orgs?: string[]; // ["org1", "org2"]
  selectionType: 'all' | 'selected';
}

/**
 * GitHub App Installation Payload (from webhook)
 */
export interface InstallationPayload {
  installation: {
    id: number;
    app_id: number;
    account: {
      login: string;
      type: string;
    };
    target_type: string;
    suspended_at: string | null;
    permissions: Record<string, string>;
    events: string[];
  };
  repositories?: Array<{
    id: number;
    full_name: string;
  }>;
  repository_selection?: 'all' | 'selected';
}

/**
 * GitHub App Installation Service
 *
 * Manages GitHub App installation lifecycle:
 * - Creating new installations
 * - Synchronizing repositories from GitHub
 * - Updating repository selection
 * - Verifying repository access
 */
export class GitHubAppInstallationService {
  private readonly logger = createLogger('GitHubAppInstallationService');

  constructor(
    private readonly db: PrismaClient,
    private readonly authService: GitHubAppAuthService,
  ) {}

  /**
   * Handle new GitHub App installation
   * Called from webhook: installation.created
   *
   * @param projectId Project ID to associate with installation
   * @param payload Installation payload from GitHub webhook
   */
  async handleInstallationCreated(projectId: string, payload: InstallationPayload): Promise<void> {
    const { installation, repositories, repository_selection } = payload;

    const selectedRepos = repositories?.map((r) => r.full_name) || [];
    const selectedOrgs = repository_selection === 'all' ? [installation.account.login] : [];

    this.logger.info('Creating new GitHub App installation', {
      projectId,
      installationId: installation.id,
      accountLogin: installation.account.login,
      repositorySelection: repository_selection,
      selectedRepos: selectedRepos.length,
    });

    await this.db.gitHubAppInstallation.create({
      data: {
        projectId,
        installationId: BigInt(installation.id),
        appId: BigInt(installation.app_id),
        accountLogin: installation.account.login,
        accountType: installation.account.type,
        targetType: installation.target_type,
        selectedRepos,
        selectedOrgs,
        repositorySelection: repository_selection || 'selected',
        permissions: installation.permissions,
        events: installation.events,
        isActive: true,
        isSuspended: installation.suspended_at !== null,
      },
    });

    this.logger.info('GitHub App installation created successfully', {
      installationId: installation.id,
    });
  }

  /**
   * Sync installation repositories from GitHub
   * Fetches current repository list and updates database
   *
   * @param installationId GitHub App installation ID
   */
  async syncInstallationRepositories(installationId: number): Promise<void> {
    this.logger.info('Syncing installation repositories', { installationId });

    try {
      const installation = await this.db.gitHubAppInstallation.findUnique({
        where: { installationId: BigInt(installationId) },
      });

      if (!installation) {
        throw new Error(`Installation ${installationId} not found`);
      }

      // Get app instance with installation credentials
      const app = await this.authService.createApp(installation.projectId);
      const octokit = await app.getInstallationOctokit(installationId);

      // Fetch all accessible repositories
      const { data } = await octokit.request('GET /installation/repositories', {
        per_page: 100,
      });

      const selectedRepos = data.repositories.map((r) => r.full_name);

      // Extract unique organizations from repository names
      const uniqueOrgs: string[] = [...new Set(selectedRepos.map((repo) => repo.split('/')[0]))];

      this.logger.info('Synced repositories from GitHub', {
        installationId,
        repoCount: selectedRepos.length,
        orgCount: uniqueOrgs.length,
      });

      // Update database
      await this.db.gitHubAppInstallation.update({
        where: { installationId: BigInt(installationId) },
        data: {
          selectedRepos,
          selectedOrgs: installation.repositorySelection === 'all' ? uniqueOrgs : installation.selectedOrgs,
          lastSyncedAt: new Date(),
          syncError: null,
        },
      });
    } catch (error) {
      this.logger.error('Failed to sync installation repositories', error);

      await this.db.gitHubAppInstallation.update({
        where: { installationId: BigInt(installationId) },
        data: {
          syncError: error instanceof Error ? error.message : 'Unknown error',
          lastSyncedAt: new Date(),
        },
      });

      throw error;
    }
  }

  /**
   * Update repository selection for an installation
   * Called when user modifies repo selection in project settings
   *
   * @param projectId Project ID
   * @param repoSelection New repository selection
   */
  async updateRepositorySelection(
    projectId: string,
    repoSelection: RepositorySelection,
  ): Promise<void> {
    this.logger.info('Updating repository selection', {
      projectId,
      selectionType: repoSelection.selectionType,
    });

    const installation = await this.db.gitHubAppInstallation.findFirst({
      where: { projectId, isActive: true },
    });

    if (!installation) {
      throw new Error('No active GitHub App installation found');
    }

    await this.db.gitHubAppInstallation.update({
      where: { id: installation.id },
      data: {
        selectedRepos: repoSelection.repos || [],
        selectedOrgs: repoSelection.orgs || [],
        repositorySelection: repoSelection.selectionType,
      },
    });

    this.logger.info('Repository selection updated', {
      installationId: installation.installationId.toString(),
      selectedRepos: repoSelection.repos?.length || 0,
      selectedOrgs: repoSelection.orgs?.length || 0,
    });
  }

  /**
   * Check if a repository is accessible by the installation
   *
   * @param projectId Project ID
   * @param repoFullName Repository full name (e.g., "owner/repo")
   * @returns true if repository is accessible
   */
  async canAccessRepository(projectId: string, repoFullName: string): Promise<boolean> {
    const installation = await this.db.gitHubAppInstallation.findFirst({
      where: { projectId, isActive: true },
    });

    if (!installation) {
      this.logger.warn('No active installation found for project', { projectId });
      return false;
    }

    // Check if repo is in selected repos
    if (installation.repositorySelection === 'all') {
      // Extract org from repo name
      const [org] = repoFullName.split('/');
      return installation.selectedOrgs.includes(org);
    }

    return installation.selectedRepos.includes(repoFullName);
  }

  /**
   * Get installation for a project
   *
   * @param projectId Project ID
   * @returns Installation or null if not found
   */
  async getInstallation(projectId: string) {
    return await this.db.gitHubAppInstallation.findFirst({
      where: { projectId, isActive: true },
    });
  }

  /**
   * Handle installation deletion
   * Called from webhook: installation.deleted
   *
   * @param installationId GitHub App installation ID
   */
  async handleInstallationDeleted(installationId: number): Promise<void> {
    this.logger.info('Marking installation as inactive', { installationId });

    await this.db.gitHubAppInstallation.updateMany({
      where: { installationId: BigInt(installationId) },
      data: { isActive: false },
    });
  }

  /**
   * Handle installation suspension
   * Called from webhook: installation.suspend
   *
   * @param installationId GitHub App installation ID
   */
  async handleInstallationSuspended(installationId: number): Promise<void> {
    this.logger.info('Marking installation as suspended', { installationId });

    await this.db.gitHubAppInstallation.updateMany({
      where: { installationId: BigInt(installationId) },
      data: { isSuspended: true },
    });
  }

  /**
   * Handle installation unsuspension
   * Called from webhook: installation.unsuspend
   *
   * @param installationId GitHub App installation ID
   */
  async handleInstallationUnsuspended(installationId: number): Promise<void> {
    this.logger.info('Marking installation as active', { installationId });

    await this.db.gitHubAppInstallation.updateMany({
      where: { installationId: BigInt(installationId) },
      data: { isSuspended: false },
    });
  }

  /**
   * Handle repositories added to installation
   * Called from webhook: installation_repositories.added
   *
   * @param installationId GitHub App installation ID
   */
  async handleRepositoriesChanged(installationId: number): Promise<void> {
    this.logger.info('Repositories changed, syncing installation', { installationId });

    // Re-sync repositories from GitHub
    await this.syncInstallationRepositories(installationId);
  }
}
