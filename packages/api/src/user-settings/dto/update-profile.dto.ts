import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({ example: 'John Doe', required: false, maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;
}
