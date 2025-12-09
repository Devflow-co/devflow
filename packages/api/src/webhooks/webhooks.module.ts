import { Module } from '@nestjs/common';
import { WebhooksController } from '@/webhooks/webhooks.controller';
import { WebhooksService } from '@/webhooks/webhooks.service';
import { WorkflowsModule } from '@/workflows/workflows.module';

@Module({
  imports: [WorkflowsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}

