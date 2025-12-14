import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { FigmaApiService } from './figma/figma-api.service';

/**
 * Integrations Module
 *
 * Provides services for external API integrations (Figma, Sentry, GitHub, Linear).
 * These services are thin NestJS wrappers around SDK integration services.
 *
 * Each service depends on TokenRefreshService for OAuth token resolution.
 */
@Module({
  imports: [AuthModule], // Provides TokenRefreshService
  providers: [FigmaApiService],
  exports: [FigmaApiService],
})
export class IntegrationsModule {}
