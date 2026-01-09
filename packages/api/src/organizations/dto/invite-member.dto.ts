import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class InviteMemberDto {
  @ApiProperty({ example: 'newuser@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    enum: ['ADMIN', 'MAINTAINER', 'VIEWER'],
    default: 'VIEWER',
    required: false,
  })
  @IsEnum(Role)
  @IsOptional()
  role?: Role = Role.VIEWER;
}
