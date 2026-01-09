import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'currentPassword123',
    description: 'Current password for verification',
  })
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @ApiProperty({
    example: 'newSecurePassword456',
    description: 'New password (min 8 characters)',
  })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
