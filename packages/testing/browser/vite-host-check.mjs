/* global document, getComputedStyle, Image */

import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, normalizePath, preview } from 'vite';
import { gss } from '@gss-l/vite';
import { react } from '@gss-l/react';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="3" height="2"><path fill="red" d="M0 0h3v2H0z"/></svg>';
const nativeCss = `
  @property --native-tone { syntax: "<color>"; inherits: false; initial-value: red; }
  .native-card { color: var(--native-tone); background-image: url("/reference.svg");
    display: -webkit-box; display: -webkit-flex; display: flex; }
  .native-fallback { display: -webkit-box; display: -webkit-flex; display: flex;
    -webkit-box-orient: vertical; -webkit-box-direction: normal;
    -webkit-flex-direction: column; flex-direction: column;
    background-image: url("/reference.svg"); }
`;

/** Actual Vite production artifact, compared against separately authored native CSS in one browser. */
export async function checkViteHostCompatibility(browser) {
  const root = normalizePath(await realpath(await mkdtemp(join(tmpdir(), 'gss-vite-host-browser-'))));
  let server;
  const contexts = [];
  try {
    await mkdir(join(root, 'public'));
    await writeFile(join(root, 'public/reference.svg'), svg);
    await writeFile(join(root, 'icon.svg'), svg);
    await writeFile(join(root, 'index.html'), `<!doctype html><html><head><style>${nativeCss}</style></head><body>
      <div id="gss"></div><div id="native" class="native-card"></div>
      <div id="fallback"><span>first</span><span>second</span></div>
      <div id="native-fallback" class="native-fallback"><span>first</span><span>second</span></div>
      <script type="module" src="/main.ts"></script></body></html>`);
    await writeFile(join(root, 'main.ts'), `import styles from './Card.gss';
      import fallback from './Fallback.gss';
      document.getElementById('gss')!.className = styles.card.self;
      document.getElementById('fallback')!.className = fallback.fallback.self;`);
    await writeFile(join(root, 'Fallback.gss'),
      '.fallback { display: flex; flex-direction: column; background-image: url("./icon.svg"); }');
    await writeFile(join(root, 'Card.gss'), `
      @property --tone { syntax: "<color>"; inherits: false; initial-value: red; }
      .card { color: var(--tone); background-image: url("./icon.svg"); display: flex; }
    `);
    await build({ root, configFile: false, plugins: [gss({ adapter: react() })], logLevel: 'silent',
      build: { minify: true, cssTarget: 'safari6' } });
    const manifest = JSON.parse(await readFile(join(root, 'dist/gss-manifest.json'), 'utf8'));
    const cssFile = join(root, 'dist', manifest.cssAsset);
    const css = await readFile(cssFile, 'utf8');
    if (!css.includes('display: -webkit-box;') || !css.includes('@property --tone') ||
      !css.includes('flex-direction: column;') ||
      !manifest.compiler.moduleDetails.some((entry) => entry.id === 'Fallback.gss' &&
        entry.compilationMode === 'preserved' && entry.fallbackReasons.some((reason) =>
          reason.property === 'flex-direction' && reason.reason === 'compatibility-sequence-unatomizable'))) {
      throw new Error('Host artifact lacks the requested sequence, resource or compatibility fallback.');
    }
    server = await preview({ root, configFile: false, logLevel: 'silent',
      preview: { host: '127.0.0.1', port: 0, strictPort: false } });
    const address = server.httpServer.address();
    if (!address || typeof address === 'string') throw new Error('No Vite preview address.');
    const url = `http://127.0.0.1:${address.port}/`;
    async function readPage() {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(String(error)));
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction(() => document.getElementById('gss')?.className);
      const readings = await page.evaluate(async () => {
        async function sample(id) {
          const style = getComputedStyle(document.getElementById(id));
          const imageUrl = /^url\("([^"]+)"\)$/.exec(style.backgroundImage)?.[1];
          if (!imageUrl) throw new Error(`Missing ${id} image URL`);
          const image = new Image();
          image.src = imageUrl;
          await image.decode();
          return { color: style.color, display: style.display, flexDirection: style.flexDirection,
            size: `${image.naturalWidth}x${image.naturalHeight}`, imageUrl };
        }
        return { gss: await sample('gss'), native: await sample('native'),
          fallback: await sample('fallback'), nativeFallback: await sample('native-fallback'),
          linked: [...document.querySelectorAll('link[rel="stylesheet"]')].some((link) => link.href.includes('gss-')) };
      });
      return { readings, pageErrors };
    }
    const baseline = await readPage();
    const expected = (entry) => entry.color === 'rgb(255, 0, 0)' && entry.display === 'flex' && entry.size === '3x2';
    const expectedFallback = (entry) => entry.color === 'rgb(0, 0, 0)' && entry.display === 'flex' &&
      entry.flexDirection === 'column' && entry.size === '3x2';
    if (!baseline.readings.linked || !expected(baseline.readings.gss) || !expected(baseline.readings.native) ||
      !expectedFallback(baseline.readings.fallback) || !expectedFallback(baseline.readings.nativeFallback) ||
      baseline.pageErrors.length || !baseline.readings.gss.imageUrl.includes('/assets/') ||
      !baseline.readings.fallback.imageUrl.includes('/assets/')) {
      throw new Error(`Vite/browser compatibility baseline differs: ${JSON.stringify(baseline)}`);
    }
    const weakened = css.replace(/@property --tone \{[^}]*\}/, '');
    if (weakened === css) throw new Error('Resource corruption did not remove the registration.');
    await writeFile(cssFile, weakened);
    const control = await readPage();
    const resourceDetected = control.readings.gss.color === 'rgb(0, 0, 0)' &&
      control.readings.native.color === 'rgb(255, 0, 0)' &&
      expectedFallback(control.readings.fallback) && expectedFallback(control.readings.nativeFallback) &&
      control.readings.gss.display === 'flex' && control.readings.gss.size === '3x2' &&
      control.pageErrors.length === 0;

    const unprefixedFallback = /(^|\n)(\s*)flex-direction: column;/gm;
    if ([...css.matchAll(unprefixedFallback)].length !== 1) {
      throw new Error('Fallback corruption could not identify one unprefixed declaration.');
    }
    const fallbackWeakened = css.replace(unprefixedFallback, '$1$2flex-direction: row;');
    await writeFile(cssFile, fallbackWeakened);
    const fallbackControl = await readPage();
    const fallbackDetected = fallbackControl.readings.fallback.flexDirection === 'row' &&
      expectedFallback(fallbackControl.readings.nativeFallback) &&
      expected(fallbackControl.readings.gss) && expected(fallbackControl.readings.native) &&
      fallbackControl.readings.fallback.display === 'flex' && fallbackControl.readings.fallback.size === '3x2' &&
      fallbackControl.pageErrors.length === 0;
    return { detected: resourceDetected && fallbackDetected, resourceDetected, fallbackDetected,
      baseline: baseline.readings, control: control.readings, fallbackControl: fallbackControl.readings,
      pageErrors: [...baseline.pageErrors, ...control.pageErrors, ...fallbackControl.pageErrors] };
  } finally {
    try {
      await Promise.all(contexts.map((context) => context.close()));
    } finally {
      try {
        await server?.close();
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  }
}
