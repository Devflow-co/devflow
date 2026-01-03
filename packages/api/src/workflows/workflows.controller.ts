/**
 * Workflows Controller
 */

import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { WorkflowsService } from '@/workflows/workflows.service';
import { StartWorkflowDto } from '@/workflows/dto';

@ApiTags('Workflows')
@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post('start')
  @ApiOperation({ summary: 'Start a new workflow' })
  @ApiResponse({ status: 201, description: 'Workflow started' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async start(@Body() dto: StartWorkflowDto) {
    return this.workflowsService.start(dto);
  }

  @Get('projects/:projectId/workflows')
  @ApiOperation({ summary: 'List workflows for a project' })
  @ApiResponse({ status: 200, description: 'Workflows list' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of workflows to return' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by workflow status' })
  async listProjectWorkflows(
    @Param('projectId') projectId: string,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.workflowsService.listProjectWorkflows(projectId, { limit, status });
  }

  @Get(':id/progress')
  @ApiOperation({ summary: 'Get detailed workflow progress' })
  @ApiResponse({ status: 200, description: 'Workflow progress with step details' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async getProgress(@Param('id') id: string) {
    return this.workflowsService.getWorkflowProgress(id);
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Get workflow activity timeline' })
  @ApiResponse({ status: 200, description: 'Workflow timeline' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async getTimeline(@Param('id') id: string) {
    return this.workflowsService.getWorkflowTimeline(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workflow status' })
  @ApiResponse({ status: 200, description: 'Workflow status' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async getStatus(@Param('id') id: string) {
    return this.workflowsService.getStatus(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a workflow' })
  @ApiResponse({ status: 200, description: 'Workflow cancelled' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async cancel(@Param('id') id: string) {
    return this.workflowsService.cancel(id);
  }
}

