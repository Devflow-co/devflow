/**
 * Config Controller - Workflow automation configuration endpoints
 *
 * Provides read-only endpoints for AI models.
 */

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AVAILABLE_AI_MODELS } from '@devflow/common';

@ApiTags('Config')
@Controller('config')
export class ConfigController {
  /**
   * Get available AI models for workflow automation
   */
  @Get('ai-models')
  @ApiOperation({ summary: 'Get available AI models' })
  @ApiResponse({
    status: 200,
    description: 'List of available AI models',
  })
  getAIModels() {
    return {
      models: AVAILABLE_AI_MODELS,
    };
  }
}
