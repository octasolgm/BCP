import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const EMBEDDING_MODEL = 'text-embedding-004';
const CHAT_MODEL = 'gemini-2.0-flash';
const EXPECTED_EMBEDDING_DIM = 768;

@Injectable()
export class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getClient(): GoogleGenerativeAI {
    if (this.genAI) {
      return this.genAI;
    }
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey || apiKey.trim() === '' || apiKey === 'your-gemini-key') {
      throw new Error(
        'Missing or placeholder GEMINI_API_KEY — set a valid key in .env',
      );
    }
    this.genAI = new GoogleGenerativeAI(apiKey.trim());
    return this.genAI;
  }

  async embed(text: string): Promise<number[]> {
    if (!text || text.trim() === '') {
      throw new Error('embed() requires non-empty text');
    }

    try {
      const model = this.getClient().getGenerativeModel({ model: EMBEDDING_MODEL });
      const result = await model.embedContent(text);
      const values = result.embedding?.values;

      if (!values || values.length === 0) {
        throw new Error('Gemini returned an empty embedding');
      }

      if (values.length !== EXPECTED_EMBEDDING_DIM) {
        throw new Error(
          `Expected ${EXPECTED_EMBEDDING_DIM}-dim embedding, got ${values.length}`,
        );
      }

      return values;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown embedding error';
      throw new Error(`Gemini embed failed: ${message}`);
    }
  }

  async generate(
    prompt: string,
    systemInstruction?: string,
  ): Promise<string> {
    if (!prompt || prompt.trim() === '') {
      throw new Error('generate() requires non-empty prompt');
    }

    try {
      const model = this.getClient().getGenerativeModel({
        model: CHAT_MODEL,
        ...(systemInstruction ? { systemInstruction } : {}),
      });
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      if (!text) {
        throw new Error('Gemini returned an empty response');
      }

      return text;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown generation error';
      throw new Error(`Gemini generate failed: ${message}`);
    }
  }
}
