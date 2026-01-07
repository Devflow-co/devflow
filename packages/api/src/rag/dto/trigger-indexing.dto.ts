import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TriggerIndexingDto {
  @ApiPropertyOptional({
    example: 'main',
    description: 'Branch to index',
    default: 'main',
  })
  @IsString()
  @IsOptional()
  branch?: string = 'main';

  @ApiPropertyOptional({
    example: false,
    description: 'Force re-indexing even if the index is up to date',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  force?: boolean = false;
}
