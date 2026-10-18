import { neon } from '@neondatabase/serverless';
import { NeonAdapter } from './neonAdapter';
import type { DatabaseAdapter } from '../types/database';

interface QueryResult {
  rows: any[];
}

function requiredDatabaseUrl(env: { DATABASE_URL?: string }): string {
  const value = env.DATABASE_URL?.trim();
  if (!value) throw new Error('DATABASE_URL is required');
  const parsed = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname.endsWith('.neon.tech')) {
    throw new Error('DATABASE_URL must point to a Neon PostgreSQL database');
  }
  return value;
}

/** One database implementation, with no provider selection or legacy fallback. */
export async function createAdapter(env: { DATABASE_URL?: string }): Promise<DatabaseAdapter> {
  const sql = neon(requiredDatabaseUrl(env));
  const client = {
    async query(text: string, values: unknown[] = []): Promise<QueryResult> {
      const rows = await sql.query(text, values) as any[];
      return { rows };
    },
    async transaction(queries: Array<{ text: string; values?: unknown[] }>): Promise<QueryResult[]> {
      const results = await sql.transaction((transactionSql) =>
        queries.map(({ text, values = [] }) => transactionSql.query(text, values)),
      );
      return results.map((rows) => ({ rows: rows as any[] }));
    },
  };
  return new NeonAdapter(client);
}
