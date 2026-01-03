import { Module, forwardRef } from '@nestjs/common';
import { ProjectsController } from '@/projects/projects.controller';
import { ProjectsService } from '@/projects/projects.service';
import { AuthModule } from '@/auth/auth.module';
import { UserAuthModule } from '@/user-auth/user-auth.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => UserAuthModule), // For AuthGuard
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
