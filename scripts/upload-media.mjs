#!/usr/bin/env node
/**
 * Pushes everything in public/media/ to the Bunny storage zone.
 *
 *   cp .env.example .env.local   # then paste the storage-zone password
 *   npm run media:push
 *
 * The storage API is a plain REST endpoint: PUT the bytes to
 * https://<host>/<zone>/<path> with an `AccessKey` header. There is no SDK to
 * install and no build step involved — the clips are static assets that
 * outlive any particular deploy, which is exactly why they live in the CDN
 * rather than in the site bundle.
 */

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MEDIA_DIR = join(ROOT, 'public', 'media');

const CONTENT_TYPES = {
  '.avif': 'image/avif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
};

/** Minimal .env.local reader — one dependency-free file, no dotenv needed. */
function loadEnv() {
  const path = join(ROOT, '.env.local');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, '');
    if (value && !process.env[match[1]]) process.env[match[1]] = value;
  }
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.isFile() && !entry.name.startsWith('.')) yield path;
  }
}

async function main() {
  loadEnv();

  const key = process.env.BUNNY_STORAGE_KEY;
  const zone = process.env.BUNNY_STORAGE_ZONE ?? 'beuwy';
  const host = process.env.BUNNY_STORAGE_HOST ?? 'storage.bunnycdn.com';
  const prefix = process.env.BUNNY_PREFIX ?? 'p96';

  if (!key) {
    console.error(
      'BUNNY_STORAGE_KEY is not set.\n' +
        'Copy .env.example to .env.local and paste the storage-zone password.',
    );
    process.exit(1);
  }

  if (!existsSync(MEDIA_DIR)) {
    console.error(`No such directory: ${MEDIA_DIR}`);
    process.exit(1);
  }

  let uploaded = 0;
  let failed = 0;

  for await (const path of walk(MEDIA_DIR)) {
    const rel = relative(MEDIA_DIR, path).split(/[\\/]/).join('/');
    const body = await readFile(path);
    const url = `https://${host}/${zone}/${prefix}/${rel}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        AccessKey: key,
        'Content-Type': CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream',
        // Bunny verifies this and rejects a truncated upload, which matters
        // for 20 MB clips over a flaky connection.
        Checksum: createHash('sha256').update(body).digest('hex').toUpperCase(),
      },
      body,
    });

    const size = `${(body.byteLength / 1024 / 1024).toFixed(1)} MB`;
    if (response.ok) {
      uploaded += 1;
      console.log(`  uploaded  ${rel}  (${size})`);
    } else {
      failed += 1;
      console.error(`  FAILED    ${rel}  — ${response.status} ${response.statusText}`);
    }
  }

  console.log(`\n${uploaded} uploaded, ${failed} failed → https://${host}/${zone}/${prefix}/`);
  if (failed > 0) process.exit(1);

  console.log(
    'If you replaced a file that was already live, purge the pull zone cache\n' +
      'in the Bunny dashboard — otherwise the old clip is served until the TTL expires.',
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
