import {
  BadRequestException,
  Body,
  Controller,
  Post,
  ServiceUnavailableException,
  GatewayTimeoutException,
  BadGatewayException,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { BcpAnalyzeService } from './services/bcp-analyze.service';
import { PdfExtractionService } from './services/pdf-extraction.service';
import {
  PdfExtractResponse,
  PdfPagesExtractResponse,
  SimpleAiCallResponse,
  UploadedPdfFile,
} from './types/ai-response.types';

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(
    private readonly bcpAnalyzeService: BcpAnalyzeService,
    private readonly pdfExtractionService: PdfExtractionService,
  ) {}

  @Post('bcpanalyze')
  @ApiOperation({
    summary: 'Analyze document with AI (Gemini PDF + prompt, or Azure text-only)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Single PDF' },
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Multiple PDFs (Gemini only)',
        },
        prompt: {
          type: 'string',
          description:
            'Full instruction prompt (multiline). Large text area in Swagger UI.',
          example:
            'Extract each regulatory article as JSON: [{ "number": "Article 1", "title": "...", "content": "..." }]',
        },
        aiModel: {
          type: 'string',
          example: 'gemini-3.5-flash',
          description:
            'gemini-* | gpt-4o | gpt-4o-mini | gpt-3.5-turbo | gpt-5',
        },
      },
      required: ['prompt'],
    },
  })
  @UseInterceptors(AnyFilesInterceptor())
  async bcpAnalyze(
    @UploadedFiles() uploads: Express.Multer.File[],
    @Body('prompt') prompt: string,
    @Body('aiModel') aiModel?: string,
  ): Promise<SimpleAiCallResponse> {
    if (!prompt?.trim()) {
      throw new BadRequestException({ error: 'prompt is required' });
    }

    const files = this.toPdfFiles(uploads);
    const result = await this.bcpAnalyzeService.analyze(files, prompt, aiModel);

    if (!result.success) {
      if (result.error === 'Missing GEMINI_API_KEY') {
        throw new ServiceUnavailableException(result);
      }
      if (
        typeof result.message === 'string' &&
        result.message.toLowerCase().includes('timed out')
      ) {
        throw new GatewayTimeoutException(result);
      }
      throw new BadGatewayException(result);
    }

    return result;
  }

  /** Alias matching Jumppl analyze-document naming */
  @Post('analyze-document')
  @ApiOperation({ summary: 'Alias for POST /ai/bcpanalyze' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(AnyFilesInterceptor())
  async analyzeDocument(
    @UploadedFiles() uploads: Express.Multer.File[],
    @Body('prompt') prompt: string,
    @Body('aiModel') aiModel?: string,
  ): Promise<SimpleAiCallResponse> {
    return this.bcpAnalyze(uploads, prompt, aiModel);
  }

  @Post('extractpdf-pages')
  @ApiOperation({
    summary: 'Extract per-page text and positions from a PDF (for mapper export)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(AnyFilesInterceptor())
  async extractPdfPages(
    @UploadedFiles() uploads: Express.Multer.File[],
  ): Promise<PdfPagesExtractResponse> {
    const files = this.toPdfFiles(uploads);
    if (!files.length) {
      throw new BadRequestException({
        success: false,
        error: 'PDF file is required',
      });
    }
    const result = await this.pdfExtractionService.extractPagesLayout(
      files[0],
    );
    if (!result.success) {
      throw new BadRequestException(result);
    }
    return result;
  }

  @Post('extractpdf')
  @ApiOperation({ summary: 'Extract text from PDF(s) without AI' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @UseInterceptors(AnyFilesInterceptor())
  async extractPdf(
    @UploadedFiles() uploads: Express.Multer.File[],
  ): Promise<PdfExtractResponse> {
    const files = this.toPdfFiles(uploads);
    const result = await this.pdfExtractionService.extract(files);
    if (!result.success) {
      throw new BadRequestException(result);
    }
    return result;
  }

  /** Alias matching extractDoc naming */
  @Post('extract-doc')
  @ApiOperation({ summary: 'Alias for POST /ai/extractpdf' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(AnyFilesInterceptor())
  async extractDoc(
    @UploadedFiles() uploads: Express.Multer.File[],
  ): Promise<PdfExtractResponse> {
    return this.extractPdf(uploads);
  }

  private toPdfFiles(uploads: Express.Multer.File[]): UploadedPdfFile[] {
    if (!uploads?.length) {
      return [];
    }
    return uploads
      .filter((f) => f?.size > 0)
      .map((f) => ({
        originalname: f.originalname,
        buffer: f.buffer,
        size: f.size,
        mimetype: f.mimetype,
      }));
  }
}
