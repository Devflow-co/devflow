/**
 * Projects Service - Refactored with Prisma
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  createLogger,
  DEFAULT_WORKFLOW_CONFIG,
  mergeWithDefaults,
  validateAutomationConfig,
  AutomationConfig,
} from '@devflow/common';
import {
  parseRepositoryUrl,
  GitHubProvider,
  createLinearClient,
  createLinearSetupService,
  createSentryIntegrationService,
  SentryOrganization,
  SentryProjectDetail,
  createSlackIntegrationService,
  SlackChannel,
  SlackTeam,
} from '@devflow/sdk';
import { PrismaService } from '@/prisma/prisma.service';
import { TokenRefreshService } from '@/auth/services/token-refresh.service';
import { CreateProjectDto, UpdateProjectDto, UpdateIntegrationDto } from '@/projects/dto';

@Injectable()
export class ProjectsService {
  private logger = createLogger('ProjectsService');

  constructor(
    private prisma: PrismaService,
    private tokenRefresh: TokenRefreshService,
  ) {}

  async findAll() {
    this.logger.info('Finding all projects');

    return this.prisma.project.findMany({
      where: {
        isActive: true,
        id: { not: 'SYSTEM_OAUTH_PROJECT' }, // Exclude system project from UI
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { tasks: true, workflows: true },
        },
      },
    });
  }

  /**
   * Find projects accessible by a user (via organizations)
   */
  async findByUserId(userId: string) {
    this.logger.info('Finding projects for user', { userId });

    const projects = await this.prisma.project.findMany({
      where: {
        isActive: true,
        id: { not: 'SYSTEM_OAUTH_PROJECT' }, // Exclude system project from UI
        organizations: {
          some: {
            organization: {
              members: {
                some: { userId },
              },
            },
          },
        },
      },
      include: {
        integration: true,
        oauthConnections: {
          where: { isActive: true },
        },
        _count: {
          select: {
            tasks: true,
            workflows: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with active workflows count and GitHub App status
    const enrichedProjects = await Promise.all(
      projects.map(async (project) => {
        const [activeWorkflowsCount, githubAppInstallation] = await Promise.all([
          this.prisma.workflow.count({
            where: {
              projectId: project.id,
              status: { in: ['PENDING', 'RUNNING'] },
            },
          }),
          this.prisma.gitHubAppInstallation.findFirst({
            where: {
              projectId: project.id,
              isActive: true,
              isSuspended: false,
            },
            select: {
              id: true,
              installationId: true,
              accountLogin: true,
              selectedRepos: true,
            },
          }),
        ]);

        // Add a virtual GITHUB OAuth connection if GitHub App is installed
        const oauthConnections = [...project.oauthConnections];
        if (githubAppInstallation) {
          oauthConnections.push({
            id: `github-app-${githubAppInstallation.id}`,
            projectId: project.id,
            provider: 'GITHUB',
            scopes: ['repo', 'read:org'],
            providerUserId: githubAppInstallation.accountLogin,
            providerEmail: null,
            isActive: true,
            refreshFailed: false,
            failureReason: null,
            lastRefreshed: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any);
        }

        return {
          ...project,
          oauthConnections,
          githubAppInstallation: githubAppInstallation ? {
            accountLogin: githubAppInstallation.accountLogin,
            repoCount: githubAppInstallation.selectedRepos.length,
          } : null,
          _count: {
            ...project._count,
            activeWorkflows: activeWorkflowsCount,
          },
        };
      })
    );

    return enrichedProjects;
  }

  /**
   * Check if a user has access to a project (via organizations)
   */
  async userHasAccess(projectId: string, userId: string): Promise<boolean> {
    const count = await this.prisma.project.count({
      where: {
        id: projectId,
        organizations: {
          some: {
            organization: {
              members: {
                some: { userId },
              },
            },
          },
        },
      },
    });
    return count > 0;
  }

  async findOne(id: string) {
    this.logger.info('Finding project', { id });
    
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        tasks: {
          take: 10,
          orderBy: { updatedAt: 'desc' },
        },
        workflows: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { tasks: true, workflows: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    return project;
  }

  async create(dto: CreateProjectDto) {
    this.logger.info('Creating project', { name: dto.name });

    // Initialize with DEFAULT_WORKFLOW_CONFIG if no config provided
    const config = dto.config || DEFAULT_WORKFLOW_CONFIG;

    this.logger.debug('Project config', {
      hasCustomConfig: !!dto.config,
      config
    });

    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        repository: dto.repository,
        workspacePath: dto.workspacePath,
        config: config as any, // Cast to any for Prisma JSON type compatibility
      },
    });
  }

  /**
   * Create a project and link it to the user's organization
   */
  async createForUser(dto: CreateProjectDto, userId: string) {
    this.logger.info('Creating project for user', { name: dto.name, userId });

    // Find user's personal organization (where they are OWNER)
    const orgMember = await this.prisma.organizationMember.findFirst({
      where: { userId, role: 'OWNER' },
      include: { organization: true },
    });

    if (!orgMember) {
      this.logger.error(`No organization found for user: ${userId}`);
      throw new NotFoundException('No organization found for user. Please contact support.');
    }

    // Initialize with DEFAULT_WORKFLOW_CONFIG if no config provided
    const config = dto.config || DEFAULT_WORKFLOW_CONFIG;

    // Create project
    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description || '',
        repository: dto.repository || '',
        workspacePath: dto.workspacePath,
        config: config as any,
      },
    });

    // Link project to organization
    await this.prisma.organizationProject.create({
      data: {
        organizationId: orgMember.organizationId,
        projectId: project.id,
      },
    });

    this.logger.info('Project created and linked to organization', {
      projectId: project.id,
      organizationId: orgMember.organizationId,
    });

    return project;
  }

  async update(id: string, dto: UpdateProjectDto) {
    this.logger.info('Updating project', { id });

    // Check if project exists
    const existingProject = await this.findOne(id);
    const existingConfig = (existingProject.config as Record<string, any>) || {};

    // Handle config update with automation merge
    let updatedConfig = dto.config;
    if (dto.config) {
      // If automation config is provided, merge with defaults and validate
      if (dto.config.automation) {
        const mergedAutomation = mergeWithDefaults(dto.config.automation as Partial<AutomationConfig>);
        const validation = validateAutomationConfig(mergedAutomation);

        if (!validation.valid) {
          throw new BadRequestException(`Invalid automation config: ${validation.errors.join(', ')}`);
        }

        if (validation.warnings.length > 0) {
          this.logger.warn('Automation config warnings', { warnings: validation.warnings });
        }

        // Merge with existing config, updating automation
        updatedConfig = {
          ...existingConfig,
          ...dto.config,
          automation: mergedAutomation,
        };
      } else {
        // Keep existing automation config if not provided
        updatedConfig = {
          ...dto.config,
          automation: existingConfig.automation,
        };
      }
    }

    return this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        repository: dto.repository,
        workspacePath: dto.workspacePath,
        config: updatedConfig,
      },
    });
  }

  async remove(id: string) {
    this.logger.info('Removing project', { id });
    
    // Check if project exists
    await this.findOne(id);

    // Soft delete by setting isActive to false
    await this.prisma.project.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Get project statistics
   */
  async getStatistics(id: string) {
    this.logger.info('Getting project statistics', { id });

    const project = await this.findOne(id);

    const [taskStats, workflowStats] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['status'],
        where: { projectId: id },
        _count: true,
      }),
      this.prisma.workflow.groupBy({
        by: ['status'],
        where: { projectId: id },
        _count: true,
      }),
    ]);

    return {
      project: {
        id: project.id,
        name: project.name,
      },
      tasks: {
        total: project._count.tasks,
        byStatus: taskStats.reduce((acc, stat) => {
          acc[stat.status] = stat._count;
          return acc;
        }, {} as Record<string, number>),
      },
      workflows: {
        total: project._count.workflows,
        byStatus: workflowStats.reduce((acc, stat) => {
          acc[stat.status] = stat._count;
          return acc;
        }, {} as Record<string, number>),
      },
    };
  }

  /**
   * Link a GitHub repository to a project
   */
  async linkRepository(id: string, repositoryUrl: string) {
    this.logger.info('Linking repository to project', { id, repositoryUrl });

    // Check if project exists
    const project = await this.findOne(id);

    try {
      // Parse repository URL to extract owner, repo, and provider
      const repoInfo = parseRepositoryUrl(repositoryUrl);
      this.logger.info('Repository info extracted', repoInfo);

      // Get GitHub token via OAuth
      let token: string;
      try {
        token = await this.tokenRefresh.getAccessToken(id, 'GITHUB');
      } catch (error) {
        this.logger.error('OAuth token not available', error as Error);
        throw new BadRequestException(
          'GitHub OAuth not configured for this project. Please connect GitHub via: POST /api/v1/auth/github/device/initiate'
        );
      }

      // Test repository access
      if (repoInfo.provider === 'github') {
        const github = new GitHubProvider(token);
        try {
          await github.getRepository(repoInfo.owner, repoInfo.repo);
          this.logger.info('Repository access verified', { owner: repoInfo.owner, repo: repoInfo.repo });
        } catch (error) {
          this.logger.error('Cannot access repository', error as Error);
          throw new BadRequestException(
            `Cannot access repository ${repoInfo.owner}/${repoInfo.repo}. Check OAuth permissions.`
          );
        }
      }

      // Update project with repository information
      const config = (project.config as any) || {};

      return this.prisma.project.update({
        where: { id },
        data: {
          repository: repositoryUrl,
          config: {
            ...config,
            vcs: {
              ...config.vcs,
              owner: repoInfo.owner,
              repo: repoInfo.repo,
              provider: repoInfo.provider,
            },
            project: {
              ...config.project,
              owner: repoInfo.owner,
              repo: repoInfo.repo,
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Failed to link repository', error as Error);
      throw new BadRequestException(`Invalid repository URL or cannot access repository: ${(error as Error).message}`);
    }
  }

  // ============================================
  // Integration Configuration (Figma, Sentry, GitHub Issues)
  // ============================================

  /**
   * Get project integrations configuration
   */
  async getIntegrations(id: string) {
    this.logger.info('Getting project integrations', { id });

    // Check if project exists
    await this.findOne(id);

    const integration = await this.prisma.projectIntegration.findUnique({
      where: { projectId: id },
    });

    return integration || {
      projectId: id,
      figmaFileKey: null,
      figmaNodeId: null,
      sentryProjectSlug: null,
      sentryOrgSlug: null,
      githubIssuesRepo: null,
    };
  }

  /**
   * Update project integrations configuration
   */
  async updateIntegrations(id: string, dto: UpdateIntegrationDto) {
    this.logger.info('Updating project integrations', { id, dto });

    // Check if project exists
    await this.findOne(id);

    // Upsert the integration record
    const integration = await this.prisma.projectIntegration.upsert({
      where: { projectId: id },
      create: {
        projectId: id,
        figmaTeamId: dto.figmaTeamId,
        figmaProjectId: dto.figmaProjectId,
        figmaFileKey: dto.figmaFileKey,
        figmaNodeId: dto.figmaNodeId,
        sentryProjectSlug: dto.sentryProjectSlug,
        sentryOrgSlug: dto.sentryOrgSlug,
        githubIssuesRepo: dto.githubIssuesRepo,
      },
      update: {
        figmaTeamId: dto.figmaTeamId,
        figmaProjectId: dto.figmaProjectId,
        figmaFileKey: dto.figmaFileKey,
        figmaNodeId: dto.figmaNodeId,
        sentryProjectSlug: dto.sentryProjectSlug,
        sentryOrgSlug: dto.sentryOrgSlug,
        githubIssuesRepo: dto.githubIssuesRepo,
      },
    });

    this.logger.info('Project integrations updated', { id, integration });

    return integration;
  }

  // ============================================
  // Linear Custom Fields Setup
  // ============================================

  /**
   * Setup DevFlow custom fields in Linear workspace
   */
  async setupLinearCustomFields(projectId: string, teamId: string) {
    this.logger.info('Setting up Linear custom fields', { projectId, teamId });

    // Check if project exists
    await this.findOne(projectId);

    // Get Linear OAuth token
    let token: string;
    try {
      token = await this.tokenRefresh.getAccessToken(projectId, 'LINEAR');
    } catch (error) {
      this.logger.error('Linear OAuth token not available', error as Error);
      throw new BadRequestException(
        'Linear OAuth not configured for this project. Please connect Linear first.'
      );
    }

    // Create Linear client and setup service
    const linearClient = createLinearClient(token);
    const setupService = createLinearSetupService(linearClient);

    try {
      // Ensure custom fields exist (create if missing)
      const result = await setupService.ensureCustomFields(teamId);

      this.logger.info('Linear custom fields setup complete', {
        projectId,
        teamId,
        created: result.created,
        existing: result.existing,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to setup Linear custom fields', error as Error);
      throw new BadRequestException(
        `Failed to setup Linear custom fields: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get Linear teams for a project
   */
  async getLinearTeams(projectId: string) {
    this.logger.info('Getting Linear teams', { projectId });

    // Check if project exists
    await this.findOne(projectId);

    // Get Linear OAuth token
    let token: string;
    try {
      token = await this.tokenRefresh.getAccessToken(projectId, 'LINEAR');
    } catch (error) {
      this.logger.error('Linear OAuth token not available', error as Error);
      throw new BadRequestException(
        'Linear OAuth not configured for this project. Please connect Linear first.'
      );
    }

    // Create Linear client and get teams
    const linearClient = createLinearClient(token);

    try {
      const teams = await linearClient.getTeams();
      this.logger.info('Linear teams retrieved', { projectId, count: teams.length });
      return teams;
    } catch (error) {
      this.logger.error('Failed to get Linear teams', error as Error);
      throw new BadRequestException(
        `Failed to get Linear teams: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get Linear workflow states for a team
   */
  async getLinearWorkflowStates(projectId: string, teamId: string) {
    this.logger.info('Getting Linear workflow states', { projectId, teamId });

    await this.findOne(projectId);

    let token: string;
    try {
      token = await this.tokenRefresh.getAccessToken(projectId, 'LINEAR');
    } catch (error) {
      this.logger.error('Linear OAuth token not available', error as Error);
      throw new BadRequestException(
        'Linear OAuth not configured for this project. Please connect Linear first.'
      );
    }

    const linearClient = createLinearClient(token);

    try {
      const states = await linearClient.getWorkflowStates(teamId);
      this.logger.info('Linear workflow states retrieved', { projectId, teamId, count: states.length });
      return states;
    } catch (error) {
      this.logger.error('Failed to get Linear workflow states', error as Error);
      throw new BadRequestException(
        `Failed to get Linear workflow states: ${(error as Error).message}`
      );
    }
  }

  /**
   * Validate DevFlow workflow states in a Linear team
   */
  async validateLinearWorkflowStates(projectId: string, teamId: string) {
    this.logger.info('Validating Linear workflow states', { projectId, teamId });

    await this.findOne(projectId);

    let token: string;
    try {
      token = await this.tokenRefresh.getAccessToken(projectId, 'LINEAR');
    } catch (error) {
      throw new BadRequestException(
        'Linear OAuth not configured for this project. Please connect Linear first.'
      );
    }

    const linearClient = createLinearClient(token);
    const setupService = createLinearSetupService(linearClient);

    try {
      const result = await setupService.validateWorkflowStates(teamId);
      this.logger.info('Workflow states validation complete', { projectId, teamId, result });
      return result;
    } catch (error) {
      this.logger.error('Failed to validate workflow states', error as Error);
      throw new BadRequestException(
        `Failed to validate workflow states: ${(error as Error).message}`
      );
    }
  }

  /**
   * Create missing DevFlow workflow states in a Linear team
   */
  async createLinearWorkflowStates(projectId: string, teamId: string) {
    this.logger.info('Creating Linear workflow states', { projectId, teamId });

    await this.findOne(projectId);

    let token: string;
    try {
      token = await this.tokenRefresh.getAccessToken(projectId, 'LINEAR');
    } catch (error) {
      throw new BadRequestException(
        'Linear OAuth not configured for this project. Please connect Linear first.'
      );
    }

    const linearClient = createLinearClient(token);
    const setupService = createLinearSetupService(linearClient);

    try {
      const result = await setupService.createMissingWorkflowStates(teamId);
      this.logger.info('Workflow states creation complete', { projectId, teamId, result });
      return result;
    } catch (error) {
      this.logger.error('Failed to create workflow states', error as Error);
      throw new BadRequestException(
        `Failed to create workflow states: ${(error as Error).message}`
      );
    }
  }

  /**
   * Save Linear team selection for a project
   */
  async saveLinearTeamSelection(projectId: string, teamId: string, teamName?: string) {
    this.logger.info('Saving Linear team selection', { projectId, teamId });

    await this.findOne(projectId);

    // Find the OrganizationProject link
    const orgProject = await this.prisma.organizationProject.findFirst({
      where: { projectId },
    });

    if (!orgProject) {
      throw new NotFoundException('Project organization link not found');
    }

    // Update with the selected team
    await this.prisma.organizationProject.update({
      where: { id: orgProject.id },
      data: { linearTeamId: teamId },
    });

    this.logger.info('Linear team selection saved', { projectId, teamId });
    return { teamId, teamName };
  }

  /**
   * Get saved Linear team for a project
   */
  async getLinearTeamSelection(projectId: string) {
    this.logger.info('Getting Linear team selection', { projectId });

    await this.findOne(projectId);

    const orgProject = await this.prisma.organizationProject.findFirst({
      where: { projectId },
    });

    return { teamId: orgProject?.linearTeamId || null };
  }

  // ============================================
  // Sentry Project Selection
  // ============================================

  /**
   * Get Sentry organizations for a project
   */
  async getSentryOrganizations(projectId: string): Promise<SentryOrganization[]> {
    this.logger.info('Getting Sentry organizations', { projectId });

    await this.findOne(projectId);

    const sentryService = createSentryIntegrationService(this.tokenRefresh);

    try {
      const orgs = await sentryService.listOrganizations(projectId);
      this.logger.info('Sentry organizations retrieved', { projectId, count: orgs.length });
      return orgs;
    } catch (error) {
      this.logger.error('Failed to get Sentry organizations', error as Error);
      throw new BadRequestException(
        `Failed to get Sentry organizations: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get Sentry projects for an organization
   */
  async getSentryProjects(projectId: string, orgSlug: string): Promise<SentryProjectDetail[]> {
    this.logger.info('Getting Sentry projects', { projectId, orgSlug });

    await this.findOne(projectId);

    const sentryService = createSentryIntegrationService(this.tokenRefresh);

    try {
      const projects = await sentryService.listProjects(projectId, orgSlug);
      this.logger.info('Sentry projects retrieved', { projectId, orgSlug, count: projects.length });
      return projects;
    } catch (error) {
      this.logger.error('Failed to get Sentry projects', error as Error);
      throw new BadRequestException(
        `Failed to get Sentry projects: ${(error as Error).message}`
      );
    }
  }

  /**
   * Save Sentry project selection
   */
  async saveSentryProjectSelection(
    projectId: string,
    orgSlug: string,
    sentryProjectSlug: string,
  ) {
    this.logger.info('Saving Sentry project selection', { projectId, orgSlug, sentryProjectSlug });

    await this.findOne(projectId);

    // Upsert the integration record
    const integration = await this.prisma.projectIntegration.upsert({
      where: { projectId },
      create: {
        projectId,
        sentryOrgSlug: orgSlug,
        sentryProjectSlug,
      },
      update: {
        sentryOrgSlug: orgSlug,
        sentryProjectSlug,
      },
    });

    this.logger.info('Sentry project selection saved', { projectId, orgSlug, sentryProjectSlug });
    return integration;
  }

  /**
   * Get saved Sentry project selection
   */
  async getSentryProjectSelection(projectId: string) {
    this.logger.info('Getting Sentry project selection', { projectId });

    await this.findOne(projectId);

    const integration = await this.prisma.projectIntegration.findUnique({
      where: { projectId },
    });

    return {
      orgSlug: integration?.sentryOrgSlug || null,
      projectSlug: integration?.sentryProjectSlug || null,
    };
  }

  // ============================================
  // Slack Channel Selection
  // ============================================

  /**
   * Get Slack channels for a project
   */
  async getSlackChannels(projectId: string): Promise<SlackChannel[]> {
    this.logger.info('Getting Slack channels', { projectId });

    await this.findOne(projectId);

    const slackService = createSlackIntegrationService(this.tokenRefresh);

    try {
      const channels = await slackService.listChannels(projectId);
      this.logger.info('Slack channels retrieved', { projectId, count: channels.length });
      return channels;
    } catch (error) {
      this.logger.error('Failed to get Slack channels', error as Error);
      throw new BadRequestException(
        `Failed to get Slack channels: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get Slack team info for a project
   */
  async getSlackTeamInfo(projectId: string): Promise<SlackTeam> {
    this.logger.info('Getting Slack team info', { projectId });

    await this.findOne(projectId);

    const slackService = createSlackIntegrationService(this.tokenRefresh);

    try {
      const team = await slackService.getTeamInfo(projectId);
      this.logger.info('Slack team info retrieved', { projectId, teamId: team.id, teamName: team.name });
      return team;
    } catch (error) {
      this.logger.error('Failed to get Slack team info', error as Error);
      throw new BadRequestException(
        `Failed to get Slack team info: ${(error as Error).message}`
      );
    }
  }

  /**
   * Save Slack channel selection and auto-join the channel
   */
  async saveSlackChannelSelection(
    projectId: string,
    channelId: string,
    channelName: string,
  ) {
    this.logger.info('Saving Slack channel selection', { projectId, channelId, channelName });

    await this.findOne(projectId);

    // First, join the channel (auto-join feature)
    const slackService = createSlackIntegrationService(this.tokenRefresh);
    try {
      await slackService.joinChannel(projectId, channelId);
      this.logger.info('Bot joined Slack channel', { projectId, channelId });
    } catch (error) {
      // Log but don't fail - bot might already be in the channel
      this.logger.warn('Failed to join Slack channel (may already be member)', {
        projectId,
        channelId,
        error: (error as Error).message
      });
    }

    // Get team info to store team name
    let teamId: string | null = null;
    let teamName: string | null = null;
    try {
      const team = await slackService.getTeamInfo(projectId);
      teamId = team.id;
      teamName = team.name;
    } catch (error) {
      this.logger.warn('Failed to get Slack team info', { projectId, error: (error as Error).message });
    }

    // Upsert the integration record
    const integration = await this.prisma.projectIntegration.upsert({
      where: { projectId },
      create: {
        projectId,
        slackTeamId: teamId,
        slackTeamName: teamName,
        slackChannelId: channelId,
        slackChannelName: channelName,
      },
      update: {
        slackTeamId: teamId,
        slackTeamName: teamName,
        slackChannelId: channelId,
        slackChannelName: channelName,
      },
    });

    this.logger.info('Slack channel selection saved', { projectId, channelId, channelName, teamId, teamName });
    return integration;
  }

  /**
   * Get saved Slack channel selection
   */
  async getSlackChannelSelection(projectId: string) {
    this.logger.info('Getting Slack channel selection', { projectId });

    await this.findOne(projectId);

    const integration = await this.prisma.projectIntegration.findUnique({
      where: { projectId },
    });

    return {
      teamId: integration?.slackTeamId || null,
      teamName: integration?.slackTeamName || null,
      channelId: integration?.slackChannelId || null,
      channelName: integration?.slackChannelName || null,
    };
  }

  // ============================================
  // GitHub Repository Selection (via GitHub App)
  // ============================================

  /**
   * Get available repositories from GitHub App installation for a project
   */
  async getAvailableRepositories(projectId: string): Promise<{
    availableRepositories: Array<{ fullName: string; url: string }>;
    hasGitHubApp: boolean;
  }> {
    this.logger.info('Getting available repositories from GitHub App', { projectId });

    await this.findOne(projectId);

    // Find active GitHub App installation for this project
    const installation = await this.prisma.gitHubAppInstallation.findFirst({
      where: {
        projectId,
        isActive: true,
        isSuspended: false,
      },
    });

    if (!installation) {
      this.logger.info('No active GitHub App installation found', { projectId });
      return {
        availableRepositories: [],
        hasGitHubApp: false,
      };
    }

    // Map selectedRepos to the expected format
    const availableRepositories = installation.selectedRepos.map((fullName) => ({
      fullName,
      url: `https://github.com/${fullName}`,
    }));

    this.logger.info('Available repositories retrieved', {
      projectId,
      count: availableRepositories.length,
    });

    return {
      availableRepositories,
      hasGitHubApp: true,
    };
  }
}
