import { PartialType } from '@nestjs/swagger';
import { CreateProjectDto } from '@/projects/dto/create-project.dto';

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

