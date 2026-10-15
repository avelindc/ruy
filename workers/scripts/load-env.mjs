import { readFile } from 'node:fs/promises';

/** Load ignored local Worker variables for Node maintenance scripts, without logging them. */
export async function loadLocalDevVars() {
  let contents;
  try {
    contents = await readFile(new URL('../.dev.vars', import.meta.url), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw new Error('Could not read the local Worker variables file.');
  }

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;

    const name = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (/^[A-Z][A-Z0-9_]*$/.test(name) && process.env[name] === undefined) {
      process.env[name] = value;
    }
  }
}
