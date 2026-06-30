import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { BcpAnalyzeService } from './services/bcp-analyze.service';
import { PdfExtractionService } from './services/pdf-extraction.service';
import { AzureOpenAiService } from './services/azure-openai.service';

@Module({
  controllers: [AiController],
  providers: [BcpAnalyzeService, PdfExtractionService, AzureOpenAiService],
  exports: [BcpAnalyzeService, PdfExtractionService],
})
export class AiModule {}
