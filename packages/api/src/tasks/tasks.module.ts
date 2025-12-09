import { Module, forwardRef } from '@nestjs/common';
import { TasksController } from '@/tasks/tasks.controller';
import { TasksService } from '@/tasks/tasks.service';
import { WorkflowsModule } from '@/workflows/workflows.module';

@Module({
  imports: [forwardRef(() => WorkflowsModule)],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}

