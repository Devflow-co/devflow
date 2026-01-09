import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/prisma/prisma.service';
import { Role } from '@prisma/client';

export const REQUIRED_ROLES_KEY = 'requiredRoles';
export const RequiredRoles = (...roles: Role[]) =>
  SetMetadata(REQUIRED_ROLES_KEY, roles);

/**
 * Guard that checks if the current user has the required role in the organization.
 * Must be used after AuthGuard.
 * Expects organizationId in route params.
 */
@Injectable()
export class OrgRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(
      REQUIRED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles required, allow access (will be checked by AuthGuard only)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const organizationId = request.params.organizationId || request.params.id;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!organizationId) {
      throw new ForbiddenException('Organization ID required');
    }

    // Get user's membership in the organization
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Not a member of this organization');
    }

    // Check role hierarchy: OWNER > ADMIN > MAINTAINER > VIEWER
    const roleHierarchy: Record<Role, number> = {
      OWNER: 4,
      ADMIN: 3,
      MAINTAINER: 2,
      VIEWER: 1,
    };

    const userRoleLevel = roleHierarchy[membership.role];
    const minRequiredLevel = Math.min(
      ...requiredRoles.map((r) => roleHierarchy[r]),
    );

    if (userRoleLevel < minRequiredLevel) {
      throw new ForbiddenException(
        `Requires ${requiredRoles.join(' or ')} role`,
      );
    }

    // Attach membership to request for use in controllers
    request.orgMembership = membership;

    return true;
  }
}
