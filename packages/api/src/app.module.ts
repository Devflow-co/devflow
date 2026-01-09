/**
 * Root Application Module
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '@/prisma/prisma.module';
import { ProjectsModule } from '@/projects/projects.module';
import { TasksModule } from '@/tasks/tasks.module';
import { WorkflowsModule } from '@/workflows/workflows.module';
import { WebhooksModule } from '@/webhooks/webhooks.module';
import { HealthModule } from '@/health/health.module';
import { AuthModule } from '@/auth/auth.module';
import { IntegrationsModule } from '@/integrations/integrations.module';
import { UserAuthModule } from '@/user-auth/user-auth.module';
import { UserSettingsModule } from '@/user-settings/user-settings.module';
import { OrganizationsModule } from '@/organizations/organizations.module';
import { ConfigAppModule } from '@/config/config.module';
import { RagModule } from '@/rag/rag.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        '.env.local',
        '.env',
        '../../.env.local', // Root monorepo .env.local
        '../../.env',        // Root monorepo .env
      ],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
        limit: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
      },
    ]),

    // Database
    PrismaModule,

    // Feature modules
    HealthModule,
    AuthModule,
    UserAuthModule,
    UserSettingsModule,
    OrganizationsModule,
    IntegrationsModule,
    ConfigAppModule,
    ProjectsModule,
    TasksModule,
    WorkflowsModule,
    WebhooksModule,
    RagModule,
  ],
})
export class AppModule {}
