import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import type { UploadedPdfFile } from '../ai/types/ai-response.types';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { LandingAiService } from './services/landing-ai.service';
import { LandingAiSeedService } from './services/landing-ai-seed.service';
import type { ExtractSchemaKey, GovRequirementPoint } from './types/landing-ai.types';
import { BUILTIN_EXTRACT_DOCS, findBuiltinDoc } from './builtin-docs';

@ApiTags('Landing AI')
@Controller('landing-ai')
export class LandingAiController {
  constructor(
    private readonly landingAiService: LandingAiService,
    private readonly landingAiSeedService: LandingAiSeedService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Landing AI ADE configuration status' })
  getStatus() {
    return this.landingAiService.getStatus();
  }

  @Post('parse')
  @ApiOperation({
    summary: 'Parse document to markdown (Landing AI ADE, with Supabase cache)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async parse(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('PDF or document file is required');
    }
    return this.landingAiService.parseFile(file.buffer, file.originalname);
  }

  @Post('extract-gov-points')
  @ApiOperation({
    summary: 'Extract numbered government requirement points from document',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        markdown: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async extractGov(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('markdown') markdownQuery?: string,
  ) {
    const markdown = markdownQuery?.trim();
    if (!file?.buffer?.length && !markdown) {
      throw new BadRequestException('Upload a file or pass markdown query');
    }
    return this.landingAiService.extractPoints(
      file?.buffer ?? null,
      file?.originalname ?? 'document.pdf',
      'gov_requirement_points',
      markdown,
    );
  }

  @Post('extract-internal-points')
  @ApiOperation({
    summary: 'Extract numbered internal policy points from document',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        markdown: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async extractInternal(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('markdown') markdownQuery?: string,
  ) {
    const markdown = markdownQuery?.trim();
    if (!file?.buffer?.length && !markdown) {
      throw new BadRequestException('Upload a file or pass markdown query');
    }
    return this.landingAiService.extractPoints(
      file?.buffer ?? null,
      file?.originalname ?? 'document.pdf',
      'internal_policy_points',
      markdown,
    );
  }

  @Get('builtin-docs')
  @ApiOperation({ summary: 'Built-in seeded document profiles (gov + internal)' })
  listBuiltinDocs() {
    return this.landingAiSeedService.listBuiltinDocs();
  }

  @Get('stored-points')
  @ApiOperation({ summary: 'Load cached extract points from Supabase (no Landing AI credits)' })
  @ApiQuery({ name: 'fileHash', required: false })
  @ApiQuery({ name: 'schemaKey', required: false })
  @ApiQuery({ name: 'docId', required: false, description: 'gov-tfs-guidelines | internal-imptfs' })
  async getStoredPoints(
    @Query('fileHash') fileHash?: string,
    @Query('schemaKey') schemaKey?: ExtractSchemaKey,
    @Query('docId') docId?: string,
  ) {
    let hash = fileHash?.trim();
    let key = schemaKey;

    if (docId?.trim()) {
      const doc = findBuiltinDoc(docId.trim());
      if (!doc) {
        throw new BadRequestException(`Unknown docId: ${docId}`);
      }
      hash = doc.fileHash;
      key = doc.schemaKey;
    }

    if (!hash || !key) {
      throw new BadRequestException('Provide docId or both fileHash and schemaKey');
    }

    const result = await this.landingAiSeedService.getStoredPoints(hash, key);
    if (!result) {
      throw new BadRequestException(
        'No cached points in DB for this document. Run POST /landing-ai/seed/builtin first.',
      );
    }
    return result;
  }

  @Get('stored-parse')
  @ApiOperation({
    summary: 'Load cached parse markdown from Supabase (no Landing AI credits)',
  })
  @ApiQuery({ name: 'fileHash', required: false })
  @ApiQuery({ name: 'docId', required: false })
  async getStoredParse(
    @Query('fileHash') fileHash?: string,
    @Query('docId') docId?: string,
  ) {
    let hash = fileHash?.trim();
    if (docId?.trim()) {
      const doc = findBuiltinDoc(docId.trim());
      if (!doc) {
        throw new BadRequestException(`Unknown docId: ${docId}`);
      }
      hash = doc.fileHash;
    }
    if (!hash) {
      throw new BadRequestException('Provide docId or fileHash');
    }
    const result = await this.landingAiService.getStoredParse(hash);
    if (!result) {
      throw new BadRequestException(
        'No cached parse markdown. Load internal points from DB and compare — parse is skipped automatically.',
      );
    }
    return result;
  }

  @Post('seed/builtin')
  @ApiOperation({
    summary: 'Seed Supabase with saved gov + internal Landing AI extract responses (dev)',
  })
  async seedBuiltin() {
    return this.landingAiSeedService.seedAllBuiltin();
  }

  @Post('seed/builtin/:docId')
  @ApiOperation({ summary: 'Seed one built-in document extract into Supabase' })
  async seedBuiltinDoc(@Param('docId') docId: string) {
    const doc = findBuiltinDoc(docId);
    if (!doc) {
      throw new BadRequestException(
        `Unknown docId. Use one of: ${BUILTIN_EXTRACT_DOCS.map((d) => d.id).join(', ')}`,
      );
    }
    return this.landingAiSeedService.seedBuiltinDoc(doc);
  }

  @Get('cache-status')
  @ApiOperation({ summary: 'Supabase cache status for parse / extract / sessions' })
  getCacheStatus() {
    return this.landingAiService.getCacheStatus();
  }

  @Get('compliance-sessions')
  @ApiOperation({ summary: 'List saved compliance analysis sessions from Supabase' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({
    name: 'granularity',
    required: false,
    description: 'Filter: section | leaf',
  })
  listComplianceSessions(
    @Query('limit') limit?: string,
    @Query('granularity') granularity?: string,
  ) {
    const n = limit ? Math.min(Number(limit) || 30, 100) : 30;
    const gran =
      granularity?.trim().toLowerCase() === 'leaf' ? 'leaf' : 'section';
    return this.landingAiService.listComplianceSessions(n, gran);
  }

  @Get('compliance-sessions/:id')
  @ApiOperation({ summary: 'Load one saved compliance analysis session (free)' })
  @ApiQuery({
    name: 'granularity',
    required: false,
    description: 'section | leaf — filters compare-cache reload',
  })
  getComplianceSession(
    @Param('id') id: string,
    @Query('granularity') granularity?: string,
  ) {
    const mode =
      granularity?.trim().toLowerCase() === 'leaf' ? 'leaf' : 'section';
    return this.landingAiService.getComplianceSession(id, mode);
  }

  @Post('compliance-sessions')
  @ApiOperation({ summary: 'Save full compare session to Supabase (free replay)' })
  async saveComplianceSession(
    @Body()
    body: {
      govFileHash: string;
      internalFileHash: string;
      govFileName: string;
      internalFileName: string;
      totalGovPoints: number;
      comparedPoints: number;
      skippedPoints: number;
      skippedJson?: unknown;
      resultsJson: unknown;
      summaryJson?: unknown;
      compareGranularity?: 'section' | 'leaf';
    },
  ) {
    if (!body?.resultsJson || !body.govFileHash || !body.internalFileHash) {
      throw new BadRequestException('govFileHash, internalFileHash, resultsJson required');
    }
    return this.landingAiService.saveComplianceSession({
      govFileHash: body.govFileHash,
      internalFileHash: body.internalFileHash,
      govFileName: body.govFileName ?? 'gov.pdf',
      internalFileName: body.internalFileName ?? 'internal.pdf',
      totalGovPoints: body.totalGovPoints ?? 0,
      comparedPoints: body.comparedPoints ?? 0,
      skippedPoints: body.skippedPoints ?? 0,
      skippedJson: body.skippedJson ?? [],
      resultsJson: body.resultsJson,
      summaryJson: body.summaryJson,
      compareGranularity: body.compareGranularity,
    });
  }

  @Post('compliance-sessions/sync-from-cache')
  @ApiOperation({
    summary:
      'Build a saved session from all per-point compare cache rows (free, no Landing AI credits)',
  })
  @ApiQuery({
    name: 'granularity',
    required: false,
    description: 'section | leaf (default section)',
  })
  syncSessionFromCompareCache(@Query('granularity') granularity?: string) {
    const gran =
      granularity?.trim().toLowerCase() === 'leaf' ? 'leaf' : 'section';
    return this.landingAiService.syncSessionFromCompareCache(gran);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'Recent Landing AI jobs (credit audit)' })
  @ApiQuery({ name: 'limit', required: false })
  listJobs(@Query('limit') limit?: string) {
    const n = limit ? Math.min(Number(limit) || 20, 100) : 20;
    return this.landingAiService.listJobs(n);
  }

  @Post('compare-point')
  @ApiOperation({
    summary:
      'Compare one gov point vs internal policy (Landing AI Parse + Extract)',
  })
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
        point: {
          type: 'string',
          description: 'JSON GovRequirementPoint { point_id, title?, text }',
        },
        internalMarkdown: {
          type: 'string',
          description:
            'Pre-parsed Landing AI markdown (from POST /landing-ai/parse). Do not pass synthesized point lists.',
        },
        internalFileName: { type: 'string' },
        internalFileHash: {
          type: 'string',
          description: 'SHA-256 of internal PDF for stable compare cache keys',
        },
        forceCompare: {
          type: 'string',
          description:
            'If "true", skip compare cache and call Landing AI (Compare all). Omit or false to return cached result when available.',
        },
      },
      required: ['point'],
    },
  })
  @UseInterceptors(AnyFilesInterceptor())
  async comparePoint(
    @UploadedFiles() uploads: Express.Multer.File[],
    @Body('point') pointJson?: string,
    @Body('internalMarkdown') internalMarkdown?: string,
    @Body('internalFileName') internalFileName?: string,
    @Body('internalFileHash') internalFileHash?: string,
    @Body('forceCompare') forceCompare?: string,
  ) {
    if (!pointJson?.trim()) {
      throw new BadRequestException('point JSON is required');
    }

    let point: GovRequirementPoint;
    try {
      point = JSON.parse(pointJson) as GovRequirementPoint;
    } catch {
      throw new BadRequestException('point must be valid JSON');
    }

    const files = this.toPdfFiles(uploads);
    const markdown = internalMarkdown?.trim();
    const hash = internalFileHash?.trim();
    if (!files.length && !markdown && !hash) {
      throw new BadRequestException(
        'Attach internal PDF(s), pass internalFileHash (loads parse/extract from Supabase), or pass Landing AI parsed markdown from POST /landing-ai/parse.',
      );
    }

    const fileName =
      internalFileName?.trim() ||
      files[0]?.originalname ||
      'internal-policy.pdf';

    return this.landingAiService.comparePoint(
      point,
      files,
      fileName,
      markdown,
      internalFileHash?.trim(),
      forceCompare === 'true' || forceCompare === '1',
    );
  }

  private toPdfFiles(uploads: Express.Multer.File[]): UploadedPdfFile[] {
    if (!uploads?.length) return [];
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
