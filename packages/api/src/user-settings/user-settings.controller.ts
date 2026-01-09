import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { AuthGuard } from '@/user-auth/guards/auth.guard';
import { CurrentUser } from '@/user-auth/decorators/current-user.decorator';
import { UserSettingsService } from './user-settings.service';
import { UpdateProfileDto, UpdateEmailDto, ChangePasswordDto } from './dto';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

@ApiTags('User Settings')
@Controller('user/settings')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class UserSettingsController {
  constructor(private readonly userSettingsService: UserSettingsService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  async getProfile(@CurrentUser() user: User) {
    return this.userSettingsService.getProfile(user.id);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update user profile (name)' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userSettingsService.updateProfile(user.id, dto);
  }

  @Post('avatar')
  @ApiOperation({ summary: 'Upload user avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Avatar image (PNG, JPG, WebP, GIF - max 5MB)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Avatar uploaded' })
  @ApiResponse({ status: 400, description: 'Invalid file or upload failed' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @CurrentUser() user: User,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_AVATAR_SIZE }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp|gif)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.userSettingsService.uploadAvatar(user.id, file);
  }

  @Delete('avatar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove user avatar' })
  @ApiResponse({ status: 204, description: 'Avatar removed' })
  async removeAvatar(@CurrentUser() user: User) {
    await this.userSettingsService.removeAvatar(user.id);
  }

  @Put('email')
  @ApiOperation({ summary: 'Update email address (requires re-verification)' })
  @ApiResponse({ status: 200, description: 'Email updated, verification sent' })
  @ApiResponse({ status: 400, description: 'Invalid password or validation error' })
  @ApiResponse({ status: 403, description: 'SSO user cannot change email' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async updateEmail(
    @CurrentUser() user: User,
    @Body() dto: UpdateEmailDto,
  ) {
    return this.userSettingsService.updateEmail(user.id, dto);
  }

  @Put('password')
  @ApiOperation({ summary: 'Change password' })
  @ApiResponse({ status: 200, description: 'Password updated' })
  @ApiResponse({ status: 400, description: 'Invalid password or weak new password' })
  @ApiResponse({ status: 403, description: 'SSO user cannot change password' })
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.userSettingsService.changePassword(user.id, dto);
  }
}
