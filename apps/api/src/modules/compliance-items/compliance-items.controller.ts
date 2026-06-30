import { Controller } from '@nestjs/common';
import { ComplianceItemsService } from './compliance-items.service';

@Controller('compliance-items')
export class ComplianceItemsController {
  constructor(private readonly complianceItemsService: ComplianceItemsService) {}

  // TODO: PATCH /compliance-items/:id — Stage 7 CAP tracking
}
