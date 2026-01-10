import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { UserAuthModule } from '@/user-auth/user-auth.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [PrismaModule, UserAuthModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
