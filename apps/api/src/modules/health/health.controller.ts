import { Controller, Get } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { GeminiService } from '../../common/gemini/gemini.service';

interface HealthResponse {
  status: string;
  supabase: string;
  gemini: string;
  timestamp: string;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly geminiService: GeminiService,
  ) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const supabase = await this.checkSupabase();
    const gemini = await this.checkGemini();
    const allOk = supabase === 'ok' && gemini === 'ok';

    return {
      status: allOk ? 'ok' : 'degraded',
      supabase,
      gemini,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkSupabase(): Promise<string> {
    try {
      const client = this.supabaseService.getAdminClient();
      const { error } = await client.storage.listBuckets();
      if (error) {
        return `fail: ${error.message}`;
      }
      return 'ok';
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown Supabase error';
      return `fail: ${message}`;
    }
  }

  private async checkGemini(): Promise<string> {
    try {
      const embedding = await this.geminiService.embed('ping');
      if (embedding.length !== 768) {
        return `fail: expected 768 dimensions, got ${embedding.length}`;
      }
      return 'ok';
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown Gemini error';
      return `fail: ${message}`;
    }
  }
}
