/**
 * Config Controller - Workflow automation configuration endpoints
 *
 * Provides read-only endpoints for AI models and automation templates.
 */

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  AVAILABLE_AI_MODELS,
  getTemplateMetadata,
} from '@devflow/common';

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

  /**
   * Get automation templates metadata
   */
  @Get('automation-templates')
  @ApiOperation({ summary: 'Get automation templates' })
  @ApiResponse({
    status: 200,
    description: 'List of automation templates with metadata',
  })
  getAutomationTemplates() {
    return {
      templates: getTemplateMetadata(),
    };
  }
}
