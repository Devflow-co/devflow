import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class BrowseChunksDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number (1-indexed)',
    default: 1,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    description: 'Number of items per page (1-100)',
    default: 20,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({
    example: 'typescript',
    description: 'Filter by programming language',
  })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({
    example: 'function',
    description: 'Filter by chunk type (function, class, module, comment, import)',
  })
  @IsString()
  @IsOptional()
  chunkType?: string;

  @ApiPropertyOptional({
    example: 'src/auth/',
    description: 'Filter by file path (prefix match)',
  })
  @IsString()
  @IsOptional()
  filePath?: string;

  @ApiPropertyOptional({
    example: 'authentication',
    description: 'Search text in chunk content',
  })
  @IsString()
  @IsOptional()
  search?: string;
}
