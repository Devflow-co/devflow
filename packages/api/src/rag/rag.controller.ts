/**
 * RAG Controller
 * Endpoints for semantic search, chunk browsing, and codebase indexing
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { AuthGuard } from '@/user-auth/guards/auth.guard';
import { CurrentUser } from '@/user-auth/decorators/current-user.decorator';
import { ProjectsService } from '@/projects/projects.service';
import { RagService } from './rag.service';
import { SearchQueryDto, BrowseChunksDto, TriggerIndexingDto } from './dto';

@ApiTags('RAG')
@Controller('projects/:projectId/rag')
@UseGuards(AuthGuard)
export class RagController {
  constructor(
    private readonly ragService: RagService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get RAG statistics for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'RAG statistics' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getStats(
    @Param('projectId') projectId: string,
    @CurrentUser() user: User,
  ) {
    await this.verifyAccess(projectId, user.id);
    return this.ragService.getStats(projectId);
  }

  @Get('chunks')
  @ApiOperation({ summary: 'Browse indexed chunks with pagination' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (1-indexed)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (1-100)' })
  @ApiQuery({ name: 'language', required: false, type: String, description: 'Filter by language' })
  @ApiQuery({ name: 'chunkType', required: false, type: String, description: 'Filter by chunk type' })
  @ApiQuery({ name: 'filePath', required: false, type: String, description: 'Filter by file path prefix' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search text in content' })
  @ApiResponse({ status: 200, description: 'Paginated list of chunks' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async browseChunks(
    @Param('projectId') projectId: string,
    @Query() dto: BrowseChunksDto,
    @CurrentUser() user: User,
  ) {
    await this.verifyAccess(projectId, user.id);
    return this.ragService.browseChunks(projectId, dto);
  }

  @Post('search')
  @ApiOperation({ summary: 'Search using semantic or hybrid retrieval' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Search results' })
  @ApiResponse({ status: 400, description: 'No codebase index found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async search(
    @Param('projectId') projectId: string,
    @Body() dto: SearchQueryDto,
    @CurrentUser() user: User,
  ) {
    await this.verifyAccess(projectId, user.id);
    return this.ragService.search(projectId, dto);
  }

  @Post('reindex')
  @ApiOperation({ summary: 'Trigger codebase re-indexing' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Indexing started' })
  @ApiResponse({ status: 400, description: 'Repository not linked or indexing already in progress' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async triggerReindex(
    @Param('projectId') projectId: string,
    @Body() dto: TriggerIndexingDto,
    @CurrentUser() user: User,
  ) {
    await this.verifyAccess(projectId, user.id);
    return this.ragService.triggerReindex(projectId, dto);
  }

  @Get('index-status')
  @ApiOperation({ summary: 'Get current indexing status' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Indexing status' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getIndexStatus(
    @Param('projectId') projectId: string,
    @CurrentUser() user: User,
  ) {
    await this.verifyAccess(projectId, user.id);
    return this.ragService.getIndexStatus(projectId);
  }

  /**
   * Verify that the user has access to the project
   */
  private async verifyAccess(projectId: string, userId: string): Promise<void> {
    const hasAccess = await this.projectsService.userHasAccess(projectId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this project');
    }
  }
}
