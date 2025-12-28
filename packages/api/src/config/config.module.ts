/**
 * Config Module - Workflow automation configuration
 */

import { Module } from '@nestjs/common';
import { ConfigController } from '@/config/config.controller';

@Module({
  controllers: [ConfigController],
})
export class ConfigAppModule {}
