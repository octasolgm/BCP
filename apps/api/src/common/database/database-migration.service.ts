import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class DatabaseMigrationService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseMigrationService.name);

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const autoMigrate =
      this.configService.get<string>('AUTO_DB_MIGRATE') !== 'false';
    if (!autoMigrate) {
      this.logger.log('AUTO_DB_MIGRATE=false — skipping database migrations');
      return;
    }
    try {
      await this.runPendingMigrations();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Migration failed';
      this.logger.error(
        `Database migration failed: ${message}. Fix DATABASE_URL (Supabase → Settings → Database → URI) and run npm run db:migrate`,
      );
    }
  }

  resolveMigrationsDir(): string {
    const candidates = [
      join(process.cwd(), 'docs', 'supabase', 'migrations'),
      join(process.cwd(), '..', '..', 'docs', 'supabase', 'migrations'),
    ];
    for (const dir of candidates) {
      try {
        const files = readdirSync(dir).filter((f) => f.endsWith('.sql'));
        if (files.length > 0) return dir;
      } catch {
        /* try next */
      }
    }
    throw new Error(
      'Migrations folder not found. Expected docs/supabase/migrations',
    );
  }

  buildConnectionString(): string {
    const direct = this.configService.get<string>('DATABASE_URL')?.trim();
    if (direct) return direct;

    const password = this.configService.get<string>('SUPABASE_DB_PASSWORD')?.trim();
    const url = this.configService.get<string>('SUPABASE_URL')?.trim();
    if (!password || !url) {
      throw new Error(
        'Set DATABASE_URL or SUPABASE_URL + SUPABASE_DB_PASSWORD for migrations',
      );
    }
    const ref = new URL(url).hostname.split('.')[0];
    return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
  }

  async runPendingMigrations(): Promise<string[]> {
    const applied: string[] = [];
    const client = new Client({
      connectionString: this.buildConnectionString(),
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);

      const migrationsDir = this.resolveMigrationsDir();
      const files = readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      const { rows: doneRows } = await client.query<{ name: string }>(
        'SELECT name FROM schema_migrations',
      );
      const done = new Set(doneRows.map((r) => r.name));

      if (done.size === 0 && files.length > 0) {
        const { rows: regRows } = await client.query<{ reg: string | null }>(
          "SELECT to_regclass('public.landing_ai_jobs') AS reg",
        );
        if (regRows[0]?.reg) {
          const baseline = files.find((f) => f.includes('landing_ai'));
          if (baseline) {
            await client.query(
              'INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING',
              [baseline],
            );
            done.add(baseline);
            this.logger.warn(
              `Baselined ${baseline} — tables already existed (manual setup)`,
            );
          }
        }
      }

      for (const file of files) {
        if (done.has(file)) continue;
        const sql = readFileSync(join(migrationsDir, file), 'utf-8');
        this.logger.log(`Applying migration: ${file}`);
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query(
            'INSERT INTO schema_migrations (name) VALUES ($1)',
            [file],
          );
          await client.query('COMMIT');
          applied.push(file);
          this.logger.log(`Applied migration: ${file}`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }

      if (applied.length === 0) {
        this.logger.log('Database migrations up to date');
      }
      return applied;
    } finally {
      await client.end();
    }
  }
}
