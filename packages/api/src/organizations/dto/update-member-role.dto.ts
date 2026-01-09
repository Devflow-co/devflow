import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ['ADMIN', 'MAINTAINER', 'VIEWER'] })
  @IsEnum(Role)
  role: Role;
}
