import { Injectable } from '@nestjs/common';
import { GeminiService } from '../../common/gemini/gemini.service';

@Injectable()
export class EmbeddingService {
  constructor(private readonly geminiService: GeminiService) {}

  // TODO: embed chunks via text-embedding-004 — Stage 4B
}
