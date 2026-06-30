import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SimpleAiCallResponse,
  UploadedPdfFile,
} from '../types/ai-response.types';
import { toResponseMessage } from '../utils/llm-response-normalizer';
import {
  getGeminiFallbackChain,
  isAzure,
  isGemini,
  normalizeAzure,
  normalizeGemini,
} from '../utils/llm-model-routing';
import { AzureOpenAiService } from './azure-openai.service';

const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_RETRIES_PER_MODEL = 5;
const RETRY_DELAYS_SECONDS = [3, 6, 12, 24, 30];

@Injectable()
export class BcpAnalyzeService {
  private readonly logger = new Logger(BcpAnalyzeService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly azureOpenAiService: AzureOpenAiService,
  ) {}

  async analyze(
    files: UploadedPdfFile[],
    prompt: string,
    aiModel?: string,
    options?: { allowModelFallback?: boolean },
  ): Promise<SimpleAiCallResponse> {
    if (!prompt?.trim()) {
      return {
        success: false,
        message: 'prompt is required',
        model: aiModel,
        error: 'Missing prompt',
      };
    }

    const userSpecifiedModel = Boolean(aiModel?.trim());
    const requestedLabel = userSpecifiedModel ? aiModel!.trim() : undefined;
    const rawModel = userSpecifiedModel
      ? aiModel!.trim()
      : this.configService.get<string>('GEMINI_DEFAULT_MODEL') ??
        'gemini-2.5-flash-lite';
    const allowModelFallback =
      options?.allowModelFallback === true || !userSpecifiedModel;

    if (isAzure(rawModel)) {
      const azureModel = normalizeAzure(rawModel);
      if (files.length > 0) {
        return {
          success: false,
          message:
            'Azure OpenAI models do not accept file uploads. Use a gemini-* model with files, or call without files.',
          model: azureModel,
          error: 'Azure does not support file upload',
        };
      }
      return this.azureOpenAiService.chat(prompt, azureModel);
    }

    if (isGemini(rawModel) || !userSpecifiedModel) {
      const geminiModel = normalizeGemini(rawModel);
      return this.callGemini(
        files,
        prompt,
        geminiModel,
        allowModelFallback,
        requestedLabel,
      );
    }

    return {
      success: false,
      message:
        'Unsupported aiModel. Use gemini-* (with optional PDF) or gpt-4o, gpt-4o-mini, gpt-3.5-turbo, gpt-5 (prompt only).',
      model: rawModel,
      error: 'Unsupported model',
    };
  }

