import { Module } from '@nestjs/common';
import { ProjectsController } from '@/projects/projects.controller';
import { ProjectsService } from '@/projects/projects.service';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
