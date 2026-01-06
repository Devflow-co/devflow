import { Module, forwardRef } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from '@/auth/auth.controller';
import { GitHubAppController } from '@/auth/github-app.controller';
import { OAuthService } from '@/auth/services/oauth.service';
import { TokenEncryptionService as ApiTokenEncryptionService } from '@/auth/services/token-encryption.service';
import { TokenStorageService as ApiTokenStorageService } from '@/auth/services/token-storage.service';
import { TokenRefreshService } from '@/auth/services/token-refresh.service';
import { SystemOAuthInitService } from '@/auth/services/system-oauth-init.service';
import { GitHubAppAuthService } from '@devflow/sdk/dist/auth/github-app-auth.service';
import { GitHubAppInstallationService } from '@devflow/sdk/dist/auth/github-app-installation.service';
import { TokenEncryptionService as SdkTokenEncryptionService } from '@devflow/sdk/dist/auth/token-encryption.service';
import { TokenStorageService as SdkTokenStorageService } from '@devflow/sdk/dist/auth/token-storage.service';
import { UserAuthModule } from '@/user-auth/user-auth.module';
import { ProjectsModule } from '@/projects/projects.module';

/**
 * Auth Module
 * Provides OAuth Device Flow authentication for GitHub and Linear
 */
@Module({
  imports: [
    ConfigModule, // For environment variables
    forwardRef(() => UserAuthModule), // For AuthGuard and SessionService
    forwardRef(() => ProjectsModule), // For ProjectsService
  ],
  controllers: [AuthController, GitHubAppController],
  providers: [
    // Core services (API versions for OAuth)
    OAuthService,
    ApiTokenEncryptionService,
    ApiTokenStorageService,
    {
      provide: 'TokenEncryptionService', // Alias for compatibility
      useExisting: ApiTokenEncryptionService,
    },
    {
      provide: 'TokenStorageService', // Alias for compatibility
      useExisting: ApiTokenStorageService,
    },
    TokenRefreshService,
    SystemOAuthInitService, // System OAuth initialization
    // Database
    {
      provide: PrismaClient,
      useFactory: () => {
        const prisma = new PrismaClient();
        return prisma;
      },
    },
    // GitHub App services with SDK versions of dependencies
    {
      provide: 'SdkTokenEncryptionService',
      useFactory: () => {
        return new SdkTokenEncryptionService();
      },
    },
    {
      provide: 'SdkTokenStorageService',
      useFactory: (redis: RedisClientType) => {
        return new SdkTokenStorageService(redis);
      },
      inject: ['REDIS_CLIENT'],
    },
    {
      provide: GitHubAppAuthService,
      useFactory: (
        tokenEncryption: SdkTokenEncryptionService,
        tokenStorage: SdkTokenStorageService,
        db: PrismaClient,
      ) => {
        return new GitHubAppAuthService(tokenEncryption, tokenStorage, db);
      },
      inject: ['SdkTokenEncryptionService', 'SdkTokenStorageService', PrismaClient],
    },
    {
      provide: GitHubAppInstallationService,
      useFactory: (db: PrismaClient, authService: GitHubAppAuthService) => {
        return new GitHubAppInstallationService(db, authService);
      },
      inject: [PrismaClient, GitHubAppAuthService],
    },
    // Redis
    {
      provide: 'REDIS_CLIENT',
      useFactory: async (): Promise<RedisClientType> => {
        const redisHost = process.env.REDIS_HOST || 'localhost';
        const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

        const redis = createClient({
          socket: {
            host: redisHost,
            port: redisPort,
            reconnectStrategy: (retries) => {
              const delay = Math.min(retries * 50, 2000);
              return delay;
            },
          },
        });

        redis.on('error', (err) => {
          console.error('Redis connection error:', err);
        });

        redis.on('connect', () => {
          console.log('Redis connected successfully');
        });

        await redis.connect();

        return redis as RedisClientType;
      },
    },
  ],
  exports: [
    OAuthService,
    ApiTokenEncryptionService,
    ApiTokenStorageService,
    'TokenEncryptionService', // Alias
    'TokenStorageService', // Alias
    TokenRefreshService,
    GitHubAppAuthService,
    GitHubAppInstallationService,
    PrismaClient,
    'REDIS_CLIENT',
  ],
})
export class AuthModule {}
