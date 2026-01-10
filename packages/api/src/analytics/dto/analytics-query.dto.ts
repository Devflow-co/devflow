import { IsOptional, IsDateString, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

export class AnalyticsQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number;
}

export class ProjectAnalyticsQueryDto extends AnalyticsQueryDto {}
