import { Module, forwardRef } from '@nestjs/common';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';
import { AuthModule } from '@/auth/auth.module';
import { UserAuthModule } from '@/user-auth/user-auth.module';
import { ProjectsModule } from '@/projects/projects.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => UserAuthModule), // For AuthGuard
    forwardRef(() => ProjectsModule), // For ProjectsService.userHasAccess
  ],
  controllers: [RagController],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
