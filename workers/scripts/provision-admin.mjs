import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { hash } from 'bcryptjs';
import { Client } from 'pg';
import { loadLocalDevVars } from './load-env.mjs';

function readHidden(label) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Run this command in an interactive terminal so the new password is not echoed.');
  }

  return new Promise((resolve, reject) => {
    let value = '';
    const priorRawMode = stdin.isRaw;
    stdout.write(label);
    stdin.setRawMode(true);
    stdin.resume();

    const finish = (error) => {
      stdin.off('data', onData);
      stdin.setRawMode(Boolean(priorRawMode));
      stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (chunk) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') return finish(new Error('Cancelled.'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else if (character >= ' ') value += character;
      }
    };

    stdin.on('data', onData);
  });
}

async function main() {
  await loadLocalDevVars();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Set DATABASE_URL for the intended new Neon database.');
  }

  let databaseHost;
  try {
    databaseHost = new URL(databaseUrl).hostname;
  } catch {
    throw new Error('DATABASE_URL is not a valid connection URL.');
  }
  if (!databaseHost.endsWith('.neon.tech')) {
    throw new Error('The target must be a Neon database host.');
  }

  stdout.write(`Target Neon host: ${databaseHost}\n`);
  const prompt = createInterface({ input: stdin, output: stdout });
  const confirmation = await prompt.question('After verifying this is the new auth database, type NEW NEON AUTH DATABASE: ');
  const email = (await prompt.question('New admin email: ')).trim().toLowerCase();
  prompt.close();

  if (confirmation !== 'NEW NEON AUTH DATABASE') throw new Error('Database confirmation did not match.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid new admin email.');

  let password = await readHidden('New admin password (hidden, 16+ characters): ');
  let repeatedPassword = await readHidden('Repeat new admin password: ');
  if (password.length < 16) throw new Error('Admin password must be at least 16 characters.');
  if (password !== repeatedPassword) throw new Error('The entered passwords do not match.');

  const finalPrompt = createInterface({ input: stdin, output: stdout });
  const finalConfirmation = await finalPrompt.question('Type CREATE NEW ADMIN to insert a new Neon account: ');
  finalPrompt.close();
  if (finalConfirmation !== 'CREATE NEW ADMIN') throw new Error('Admin creation was not confirmed.');

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('users', 'user_roles')
    `);
    const availableTables = new Set(tables.rows.map((row) => row.table_name));
    if (!availableTables.has('users') || !availableTables.has('user_roles')) {
      throw new Error('Required Neon auth tables do not exist; this script does not run migrations.');
    }

    await client.query('BEGIN');
    const existing = await client.query(
      'SELECT id FROM public.users WHERE lower(email) = $1 LIMIT 1 FOR UPDATE',
      [email],
    );
    if (existing.rows.length) throw new Error('This email already exists; provisioning never promotes or overwrites accounts.');

    const userId = randomUUID();
    const passwordHash = await hash(password, 12);
    await client.query(
      `INSERT INTO public.users (id, email, password_hash, full_name, account_status)
       VALUES ($1, $2, $3, $4, 'active')`,
      [userId, email, passwordHash, email.split('@')[0]],
    );
    await client.query(
      `INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'admin')`,
      [userId],
    );
    await client.query('COMMIT');
    stdout.write('A new admin account was provisioned in the confirmed Neon database.\n');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    password = '';
    repeatedPassword = '';
    await client.end().catch(() => {});
  }
}

main().catch(() => {
  console.error('Admin provisioning failed; no account was created. Check the target and inputs, then retry.');
  process.exitCode = 1;
});