  private async callGemini(
    files: UploadedPdfFile[],
    prompt: string,
    model: string,
    allowModelFallback: boolean,
    requestedLabel?: string,
  ): Promise<SimpleAiCallResponse> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey?.trim() || apiKey === 'your-gemini-key') {
      return {
        success: false,
        message: 'Gemini API key is not configured',
        model,
        error: 'Missing GEMINI_API_KEY',
      };
    }

    let requestJson: string;
    if (files.length > 0) {
      const validation = this.validatePdfFiles(files);
      if (validation) {
        return validation;
      }
      const base64Pdfs = files.map((f) => f.buffer.toString('base64'));
      requestJson = this.buildGeminiPdfRequest(base64Pdfs, prompt);
    } else {
      requestJson = this.buildGeminiTextRequest(prompt);
    }

    let lastError: string | undefined;
    const triedModels: string[] = [];

    for (const tryModel of getGeminiFallbackChain(model, allowModelFallback)) {
      triedModels.push(tryModel);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${tryModel}:generateContent?key=${apiKey}`;

      this.logger.log(
        `BCP analyze → Gemini ${tryModel}, files=${files.length}, requested=${model}`,
      );

      for (let attempt = 1; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 180_000);

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: requestJson,
            signal: controller.signal,
          });
          clearTimeout(timeout);

          const body = await response.text();

          if (response.ok) {
            const result = this.parseGeminiResponse(body, tryModel);
            if (
              requestedLabel &&
              requestedLabel.toLowerCase() !== tryModel.toLowerCase()
            ) {
              result.requestedModel = requestedLabel;
            }
            return result;
          }

          lastError = body;
          const isOverloaded =
            response.status === 503 ||
            body.toLowerCase().includes('high demand') ||
            body.includes('UNAVAILABLE') ||
            body.includes('RESOURCE_EXHAUSTED');
          const isModelGone =
            response.status === 404 ||
            body.toLowerCase().includes('no longer available') ||
            body.includes('NOT_FOUND');

          if (isOverloaded && attempt < MAX_RETRIES_PER_MODEL) {
            const delay =
              RETRY_DELAYS_SECONDS[
                Math.min(attempt - 1, RETRY_DELAYS_SECONDS.length - 1)
              ];
            await new Promise((r) => setTimeout(r, delay * 1000));
            continue;
          }

          if (isOverloaded || isModelGone) {
            break;
          }

          return {
            success: false,
            message: isModelGone
              ? `Gemini model '${tryModel}' was not found. For Gemini 3.1 Pro use aiModel=gemini-3.1-pro-preview.`
              : `Gemini API failed: ${response.status}`,
            error: body,
            model: tryModel,
            requestedModel: requestedLabel,
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error';
          if (message.includes('abort')) {
            return {
              success: false,
              message: 'Request timed out',
              error: message,
              model: tryModel,
            };
          }
          lastError = message;
          break;
        }
      }
    }

    return {
      success: false,
      message: allowModelFallback
        ? `Gemini is temporarily overloaded. Tried: ${triedModels.join(', ')}. Please retry in a few minutes.`
        : `Gemini model '${model}' is temporarily unavailable. Please retry in a few minutes.`,
      error: lastError,
      model,
      requestedModel: requestedLabel,
    };
  }

  private validatePdfFiles(
    files: UploadedPdfFile[],
  ): SimpleAiCallResponse | null {
    for (const file of files) {
      if (!file.originalname.toLowerCase().endsWith('.pdf')) {
        return {
          success: false,
          message: `Only PDF files are supported (${file.originalname})`,
          error: 'Invalid file type',
        };
      }
      if (file.size > MAX_PDF_SIZE_BYTES) {
        return {
          success: false,
          message: `PDF ${file.originalname} exceeds ${MAX_PDF_SIZE_BYTES / 1024 / 1024} MB limit`,
          error: 'File too large',
        };
      }
    }
    return null;
  }

  private buildGeminiPdfRequest(base64Pdfs: string[], prompt: string): string {
    const parts: Array<Record<string, unknown>> = base64Pdfs.map((data) => ({
      inline_data: { mime_type: 'application/pdf', data },
    }));
    parts.push({ text: prompt });
    return JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 65536 },
    });
  }

  private buildGeminiTextRequest(prompt: string): string {
    return JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 65536 },
    });
  }

  private parseGeminiResponse(
    responseContent: string,
    model: string,
  ): SimpleAiCallResponse {
    const parsed = JSON.parse(responseContent) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };

    const textParts = parsed.candidates?.[0]?.content?.parts
      ?.map((p) => p.text)
      .filter((t) => t?.trim());
    const text = textParts?.join('\n');

    if (!text?.trim()) {
      return {
        success: false,
        message: 'Empty response from Gemini',
        error: responseContent,
        model,
      };
    }

    const usage = parsed.usageMetadata;
    return {
      success: true,
      message: toResponseMessage(text),
      model,
      usage: usage
        ? {
            promptTokens: usage.promptTokenCount ?? 0,
            completionTokens: usage.candidatesTokenCount ?? 0,
            totalTokens: usage.totalTokenCount ?? 0,
          }
        : undefined,
      responseTime: new Date().toISOString(),
    };
  }
}
