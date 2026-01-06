import { Controller, Get, Param, Query, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { FigmaApiService } from './figma-api.service';
import { FigmaProject, FigmaFileListItem } from '@devflow/sdk';

/**
 * Figma API Controller
 *
 * Provides endpoints to list Figma teams, projects, and files
 * for the OAuth file picker flow
 */
@Controller('integrations/figma')
export class FigmaApiController {
  private readonly logger = new Logger(FigmaApiController.name);

  constructor(private readonly figmaService: FigmaApiService) {}

  /**
   * List all projects in a Figma team
   *
   * GET /integrations/figma/teams/:teamId/projects?projectId=xxx
   *
   * @param teamId - Figma team ID from team page URL
   * @param projectId - DevFlow project ID for token resolution (query param)
   */
  @Get('teams/:teamId/projects')
  async listTeamProjects(
    @Param('teamId') teamId: string,
    @Query('projectId') projectId: string,
  ): Promise<{ projects: FigmaProject[] }> {
    if (!projectId) {
      throw new HttpException('projectId query parameter is required', HttpStatus.BAD_REQUEST);
    }

    if (!teamId) {
      throw new HttpException('teamId path parameter is required', HttpStatus.BAD_REQUEST);
    }

    this.logger.log(`Listing projects for team ${teamId}, project ${projectId}`);

    try {
      const projects = await this.figmaService.listTeamProjects(projectId, teamId);
      return { projects };
    } catch (error: any) {
      this.logger.error(`Failed to list team projects: ${error.message}`, error.stack);
      throw new HttpException(
        error.message || 'Failed to list team projects',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * List all files in a Figma project
   *
   * GET /integrations/figma/projects/:figmaProjectId/files?projectId=xxx
   *
   * @param figmaProjectId - Figma project ID (path param)
   * @param projectId - DevFlow project ID for token resolution (query param)
   */
  @Get('projects/:figmaProjectId/files')
  async listProjectFiles(
    @Param('figmaProjectId') figmaProjectId: string,
    @Query('projectId') projectId: string,
  ): Promise<{ files: FigmaFileListItem[] }> {
    if (!projectId) {
      throw new HttpException('projectId query parameter is required', HttpStatus.BAD_REQUEST);
    }

    if (!figmaProjectId) {
      throw new HttpException('figmaProjectId path parameter is required', HttpStatus.BAD_REQUEST);
    }

    this.logger.log(`Listing files for Figma project ${figmaProjectId}, DevFlow project ${projectId}`);

    try {
      const files = await this.figmaService.listProjectFiles(projectId, figmaProjectId);
      return { files };
    } catch (error: any) {
      this.logger.error(`Failed to list project files: ${error.message}`, error.stack);
      throw new HttpException(
        error.message || 'Failed to list project files',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
