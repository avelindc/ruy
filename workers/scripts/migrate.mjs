import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Client } from 'pg';
import { loadLocalDevVars } from './load-env.mjs';

const migrationsDirectory = new URL('../migrations/', import.meta.url);
const initialMigrationName = '0001_initial';

async function loadMigrations() {
  const entries = await readdir(migrationsDirectory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && /^\d{4}_[a-z0-9_]+\.sql$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  if (!files.includes(`${initialMigrationName}.sql`)) {
    throw new Error('The initial schema migration is missing.');
  }

  return Promise.all(files.map(async (file) => {
    const sql = await readFile(new URL(file, migrationsDirectory), 'utf8');
    return {
      name: file.slice(0, -'.sql'.length),
      sql,
      checksum: createHash('sha256').update(sql).digest('hex'),
    };
  }));
}

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

  const migrations = await loadMigrations();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const prompt = createInterface({ input: stdin, output: stdout });
    stdout.write(`Target Neon host: ${host}\n`);
    const confirmation = await prompt.question('Review the pending migrations, then type APPLY BREAKOUT MUSIC MIGRATIONS: ');
    prompt.close();
    if (confirmation !== 'APPLY BREAKOUT MUSIC MIGRATIONS') throw new Error('Migration confirmation did not match.');

    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('breakout-music-migrations'))");

    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const existingTables = new Set(tables.rows.map((row) => row.table_name));
    const applicationTables = [...existingTables].filter((table) => table !== 'schema_migrations');

    if (!existingTables.has('schema_migrations') && applicationTables.length > 0) {
      throw new Error('No migration history exists for this non-empty database; refusing to guess its schema state.');
    }

    await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);

    const appliedInitial = await client.query(
      'SELECT 1 FROM public.schema_migrations WHERE name = $1',
      [initialMigrationName],
    );
    if (!appliedInitial.rows.length && applicationTables.length > 0) {
      throw new Error('The initial schema migration is not recorded for this non-empty database; refusing to modify it.');
    }

    const appliedNames = [];
    for (const migration of migrations) {
      const prior = await client.query(
        'SELECT checksum FROM public.schema_migrations WHERE name = $1',
        [migration.name],
      );

      if (prior.rows.length) {
        if (prior.rows[0].checksum !== migration.checksum) {
          throw new Error(`Applied migration checksum differs from the local ${migration.name} migration.`);
        }
        continue;
      }

      await client.query(migration.sql);
      await client.query(
        'INSERT INTO public.schema_migrations (name, checksum) VALUES ($1, $2)',
        [migration.name, migration.checksum],
      );
      appliedNames.push(migration.name);
    }

    await client.query('COMMIT');
    stdout.write(appliedNames.length
      ? `Applied migrations: ${appliedNames.join(', ')}\n`
      : 'All migrations are already applied with matching checksums.\n');
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
