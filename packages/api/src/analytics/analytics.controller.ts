import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@/user-auth/guards/auth.guard';
import { PrismaService } from '@/prisma/prisma.service';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto, ProjectAnalyticsQueryDto } from './dto';

@Controller('analytics')
@UseGuards(AuthGuard)
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /analytics/organization
   * Get analytics for the user's primary organization
   */
  @Get('organization')
  async getOrganizationAnalytics(
    @Req() req: any,
    @Query() query: AnalyticsQueryDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    // Get user's primary organization
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId },
      orderBy: { role: 'desc' },
    });

    if (!membership) {
      throw new ForbiddenException('No organization found for user');
    }

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    this.logger.log(`Getting org analytics for user ${userId}, org ${membership.organizationId}`);

    return this.analyticsService.getOrganizationAnalytics(
      membership.organizationId,
      startDate,
      endDate,
    );
  }

  /**
   * GET /analytics/organizations/:organizationId
   * Get analytics for a specific organization (requires membership)
   */
  @Get('organizations/:organizationId')
  async getSpecificOrganizationAnalytics(
    @Req() req: any,
    @Param('organizationId') organizationId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    // Verify user is a member of this organization
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Not a member of this organization');
    }

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    return this.analyticsService.getOrganizationAnalytics(
      organizationId,
      startDate,
      endDate,
    );
  }

  /**
   * GET /analytics/projects/:projectId
   * Get analytics for a specific project (requires organization membership)
   */
  @Get('projects/:projectId')
  async getProjectAnalytics(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query() query: ProjectAnalyticsQueryDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    // Find project's organization and verify user membership
    const orgProject = await this.prisma.organizationProject.findFirst({
      where: {
        projectId,
        organization: {
          members: {
            some: { userId },
          },
        },
      },
    });

    if (!orgProject) {
      throw new ForbiddenException('Project not found or not accessible');
    }

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    this.logger.log(`Getting project analytics for project ${projectId}`);

    return this.analyticsService.getProjectAnalytics(
      projectId,
      orgProject.organizationId,
      startDate,
      endDate,
    );
  }

  /**
   * GET /analytics/performance
   * Get performance analytics (latency, cache, phase costs, forecast)
   * for the user's primary organization
   */
  @Get('performance')
  async getPerformanceAnalytics(
    @Req() req: any,
    @Query() query: AnalyticsQueryDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    // Get user's primary organization
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId },
      orderBy: { role: 'desc' },
    });

    if (!membership) {
      throw new ForbiddenException('No organization found for user');
    }

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    this.logger.log(`Getting performance analytics for user ${userId}, org ${membership.organizationId}`);

    return this.analyticsService.getPerformanceAnalytics(
      membership.organizationId,
      startDate,
      endDate,
    );
  }

  /**
   * GET /analytics/organizations/:organizationId/performance
   * Get performance analytics for a specific organization (requires membership)
   */
  @Get('organizations/:organizationId/performance')
  async getSpecificOrgPerformanceAnalytics(
    @Req() req: any,
    @Param('organizationId') organizationId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    // Verify user is a member of this organization
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Not a member of this organization');
    }

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    return this.analyticsService.getPerformanceAnalytics(
      organizationId,
      startDate,
      endDate,
    );
  }
}
