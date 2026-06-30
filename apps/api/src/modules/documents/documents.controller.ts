import { Controller } from '@nestjs/common';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // TODO: POST /documents/upload — Stage 1 upload flow
}
