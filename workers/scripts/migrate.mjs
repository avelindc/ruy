import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Client } from 'pg';
import { loadLocalDevVars } from './load-env.mjs';

const migrationName = '0001_initial';
const migrationPath = new URL('../migrations/0001_initial.sql', import.meta.url);

async function main() {
  await loadLocalDevVars();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');

  let host;
  try {
    const parsed = new URL(databaseUrl);
    host = parsed.hostname;
    if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') throw new Error();
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }
  if (!host.endsWith('.neon.tech')) throw new Error('The target must be a Neon database host.');

  const sql = await readFile(migrationPath, 'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex');
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const prompt = createInterface({ input: stdin, output: stdout });
    stdout.write(`Target Neon host: ${host}\n`);
    const confirmation = await prompt.question('Verify this is a new, empty database. Type NEW EMPTY NEON DATABASE: ');
    prompt.close();
    if (confirmation !== 'NEW EMPTY NEON DATABASE') throw new Error('Database confirmation did not match.');

    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('breakout-music-migrations'))");
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const existing = new Set(tables.rows.map((row) => row.table_name));

    if (existing.has('schema_migrations')) {
      const prior = await client.query('SELECT checksum FROM public.schema_migrations WHERE name = $1', [migrationName]);
      if (prior.rows.length) {
        if (prior.rows[0].checksum !== checksum) throw new Error('Applied migration checksum differs from the local migration.');
        await client.query('COMMIT');
        stdout.write('Migration is already applied with the same checksum.\n');
        return;
      }
    }

    const unexpected = [...existing].filter((table) => table !== 'schema_migrations');
    if (unexpected.length) throw new Error(`Refusing to migrate a non-empty database (${unexpected.length} public tables found).`);

    await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    await client.query(sql);
    await client.query('INSERT INTO public.schema_migrations (name, checksum) VALUES ($1, $2)', [migrationName, checksum]);
    await client.query('COMMIT');
    stdout.write('Initial schema applied to the confirmed empty Neon database.\n');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Migration failed.';
  console.error(`Migration stopped: ${message}`);
  process.exitCode = 1;
});
