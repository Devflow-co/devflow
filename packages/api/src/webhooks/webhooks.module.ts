import { Module } from '@nestjs/common';
import { WebhooksController } from '@/webhooks/webhooks.controller';
import { GitHubAppWebhooksController } from '@/webhooks/github-app-webhooks.controller';
import { WebhooksService } from '@/webhooks/webhooks.service';
import { WorkflowsModule } from '@/workflows/workflows.module';
import { LinearModule } from '@/linear/linear.module';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [WorkflowsModule, LinearModule, AuthModule],
  controllers: [WebhooksController, GitHubAppWebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}

