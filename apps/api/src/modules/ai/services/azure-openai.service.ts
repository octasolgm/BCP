import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SimpleAiCallResponse } from '../types/ai-response.types';
import { toResponseMessage } from '../utils/llm-response-normalizer';
import { normalizeAzure } from '../utils/llm-model-routing';

interface AzureChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

@Injectable()
export class AzureOpenAiService {
  constructor(private readonly configService: ConfigService) {}

  async chat(prompt: string, aiModel: string): Promise<SimpleAiCallResponse> {
    const model = normalizeAzure(aiModel);
    const apiKey = this.configService.get<string>('AZURE_OPENAI_API_KEY');
    const endpoint = this.configService.get<string>('AZURE_OPENAI_ENDPOINT');
    const apiVersion =
      this.configService.get<string>('AZURE_OPENAI_API_VERSION') ??
      '2024-02-15-preview';
    const deployment = this.getDeployment(model);

    if (!apiKey || !endpoint || !deployment) {
      return {
        success: false,
        message: 'Azure OpenAI is not configured in environment variables',
        model,
        error: 'Missing Azure OpenAI configuration',
      };
    }

    const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 16384,
        }),
        signal: controller.signal,
      });

      const body = await response.text();
      if (!response.ok) {
        return {
          success: false,
          message: `Azure OpenAI failed: ${response.status}`,
          error: body,
          model,
        };
      }

      const parsed = JSON.parse(body) as AzureChatResponse;
      const text = parsed.choices?.[0]?.message?.content;
      if (!text?.trim()) {
        return {
          success: false,
          message: 'Empty response from Azure OpenAI',
          error: body,
          model,
        };
      }

      return {
        success: true,
        message: toResponseMessage(text),
        model,
        usage: parsed.usage
          ? {
              promptTokens: parsed.usage.prompt_tokens ?? 0,
              completionTokens: parsed.usage.completion_tokens ?? 0,
              totalTokens: parsed.usage.total_tokens ?? 0,
            }
          : undefined,
        responseTime: new Date().toISOString(),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown Azure error';
      return {
        success: false,
        message: message.includes('abort') ? 'Request timed out' : message,
        error: message,
        model,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private getDeployment(model: string): string | undefined {
    const key = `AZURE_OPENAI_DEPLOYMENT_${model.toUpperCase().replace(/[.-]/g, '_')}`;
    const direct = this.configService.get<string>(key);
    if (direct) {
      return direct;
    }
    const map: Record<string, string> = {
      'gpt-4o': 'AZURE_OPENAI_DEPLOYMENT_GPT_4O',
      'gpt-4o-mini': 'AZURE_OPENAI_DEPLOYMENT_GPT_4O_MINI',
      'gpt-3.5-turbo': 'AZURE_OPENAI_DEPLOYMENT_GPT_35',
      'gpt-5': 'AZURE_OPENAI_DEPLOYMENT_GPT_5',
    };
    const envKey = map[model];
    return envKey ? this.configService.get<string>(envKey) : undefined;
  }
}
