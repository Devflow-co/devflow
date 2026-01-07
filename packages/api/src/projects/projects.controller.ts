/**
 * Projects Controller
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { AuthGuard } from '@/user-auth/guards/auth.guard';
import { CurrentUser } from '@/user-auth/decorators/current-user.decorator';
import { ProjectsService } from '@/projects/projects.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  LinkRepositoryDto,
  UpdateIntegrationDto,
} from '@/projects/dto';

@ApiTags('Projects')
@Controller('projects')
@UseGuards(AuthGuard) // Protect all endpoints
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List all projects accessible by the user' })
  @ApiResponse({ status: 200, description: 'List of projects' })
  async findAll(@CurrentUser() user: User) {
    return this.projectsService.findByUserId(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  @ApiResponse({ status: 200, description: 'Project details' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    await this.verifyAccess(id, user.id);
    return this.projectsService.findOne(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get project statistics' })
  @ApiResponse({ status: 200, description: 'Project statistics' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getStatistics(@Param('id') id: string, @CurrentUser() user: User) {
    await this.verifyAccess(id, user.id);
    return this.projectsService.getStatistics(id);
  }

  @Post(':id/link-repository')
  @ApiOperation({ summary: 'Link a repository to a project' })
  @ApiResponse({ status: 200, description: 'Repository linked successfully' })
  @ApiResponse({ status: 400, description: 'Invalid repository URL or cannot access repository' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async linkRepository(
    @Param('id') id: string,
    @Body() dto: LinkRepositoryDto,
    @CurrentUser() user: User,
  ) {
    await this.verifyAccess(id, user.id);
    return this.projectsService.linkRepository(id, dto.repositoryUrl);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({ status: 201, description: 'Project created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async create(@Body() createProjectDto: CreateProjectDto, @CurrentUser() user: User) {
    return this.projectsService.createForUser(createProjectDto, user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update project' })
  @ApiResponse({ status: 200, description: 'Project updated' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @CurrentUser() user: User,
  ) {
    await this.verifyAccess(id, user.id);
    return this.projectsService.update(id, updateProjectDto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete project' })
  @ApiResponse({ status: 204, description: 'Project deleted' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    await this.verifyAccess(id, user.id);
    return this.projectsService.remove(id);
  }

  // ============================================
  // Integration Configuration (Figma, Sentry, GitHub Issues)
  // ============================================

  @Get(':id/integrations')
  @ApiOperation({ summary: 'Get project integrations configuration' })
  @ApiResponse({ status: 200, description: 'Integration configuration' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getIntegrations(@Param('id') id: string, @CurrentUser() user: User) {
    await this.verifyAccess(id, user.id);
    return this.projectsService.getIntegrations(id);
  }

  @Put(':id/integrations')
  @ApiOperation({ summary: 'Update project integrations configuration' })
  @ApiResponse({ status: 200, description: 'Integration configuration updated' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async updateIntegrations(
    @Param('id') id: string,
    @Body() dto: UpdateIntegrationDto,
    @CurrentUser() user: User,
  ) {
    await this.verifyAccess(id, user.id);
    return this.projectsService.updateIntegrations(id, dto);
  }

  // ============================================
  // Linear Custom Fields Setup
  // ============================================

  @Post(':id/linear/setup-custom-fields')
  @ApiOperation({ summary: 'Setup DevFlow custom fields in Linear workspace' })
  @ApiResponse({
    status: 200,
    description: 'Custom fields created/verified',
    schema: {
      type: 'object',
      properties: {
        created: { type: 'array', items: { type: 'string' } },
        existing: { type: 'array', items: { type: 'string' } },
        fieldIds: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Linear OAuth not configured' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async setupLinearCustomFields(
    @Param('id') id: string,
    @Body() dto: { teamId: string },
    @CurrentUser() user: User,
  ) {
    await this.verifyAccess(id, user.id);
    return this.projectsService.setupLinearCustomFields(id, dto.teamId);
  }

  @Get(':id/linear/teams')
  @ApiOperation({ summary: 'Get Linear teams for the project' })
  @ApiResponse({ status: 200, description: 'List of Linear teams' })
  @ApiResponse({ status: 400, description: 'Linear OAuth not configured' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getLinearTeams(@Param('id') id: string, @CurrentUser() user: User) {
    await this.verifyAccess(id, user.id);
    return this.projectsService.getLinearTeams(id);
  }

  @Get(':id/linear/team')
  @ApiOperation({ summary: 'Get saved Linear team selection for project' })
  @ApiResponse({
    status: 200,
    description: 'Saved team selection',
    schema: {
      type: 'object',
      properties: {
        teamId: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getLinearTeamSelection(@Param('id') id: string, @CurrentUser() user: User) {
    await this.verifyAccess(id, user.id);
    return this.projectsService.getLinearTeamSelection(id);
  }

  @Post(':id/linear/team')
  @ApiOperation({ summary: 'Save Linear team selection for project' })
  @ApiResponse({
    status: 200,
    description: 'Team selection saved',
    schema: {
      type: 'object',
      properties: {
        teamId: { type: 'string' },
        teamName: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async saveLinearTeamSelection(
    @Param('id') id: string,
    @Body() dto: { teamId: string; teamName?: string },
    @CurrentUser() user: User,
  ) {
    await this.verifyAccess(id, user.id);
    return this.projectsService.saveLinearTeamSelection(id, dto.teamId, dto.teamName);
  }

  @Get(':id/linear/workflow-states/:teamId')
  @ApiOperation({ summary: 'Get Linear workflow states for a team' })
  @ApiResponse({ status: 200, description: 'List of workflow states' })
  @ApiResponse({ status: 400, description: 'Linear OAuth not configured' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getLinearWorkflowStates(
    @Param('id') id: string,
    @Param('teamId') teamId: string,
    @CurrentUser() user: User,
  ) {
    await this.verifyAccess(id, user.id);
    return this.projectsService.getLinearWorkflowStates(id, teamId);
  }

  @Get(':id/linear/workflow-states/:teamId/validate')
  @ApiOperation({ summary: 'Validate DevFlow workflow states in a Linear team' })
  @ApiResponse({
    status: 200,
    description: 'Validation result',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        existingStates: { type: 'array', items: { type: 'object' } },
        missingStates: { type: 'array', items: { type: 'string' } },
        totalRequired: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Linear OAuth not configured' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async validateLinearWorkflowStates(
    @Param('id') id: string,
    @Param('teamId') teamId: string,
    @CurrentUser() user: User,
  ) {
    await this.verifyAccess(id, user.id);
    return this.projectsService.validateLinearWorkflowStates(id, teamId);
  }

  @Post(':id/linear/workflow-states/:teamId/create')
  @ApiOperation({ summary: 'Create missing DevFlow workflow states in a Linear team' })
  @ApiResponse({
    status: 200,
    description: 'Creation result',
    schema: {
      type: 'object',
      properties: {
        created: { type: 'array', items: { type: 'string' } },
        existing: { type: 'array', items: { type: 'string' } },
        errors: { type: 'array', items: { type: 'object' } },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Linear OAuth not configured' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async createLinearWorkflowStates(
    @Param('id') id: string,
    @Param('teamId') teamId: string,
    @CurrentUser() user: User,
  ) {
    await this.verifyAccess(id, user.id);
    return this.projectsService.createLinearWorkflowStates(id, teamId);
  }

  // ============================================
  // Sentry Project Selection
  // ============================================

  @Get(':id/sentry/organizations')
  @ApiOperation({ summary: 'Get Sentry organizations for the project' })
  @ApiResponse({ status: 200, description: 'List of Sentry organizations' })
  @ApiResponse({ status: 400, description: 'Sentry OAuth not configured' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getSentryOrganizations(@Param('id') id: string, @CurrentUser() user: User) {
    await this.verifyAccess(id, user.id);
    return this.projectsService.getSentryOrganizations(id);
  }

  @Get(':id/sentry/projects/:orgSlug')
  @ApiOperation({ summary: 'Get Sentry projects for an organization' })
  @ApiResponse({ status: 200, description: 'List of Sentry projects' })
  @ApiResponse({ status: 400, description: 'Sentry OAuth not configured' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getSentryProjects(
    @Param('id') id: string,
    @Param('orgSlug') orgSlug: string,
    @CurrentUser() user: User,
  ) {
    await this.verifyAccess(id, user.id);
    return this.projectsService.getSentryProjects(id, orgSlug);
  }

  @Get(':id/sentry/project')
  @ApiOperation({ summary: 'Get saved Sentry project selection' })
  @ApiResponse({
    status: 200,
    description: 'Saved Sentry project selection',
    schema: {
      type: 'object',
      properties: {
        orgSlug: { type: 'string', nullable: true },
        projectSlug: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getSentryProjectSelection(@Param('id') id: string, @CurrentUser() user: User) {
    await this.verifyAccess(id, user.id);
    return this.projectsService.getSentryProjectSelection(id);
  }

  @Post(':id/sentry/project')
  @ApiOperation({ summary: 'Save Sentry project selection' })
  @ApiResponse({ status: 200, description: 'Sentry project selection saved' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async saveSentryProjectSelection(
    @Param('id') id: string,
    @Body() dto: { orgSlug: string; projectSlug: string },
    @CurrentUser() user: User,
  ) {
    await this.verifyAccess(id, user.id);
    return this.projectsService.saveSentryProjectSelection(id, dto.orgSlug, dto.projectSlug);
  }

  // ============================================
  // Slack Channel Selection
  // ============================================

  @Get(':id/slack/channels')
  @ApiOperation({ summary: 'Get Slack channels for the project' })
  @ApiResponse({ status: 200, description: 'List of Slack channels' })
  @ApiResponse({ status: 400, description: 'Slack OAuth not configured' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getSlackChannels(@Param('id') id: string, @CurrentUser() user: User) {
    await this.verifyAccess(id, user.id);
    return this.projectsService.getSlackChannels(id);
  }

  @Get(':id/slack/channel')
  @ApiOperation({ summary: 'Get saved Slack channel selection' })
  @ApiResponse({
    status: 200,
    description: 'Saved Slack channel selection',
    schema: {
      type: 'object',
      properties: {
        teamId: { type: 'string', nullable: true },
        teamName: { type: 'string', nullable: true },
        channelId: { type: 'string', nullable: true },
        channelName: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getSlackChannelSelection(@Param('id') id: string, @CurrentUser() user: User) {
    await this.verifyAccess(id, user.id);
    return this.projectsService.getSlackChannelSelection(id);
  }

  @Post(':id/slack/channel')
  @ApiOperation({ summary: 'Save Slack channel selection and auto-join' })
  @ApiResponse({ status: 200, description: 'Slack channel selection saved' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async saveSlackChannelSelection(
    @Param('id') id: string,
    @Body() dto: { channelId: string; channelName: string },
    @CurrentUser() user: User,
  ) {
    await this.verifyAccess(id, user.id);
    return this.projectsService.saveSlackChannelSelection(id, dto.channelId, dto.channelName);
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private async verifyAccess(projectId: string, userId: string): Promise<void> {
    const hasAccess = await this.projectsService.userHasAccess(projectId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this project');
    }
  }
}
