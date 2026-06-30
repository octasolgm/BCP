import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private adminClient: SupabaseClient | null = null;
  private anonClient: SupabaseClient | null = null;
  private url = '';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.url = this.getRequired('SUPABASE_URL');
    const serviceKey = this.getRequired('SUPABASE_SERVICE_KEY');
    const anonKey = this.getRequired('SUPABASE_ANON_KEY');

    this.adminClient = createClient(this.url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.anonClient = createClient(this.url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  getAdminClient(): SupabaseClient {
    if (!this.adminClient) {
      throw new Error('Supabase admin client is not initialized');
    }
    return this.adminClient;
  }

  getAnonClient(): SupabaseClient {
    if (!this.anonClient) {
      throw new Error('Supabase anon client is not initialized');
    }
    return this.anonClient;
  }

  getUrl(): string {
    return this.url;
  }

  private getRequired(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value || value.trim() === '') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return value.trim();
  }
}
