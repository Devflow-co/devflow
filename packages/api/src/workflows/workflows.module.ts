import { Module } from '@nestjs/common';
import { WorkflowsController } from '@/workflows/workflows.controller';
import { WorkflowsService } from '@/workflows/workflows.service';
import { UserAuthModule } from '@/user-auth/user-auth.module';

@Module({
  imports: [UserAuthModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}

