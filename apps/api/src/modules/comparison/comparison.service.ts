import { BadRequestException, Injectable } from '@nestjs/common';
import { BcpAnalyzeService } from '../ai/services/bcp-analyze.service';
import { SimpleAiCallResponse } from '../ai/types/ai-response.types';
import {
  buildSemanticMatrixComparePrompt,
  formatMatrixAsTable,
} from './prompts/semantic-matrix-compare-prompt';

function messageAsMarkdown(
  message: SimpleAiCallResponse['message'],
): string {
  if (typeof message === 'string') return message.trim();
  if (Array.isArray(message) || (message && typeof message === 'object')) {
    return JSON.stringify(message, null, 2);
  }
  return '';
}

export type MatrixPayload = {
  headers: string[];
  rows: string[][];
};

export type SemanticMatrixCompareInput = {
  aiModel: string;
  granularFileName: string;
  executiveFileName: string;
  granular: MatrixPayload;
  executive: MatrixPayload;
};

export type SemanticMatrixCompareResult = {
  success: boolean;
  model?: string;
  requestedModel?: string;
  reportMarkdown: string;
  error?: string;
};

function friendlyLlmError(response: SimpleAiCallResponse): string {
  if (typeof response.message === 'string' && response.message.trim()) {
    return response.message.trim();
  }
  const raw = response.error?.trim();
  if (!raw) return 'LLM compare failed — no response text.';
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string };
      message?: string;
    };
    const nested = parsed.error?.message ?? parsed.message;
    if (typeof nested === 'string' && nested.trim()) return nested.trim();
  } catch {
    // not JSON
  }
  if (raw.length > 280) return `${raw.slice(0, 280)}…`;
  return raw;
}

@Injectable()
export class ComparisonService {
  constructor(private readonly bcpAnalyze: BcpAnalyzeService) {}

  async semanticMatrixCompare(
    input: SemanticMatrixCompareInput,
  ): Promise<SemanticMatrixCompareResult> {
    const aiModel = input.aiModel?.trim();
    if (!aiModel) {
      throw new BadRequestException('aiModel is required');
    }
    if (!input.granular?.headers?.length || !input.granular?.rows?.length) {
      throw new BadRequestException(
        'granular matrix must include headers and at least one data row',
      );
    }
    if (!input.executive?.headers?.length || !input.executive?.rows?.length) {
      throw new BadRequestException(
        'executive matrix must include headers and at least one data row',
      );
    }

    const prompt = buildSemanticMatrixComparePrompt({
      granularFileName: input.granularFileName || 'granular-matrix.xlsx',
      executiveFileName: input.executiveFileName || 'executive-checklist.xlsx',
      granularTable: formatMatrixAsTable(
        input.granular.headers,
        input.granular.rows,
      ),
      executiveTable: formatMatrixAsTable(
        input.executive.headers,
        input.executive.rows,
      ),
      granularRowCount: input.granular.rows.length,
      executiveRowCount: input.executive.rows.length,
    });

    const response = await this.bcpAnalyze.analyze([], prompt, aiModel, {
      allowModelFallback: true,
    });
    const reportMarkdown = messageAsMarkdown(response.message);

    if (!response.success || !reportMarkdown) {
      return {
        success: false,
        model: response.model,
        requestedModel: response.requestedModel ?? aiModel,
        reportMarkdown: '',
        error: friendlyLlmError(response),
      };
    }

    return {
      success: true,
      model: response.model,
      requestedModel: response.requestedModel ?? aiModel,
      reportMarkdown,
    };
  }
}
