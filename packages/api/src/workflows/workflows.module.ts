import { Module } from '@nestjs/common';
import { WorkflowsController } from '@/workflows/workflows.controller';
import { WorkflowsService } from '@/workflows/workflows.service';

@Module({
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}

