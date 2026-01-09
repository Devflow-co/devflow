import { IsString, IsOptional, MaxLength, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateOrganizationDto {
  @ApiProperty({ example: 'Acme Corp', required: false, maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ example: 'billing@acme.com', required: false })
  @IsEmail()
  @IsOptional()
  billingEmail?: string;
}
