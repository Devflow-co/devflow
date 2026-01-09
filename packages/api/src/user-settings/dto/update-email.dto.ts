import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateEmailDto {
  @ApiProperty({ example: 'new@example.com', description: 'New email address' })
  @IsEmail()
  newEmail: string;

  @ApiProperty({
    example: 'currentPassword123',
    description: 'Current password for verification',
  })
  @IsString()
  @MinLength(1)
  currentPassword: string;
}
