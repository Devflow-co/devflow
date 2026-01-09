import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import {
  SupabaseStorageService,
  createSupabaseStorageService,
  MAX_LOGO_SIZE,
  StorageError,
} from '@devflow/sdk';
import { Role } from '@prisma/client';
import {
  UpdateOrganizationDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
} from './dto';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);
  private storageService: SupabaseStorageService | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.initStorageService();
  }

  private initStorageService(): void {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_KEY');
    const bucket = this.configService.get<string>('SUPABASE_BUCKET');

    if (supabaseUrl && supabaseServiceKey && bucket) {
      this.storageService = createSupabaseStorageService({
        supabaseUrl,
        supabaseServiceKey,
        bucket,
      });
    }
  }

  /**
   * Get organization by ID
   */
  async findOne(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  /**
   * Get user's primary organization
   */
  async getUserOrganization(userId: string) {
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId },
      include: { organization: true },
      orderBy: { role: 'desc' }, // Prefer orgs where user has higher role
    });

    if (!membership) {
      throw new NotFoundException('No organization found for user');
    }

    return {
      ...membership.organization,
      userRole: membership.role,
    };
  }

  /**
   * Update organization settings
   */
  async update(organizationId: string, dto: UpdateOrganizationDto) {
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        name: dto.name,
        billingEmail: dto.billingEmail,
      },
    });
  }

  /**
   * Upload organization logo
   */
  async uploadLogo(
    organizationId: string,
    file: Express.Multer.File,
  ): Promise<{ logo: string }> {
    if (!this.storageService) {
      throw new BadRequestException('Logo uploads not configured');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { logo: true },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    try {
      const result = await this.storageService.upload(file.buffer, {
        folder: 'logos',
        fileName: organizationId,
        contentType: file.mimetype,
        maxSizeBytes: MAX_LOGO_SIZE,
      });

      // Delete old logo if exists
      if (org.logo && this.storageService.extractPathFromUrl(org.logo)) {
        try {
          await this.storageService.deleteByUrl(org.logo);
        } catch (deleteError) {
          this.logger.warn(`Failed to delete old logo: ${deleteError}`);
        }
      }

      await this.prisma.organization.update({
        where: { id: organizationId },
        data: { logo: result.publicUrl },
      });

      return { logo: result.publicUrl };
    } catch (error) {
      if (error instanceof StorageError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * Remove organization logo
   */
  async removeLogo(organizationId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { logo: true },
    });

    if (org?.logo && this.storageService) {
      const path = this.storageService.extractPathFromUrl(org.logo);
      if (path) {
        try {
          await this.storageService.delete(path);
        } catch (error) {
          this.logger.warn(`Failed to delete logo from storage: ${error}`);
        }
      }
    }

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { logo: null },
    });
  }

  /**
   * List organization members
   */
  async listMembers(organizationId: string) {
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: [{ role: 'desc' }, { joinedAt: 'asc' }],
    });

    return members;
  }

  /**
   * Invite a new member to the organization
   */
  async inviteMember(
    organizationId: string,
    dto: InviteMemberDto,
    inviterId: string,
    inviterRole: Role,
  ) {
    // Cannot invite as OWNER
    if (dto.role === Role.OWNER) {
      throw new ForbiddenException('Cannot invite as OWNER');
    }

    // Only OWNER can invite ADMIN
    if (dto.role === Role.ADMIN && inviterRole !== Role.OWNER) {
      throw new ForbiddenException('Only OWNER can invite ADMIN members');
    }

    // Check if user exists
    let user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // Create placeholder user if doesn't exist
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          emailVerified: false,
        },
      });
    }

    // Check if already a member
    const existingMember = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: user.id,
        },
      },
    });

    if (existingMember) {
      throw new BadRequestException('User is already a member of this organization');
    }

    // Add member
    const member = await this.prisma.organizationMember.create({
      data: {
        organizationId,
        userId: user.id,
        role: dto.role || Role.VIEWER,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    // TODO: Send invitation email

    return member;
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    organizationId: string,
    memberId: string,
    dto: UpdateMemberRoleDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.organizationId !== organizationId) {
      throw new NotFoundException('Member not found');
    }

    // Cannot change own role
    if (member.userId === requesterId) {
      throw new ForbiddenException('Cannot change your own role');
    }

    // Cannot modify OWNER
    if (member.role === Role.OWNER) {
      throw new ForbiddenException('Cannot modify OWNER role');
    }

    // Cannot set as OWNER
    if (dto.role === Role.OWNER) {
      throw new ForbiddenException('Cannot set role to OWNER');
    }

    // Only OWNER can change to/from ADMIN
    if (
      (member.role === Role.ADMIN || dto.role === Role.ADMIN) &&
      requesterRole !== Role.OWNER
    ) {
      throw new ForbiddenException('Only OWNER can manage ADMIN roles');
    }

    return this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { role: dto.role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
  }

  /**
   * Remove member from organization
   */
  async removeMember(
    organizationId: string,
    memberId: string,
    requesterId: string,
    requesterRole: Role,
  ) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.organizationId !== organizationId) {
      throw new NotFoundException('Member not found');
    }

    // Cannot remove yourself
    if (member.userId === requesterId) {
      throw new ForbiddenException('Cannot remove yourself from organization');
    }

    // Cannot remove OWNER
    if (member.role === Role.OWNER) {
      throw new ForbiddenException('Cannot remove OWNER from organization');
    }

    // Only OWNER can remove ADMIN
    if (member.role === Role.ADMIN && requesterRole !== Role.OWNER) {
      throw new ForbiddenException('Only OWNER can remove ADMIN members');
    }

    await this.prisma.organizationMember.delete({
      where: { id: memberId },
    });
  }
}
