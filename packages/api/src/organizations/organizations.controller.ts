import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { User, Role, OrganizationMember } from '@prisma/client';
import { Request } from 'express';
import { AuthGuard } from '@/user-auth/guards/auth.guard';
import { CurrentUser } from '@/user-auth/decorators/current-user.decorator';
import { OrgRoleGuard, RequiredRoles } from './guards';
import { OrganizationsService } from './organizations.service';
import {
  UpdateOrganizationDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
} from './dto';

const MAX_LOGO_SIZE = 10 * 1024 * 1024; // 10MB

// Extend Request to include orgMembership
interface RequestWithMembership extends Request {
  orgMembership?: OrganizationMember;
}

@ApiTags('Organizations')
@Controller('organizations')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current user organization' })
  @ApiResponse({ status: 200, description: 'Organization found' })
  @ApiResponse({ status: 404, description: 'No organization found' })
  async getCurrentOrganization(@CurrentUser() user: User) {
    return this.organizationsService.getUserOrganization(user.id);
  }

  @Get(':id')
  @UseGuards(OrgRoleGuard)
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Organization found' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async findOne(@Param('id') id: string) {
    return this.organizationsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(OrgRoleGuard)
  @RequiredRoles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Update organization settings' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Organization updated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(id, dto);
  }

  @Post(':id/logo')
  @UseGuards(OrgRoleGuard)
  @RequiredRoles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Upload organization logo' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Logo image (PNG, JPG, WebP, GIF - max 10MB)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Logo uploaded' })
  @ApiResponse({ status: 400, description: 'Invalid file or upload failed' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_LOGO_SIZE }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp|gif)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.organizationsService.uploadLogo(id, file);
  }

  @Delete(':id/logo')
  @UseGuards(OrgRoleGuard)
  @RequiredRoles(Role.OWNER, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove organization logo' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 204, description: 'Logo removed' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async removeLogo(@Param('id') id: string) {
    await this.organizationsService.removeLogo(id);
  }

  @Get(':id/members')
  @UseGuards(OrgRoleGuard)
  @ApiOperation({ summary: 'List organization members' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Members list' })
  async listMembers(@Param('id') id: string) {
    return this.organizationsService.listMembers(id);
  }

  @Post(':id/members')
  @UseGuards(OrgRoleGuard)
  @RequiredRoles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Invite new member to organization' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 201, description: 'Member invited' })
  @ApiResponse({ status: 400, description: 'User already a member' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async inviteMember(
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser() user: User,
    @Req() req: RequestWithMembership,
  ) {
    return this.organizationsService.inviteMember(
      id,
      dto,
      user.id,
      req.orgMembership?.role || Role.VIEWER,
    );
  }

  @Put(':id/members/:memberId/role')
  @UseGuards(OrgRoleGuard)
  @RequiredRoles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Update member role' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async updateMemberRole(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: User,
    @Req() req: RequestWithMembership,
  ) {
    return this.organizationsService.updateMemberRole(
      id,
      memberId,
      dto,
      user.id,
      req.orgMembership?.role || Role.VIEWER,
    );
  }

  @Delete(':id/members/:memberId')
  @UseGuards(OrgRoleGuard)
  @RequiredRoles(Role.OWNER, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove member from organization' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  @ApiResponse({ status: 204, description: 'Member removed' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: User,
    @Req() req: RequestWithMembership,
  ) {
    await this.organizationsService.removeMember(
      id,
      memberId,
      user.id,
      req.orgMembership?.role || Role.VIEWER,
    );
  }
}
