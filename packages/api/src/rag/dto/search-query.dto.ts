import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
  MinLength,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class RetrievalFilterDto {
  @ApiPropertyOptional({ example: 'typescript', description: 'Filter by programming language' })
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
    example: ['src/auth/', 'src/utils/'],
    description: 'Filter by file paths (prefix match)',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  filePaths?: string[];
}

export class SearchQueryDto {
  @ApiProperty({
    example: 'How does the authentication system work?',
    description: 'The search query (minimum 3 characters)',
  })
  @IsString()
  @MinLength(3)
  query: string;

  @ApiPropertyOptional({
    example: 'semantic',
    enum: ['semantic', 'hybrid'],
    description: 'Type of retriever to use',
    default: 'semantic',
  })
  @IsEnum(['semantic', 'hybrid'])
  @IsOptional()
  retrieverType?: 'semantic' | 'hybrid' = 'semantic';

  @ApiPropertyOptional({
    example: 10,
    description: 'Number of results to return (1-50)',
    default: 10,
  })
  @IsNumber()
  @Min(1)
  @Max(50)
  @IsOptional()
  topK?: number = 10;

  @ApiPropertyOptional({
    example: 0.3,
    description: 'Minimum similarity score threshold (0-1)',
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  scoreThreshold?: number;

  @ApiPropertyOptional({
    description: 'Optional filters for the search',
    type: RetrievalFilterDto,
  })
  @ValidateNested()
  @Type(() => RetrievalFilterDto)
  @IsOptional()
  filter?: RetrievalFilterDto;
}
