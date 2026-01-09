import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { PasswordService } from '@/user-auth/services/password.service';
import { UserAuthService } from '@/user-auth/services/user-auth.service';
import { SessionService } from '@/user-auth/services/session.service';
import {
  SupabaseStorageService,
  createSupabaseStorageService,
  MAX_AVATAR_SIZE,
  StorageError,
} from '@devflow/sdk';
import { UpdateProfileDto, UpdateEmailDto, ChangePasswordDto } from './dto';

@Injectable()
export class UserSettingsService {
  private readonly logger = new Logger(UserSettingsService.name);
  private storageService: SupabaseStorageService | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly userAuthService: UserAuthService,
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService,
  ) {
    this.initStorageService();
  }

  private initStorageService(): void {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_KEY');
    const bucket = this.configService.get<string>('SUPABASE_BUCKET');

    if (supabaseUrl && supabaseServiceKey && bucket) {
      this.storageService = createSupabaseStorageService({
        supabaseUrl,
        supabaseServiceKey,
        bucket,
      });
      this.logger.log('Supabase Storage initialized');
    } else {
      this.logger.warn('Supabase Storage not configured - avatar uploads disabled');
    }
  }

  /**
   * Update user profile (name)
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
      },
    });

    return this.sanitizeUser(user);
  }

  /**
   * Upload user avatar
   */
  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ avatar: string }> {
    if (!this.storageService) {
      throw new BadRequestException('Avatar uploads not configured');
    }

    // Get current user to check for existing avatar
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    try {
      // Upload new avatar
      const result = await this.storageService.upload(file.buffer, {
        folder: 'avatars',
        fileName: userId,
        contentType: file.mimetype,
        maxSizeBytes: MAX_AVATAR_SIZE,
      });

      // Delete old avatar if exists and is a Supabase URL
      if (user?.avatar && this.storageService.extractPathFromUrl(user.avatar)) {
        try {
          await this.storageService.deleteByUrl(user.avatar);
        } catch (deleteError) {
          this.logger.warn(`Failed to delete old avatar: ${deleteError}`);
        }
      }

      // Update user with new avatar URL
      await this.prisma.user.update({
        where: { id: userId },
        data: { avatar: result.publicUrl },
      });

      return { avatar: result.publicUrl };
    } catch (error) {
      if (error instanceof StorageError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * Remove user avatar
   */
  async removeAvatar(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    if (user?.avatar && this.storageService) {
      const path = this.storageService.extractPathFromUrl(user.avatar);
      if (path) {
        try {
          await this.storageService.delete(path);
        } catch (error) {
          this.logger.warn(`Failed to delete avatar from storage: ${error}`);
        }
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: null },
    });
  }

  /**
   * Update user email (requires re-verification)
   */
  async updateEmail(userId: string, dto: UpdateEmailDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // SSO users cannot change email
    if (user.ssoProvider) {
      throw new ForbiddenException(
        `Email is managed by ${user.ssoProvider}. Please update it there.`,
      );
    }

    // Verify current password
    if (!user.passwordHash) {
      throw new BadRequestException('No password set for this account');
    }

    const isValid = await this.passwordService.verify(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!isValid) {
      throw new BadRequestException('Invalid current password');
    }

    // Check if new email is already taken
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.newEmail.toLowerCase() },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException('Email already in use');
    }

    // Update email and reset verification
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: dto.newEmail.toLowerCase(),
        emailVerified: false,
        emailVerifiedAt: null,
      },
    });

    // Send new verification email
    try {
      await this.userAuthService.resendVerificationEmail(userId);
    } catch (error) {
      this.logger.error(`Failed to send verification email: ${error}`);
    }

    return this.sanitizeUser(updatedUser);
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // SSO users cannot change password
    if (user.ssoProvider) {
      throw new ForbiddenException(
        `Password is managed by ${user.ssoProvider}. Please update it there.`,
      );
    }

    // Verify current password
    if (!user.passwordHash) {
      throw new BadRequestException('No password set for this account');
    }

    const isValid = await this.passwordService.verify(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!isValid) {
      throw new BadRequestException('Invalid current password');
    }

    // Validate new password strength
    const strength = this.passwordService.validateStrength(dto.newPassword);
    if (!strength.valid) {
      throw new BadRequestException(strength.errors.join('. '));
    }

    // Hash and update password
    const newHash = await this.passwordService.hash(dto.newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Invalidate all other sessions for security
    await this.sessionService.destroyAllUserSessions(userId);

    return { message: 'Password updated successfully. Please log in again.' };
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return this.sanitizeUser(user);
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
