import { Module } from '@nestjs/common';
import { UserSettingsController } from './user-settings.controller';
import { UserSettingsService } from './user-settings.service';
import { UserAuthModule } from '@/user-auth/user-auth.module';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [UserAuthModule, PrismaModule],
  controllers: [UserSettingsController],
  providers: [UserSettingsService],
  exports: [UserSettingsService],
})
export class UserSettingsModule {}
