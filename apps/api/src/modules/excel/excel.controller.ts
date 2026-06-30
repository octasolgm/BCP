import { Controller } from '@nestjs/common';
import { ExcelService } from './excel.service';

@Controller('excel')
export class ExcelController {
  constructor(private readonly excelService: ExcelService) {}

  // TODO: GET /excel/download/:sessionId — Stage 6
}
