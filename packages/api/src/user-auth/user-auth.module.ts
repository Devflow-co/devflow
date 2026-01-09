import { Module, forwardRef } from '@nestjs/common';
import { UserAuthController } from './user-auth.controller';
import { UserAuthService } from './services/user-auth.service';
import { SessionService } from './services/session.service';
import { PasswordService } from './services/password.service';
import { EmailService } from './services/email.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { GitHubUserOAuthService } from './services/github-user-oauth.service';
import { AuthGuard } from './guards/auth.guard';
import { AuthModule } from '@/auth/auth.module';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [
    forwardRef(() => AuthModule), // For REDIS_CLIENT
    PrismaModule,
  ],
  controllers: [UserAuthController],
  providers: [
    UserAuthService,
    SessionService,
    PasswordService,
    EmailService,
    GoogleOAuthService,
    GitHubUserOAuthService,
    AuthGuard,
  ],
  exports: [
    UserAuthService,
    SessionService,
    PasswordService,
    EmailService,
    AuthGuard,
  ],
})
export class UserAuthModule {}
