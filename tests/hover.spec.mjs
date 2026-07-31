/**
 * Behaviour tests for the still→clip hover effect.
 *
 *   npx playwright install chromium   # once
 *   npm test
 *
 * The effect is the whole product here, and every one of its failure modes is
 * invisible in a screenshot: a clip that never loads, one that keeps playing
 * after the pointer leaves, a card that eagerly downloads 4 MB on page load,
 * or motion that ignores prefers-reduced-motion. So they get asserted.
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium, devices } from 'playwright';

const PORT = 5199;
const URL = `http://localhost:${PORT}/`;

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

/** Wait for the dev server rather than guessing at a sleep duration. */
async function waitForServer(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(URL);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error(`Dev server did not come up on ${URL}`);
}

const server = spawn(
  'npx',
  ['vite', '--port', String(PORT), '--strictPort'],
  { stdio: 'ignore', detached: true },
);

let browser;
try {
  await waitForServer();

  browser = await chromium.launch(
    // Honoured in sandboxes that ship a prebuilt Chromium; elsewhere Playwright
    // resolves its own download.
    process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  );

  // --- desktop: pointer drives the clip -----------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('requestfailed', (r) => errors.push(`${r.url()} ${r.failure()?.errorText ?? ''}`));
    page.on('response', (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`));

    await page.goto(URL, { waitUntil: 'networkidle' });

    const shot = page.locator('.view').first();
    const video = shot.locator('video');

    check('starts idle', (await shot.getAttribute('data-clip')) === 'idle');
    check('no clip bytes before hover', (await video.evaluate((v) => v.currentSrc)) === '');
    check('still is visible', await shot.locator('img').isVisible());

    await shot.hover();
    await page
      .waitForFunction(
        () => document.querySelector('.view')?.getAttribute('data-clip') === 'playing',
        null,
        { timeout: 5000 },
      )
      .catch(() => {});

    check('hover starts the clip', (await shot.getAttribute('data-clip')) === 'playing');
    check(
      'source attached lazily',
      (await video.evaluate((v) => v.currentSrc)).endsWith('eingang.webm'),
    );
    // Der Clip ist eine Kamerafahrt, kein Ambient-Loop: er darf nicht schleifen,
    // sonst springt die Kamera alle sechs Sekunden zurück.
    check('clip is muted', await video.evaluate((v) => v.muted));
    check('clip does not loop', await video.evaluate((v) => !v.loop));

    await page.waitForTimeout(600); // the crossfade is 420ms
    check('clip fully faded in', (await video.evaluate((v) => getComputedStyle(v).opacity)) === '1');

    const before = await video.evaluate((v) => v.currentTime);
    await page.waitForTimeout(700);
    const after = await video.evaluate((v) => v.currentTime);
    check('playback advances', after > before, `${before.toFixed(2)}s → ${after.toFixed(2)}s`);

    await page.mouse.move(10, 10);
    await page.waitForTimeout(700);
    check('leaving returns to the still', (await shot.getAttribute('data-clip')) === 'idle');
    check('clip paused on leave', await video.evaluate((v) => v.paused));
    check('clip rewound', (await video.evaluate((v) => v.currentTime)) === 0);

    check('no console or network errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // --- prefers-reduced-motion: nothing moves, nothing downloads -----------
  {
    const context = await browser.newContext({
      reducedMotion: 'reduce',
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(URL, { waitUntil: 'networkidle' });
    const shot = page.locator('.view').first();
    await shot.hover();
    await page.waitForTimeout(900);
    check('reduced motion keeps the still', (await shot.getAttribute('data-clip')) === 'idle');
    check(
      'reduced motion downloads no clip',
      (await shot.locator('video').evaluate((v) => v.currentSrc)) === '',
    );
    await context.close();
  }

  // --- touch: no hover exists, so visibility drives playback --------------
  {
    const context = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await context.newPage();
    await page.goto(URL, { waitUntil: 'networkidle' });
    const shot = page.locator('.view').first();
    await shot.scrollIntoViewIfNeeded();
    await page
      .waitForFunction(
        () => document.querySelector('.view')?.getAttribute('data-clip') === 'playing',
        null,
        { timeout: 6000 },
      )
      .catch(() => {});
    check('touch: in-view card plays', (await shot.getAttribute('data-clip')) === 'playing');
    check('touch: hover hint hidden', !(await page.locator('[data-hint]').isVisible()));
    await context.close();
  }

  // --- a missing clip must degrade to the still, not to a black box -------
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.route('**/*.webm', (r) => r.fulfill({ status: 404, body: '' }));
    await page.route('**/*.mp4', (r) => r.fulfill({ status: 404, body: '' }));
    await page.goto(URL, { waitUntil: 'networkidle' });
    const shot = page.locator('.view').first();
    await shot.hover();
    await page.waitForTimeout(1200);
    check('missing clip falls back to the still', (await shot.getAttribute('data-clip')) === 'idle');
    check('still stays visible on failure', await shot.locator('img').isVisible());
    await context.close();
  }
} finally {
  await browser?.close();
  try {
    process.kill(-server.pid);
  } catch {
    /* already gone */
  }
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
