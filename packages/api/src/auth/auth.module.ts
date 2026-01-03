import { Module, forwardRef } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from '@/auth/auth.controller';
import { OAuthService } from '@/auth/services/oauth.service';
import { TokenEncryptionService } from '@/auth/services/token-encryption.service';
import { TokenStorageService } from '@/auth/services/token-storage.service';
import { TokenRefreshService } from '@/auth/services/token-refresh.service';
import { SystemOAuthInitService } from '@/auth/services/system-oauth-init.service';
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
  controllers: [AuthController],
  providers: [
    // Core services
    OAuthService,
    TokenEncryptionService,
    TokenStorageService,
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
    TokenEncryptionService,
    TokenStorageService,
    TokenRefreshService,
    PrismaClient,
    'REDIS_CLIENT',
  ],
})
export class AuthModule {}
