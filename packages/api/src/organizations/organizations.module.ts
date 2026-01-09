import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { OrgRoleGuard } from './guards';
import { UserAuthModule } from '@/user-auth/user-auth.module';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [UserAuthModule, PrismaModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrgRoleGuard],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
