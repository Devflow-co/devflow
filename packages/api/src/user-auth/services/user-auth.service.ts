import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { User } from '@prisma/client';
import * as crypto from 'crypto';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { EmailService } from './email.service';
import { SignupDto, LoginDto } from '../dto';

interface AuthResult {
  user: User;
  sessionToken: string;
  expiresAt: Date;
}

@Injectable()
export class UserAuthService {
  private readonly logger = new Logger(UserAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
    private readonly emailService: EmailService,
  ) {}

  // ============ Email/Password Authentication ============

  async signup(
    dto: SignupDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<AuthResult> {
    // Check password strength
    const { valid, errors } = this.passwordService.validateStrength(dto.password);
    if (!valid) {
      throw new BadRequestException(errors.join(', '));
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await this.passwordService.hash(dto.password);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        name: dto.name,
        passwordHash,
        emailVerified: false,
      },
    });

    // Create personal organization for the user
    await this.createPersonalOrganization(user);

    // Create session
    const { sessionToken, expiresAt } = await this.sessionService.createSession(
      user.id,
      userAgent,
      ipAddress,
    );

    // Create verification token and send email
    const token = await this.createEmailVerificationToken(user.id);
    try {
      await this.emailService.sendVerificationEmail(user.email, token, user.name || undefined);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${user.email}:`, error);
      // Don't fail signup if email fails - user can resend later
    }

    return { user, sessionToken, expiresAt };
  }

  async login(
    dto: LoginDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValid = await this.passwordService.verify(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Create session
    const { sessionToken, expiresAt } = await this.sessionService.createSession(
      user.id,
      userAgent,
      ipAddress,
    );

    return { user, sessionToken, expiresAt };
  }

  // ============ Email Verification ============

  async createEmailVerificationToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });

    return token;
  }

  async verifyEmail(token: string): Promise<void> {
    const verificationToken = await this.prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!verificationToken) {
      throw new BadRequestException('Invalid verification token');
    }

    if (verificationToken.usedAt) {
      throw new BadRequestException('Token already used');
    }

    if (verificationToken.expiresAt < new Date()) {
      throw new BadRequestException('Token expired');
    }

    // Mark token as used and verify email
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: verificationToken.userId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      }),
    ]);
  }

  async resendVerificationEmail(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Invalidate existing tokens
    await this.prisma.emailVerificationToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Create new token and send email
    const token = await this.createEmailVerificationToken(userId);
    await this.emailService.sendVerificationEmail(user.email, token, user.name || undefined);
    this.logger.log(`Verification email resent to ${user.email}`);
  }

  // ============ Password Reset ============

  async sendPasswordResetEmail(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return;
    }

    // Invalidate existing tokens
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Create new token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Send password reset email
    try {
      await this.emailService.sendPasswordResetEmail(user.email, token, user.name || undefined);
      this.logger.log(`Password reset email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${user.email}:`, error);
      // Don't expose email sending failures to prevent enumeration
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Validate password strength
    const { valid, errors } = this.passwordService.validateStrength(newPassword);
    if (!valid) {
      throw new BadRequestException(errors.join(', '));
    }

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid reset token');
    }

    if (resetToken.usedAt) {
      throw new BadRequestException('Token already used');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Token expired');
    }

    // Hash new password
    const passwordHash = await this.passwordService.hash(newPassword);

    // Update password and mark token as used
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
    ]);

    // Invalidate all sessions for security
    await this.sessionService.destroyAllUserSessions(resetToken.userId);
  }

  // ============ SSO/OAuth Helpers ============

  async findOrCreateSSOUser(
    provider: string,
    ssoId: string,
    email: string,
    name?: string,
    avatar?: string,
  ): Promise<User> {
    // First try to find by SSO ID
    let user = await this.prisma.user.findFirst({
      where: { ssoProvider: provider, ssoId },
    });

    if (user) {
      // Update last login
      return this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), name: name || user.name, avatar: avatar || user.avatar },
      });
    }

    // Try to find by email
    user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (user) {
      // Link SSO to existing account
      return this.prisma.user.update({
        where: { id: user.id },
        data: {
          ssoProvider: provider,
          ssoId,
          emailVerified: true,
          emailVerifiedAt: user.emailVerifiedAt || new Date(),
          lastLoginAt: new Date(),
        },
      });
    }

    // Create new user
    const newUser = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        avatar,
        ssoProvider: provider,
        ssoId,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        lastLoginAt: new Date(),
      },
    });

    // Create personal organization for new SSO user
    await this.createPersonalOrganization(newUser);

    return newUser;
  }

  async createSSOSession(
    user: User,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<AuthResult> {
    const { sessionToken, expiresAt } = await this.sessionService.createSession(
      user.id,
      userAgent,
      ipAddress,
    );

    return { user, sessionToken, expiresAt };
  }

  // ============ Organization Management ============

  /**
   * Creates a personal organization for a user
   * Called automatically during signup/SSO user creation
   */
  private async createPersonalOrganization(user: User): Promise<void> {
    const orgName = user.name ? `${user.name}'s Organization` : `${user.email}'s Organization`;
    const orgSlug = `${user.id}-personal`;

    try {
      await this.prisma.organization.create({
        data: {
          name: orgName,
          slug: orgSlug,
          members: {
            create: {
              userId: user.id,
              role: 'OWNER',
            },
          },
        },
      });

      this.logger.log(`Created personal organization for user ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to create personal organization for user ${user.email}:`, error);
      // Don't fail user creation if organization creation fails
      // Organization can be created later if needed
    }
  }
}
