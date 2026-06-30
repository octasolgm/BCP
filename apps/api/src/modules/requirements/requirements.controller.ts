import { Controller } from '@nestjs/common';
import { RequirementsService } from './requirements.service';

@Controller('requirements')
export class RequirementsController {
  constructor(private readonly requirementsService: RequirementsService) {}

  // TODO: list/split requirement points — Stage 4A
}
