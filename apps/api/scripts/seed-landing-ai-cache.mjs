/**
 * Seed Landing AI extract cache in Supabase (no API credits).
 * Prerequisite: npm run db:migrate (creates tables automatically)
 *
 * Usage: node apps/api/scripts/seed-landing-ai-cache.mjs
 */
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });
dotenv.config({ path: join(__dirname, '..', '..', '..', '.env') });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const seedDir = join(__dirname, '..', 'src', 'modules', 'landing-ai', 'seed-data');
const files = [
  {
    path: join(seedDir, 'gov-tfs-guidelines.extract.json'),
    operation: 'extract_gov',
  },
  {
    path: join(seedDir, 'internal-imptfs.extract.json'),
    operation: 'extract_internal',
  },
];

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch },
  realtime: { transport: ws },
});

async function main() {
  const { error: pingError } = await client
    .from('landing_ai_extract_cache')
    .select('id')
    .limit(1);

  if (pingError) {
    console.error(
      'Supabase tables not found. Run: npm run db:migrate',
    );
    console.error(pingError.message);
    process.exit(1);
  }

  for (const { path, operation } of files) {
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    const points = data.points ?? [];
    const { error: upsertError } = await client
      .from('landing_ai_extract_cache')
      .upsert(
        {
          file_hash: data.fileHash,
          schema_key: data.schemaKey,
          points_json: { points },
          extract_model: 'seed-builtin',
          credit_usage: data.creditUsage ?? 0,
        },
        { onConflict: 'file_hash,schema_key' },
      );

    if (upsertError) {
      console.error(`Failed seeding ${data.fileName}:`, upsertError.message);
      process.exit(1);
    }

    await client.from('landing_ai_jobs').insert({
      operation,
      file_name: data.fileName,
      file_hash: data.fileHash,
      file_size_bytes: 0,
      status: 'success',
      credit_usage: data.creditUsage ?? 0,
      duration_ms: data.durationMs ?? null,
      landing_job_id: data.jobId ?? null,
      model: 'seed-builtin',
      error_message: 'seeded_from_file',
      response_json: { pointCount: points.length },
    });

    console.log(`Seeded ${points.length} points → ${data.fileName}`);
  }

  console.log('Done. Load points in web: /landing-ai → Load from DB buttons.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
