/* global document, getComputedStyle, Image, URL, fetch, process, window */

import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, createServer, normalizePath, preview } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import postcss from 'postcss';
import { gss } from '@gss-l/vite';
import { react } from '@gss-l/react';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="3" height="2"><path fill="red" d="M0 0h3v2H0z"/></svg>';
const nativeCss = `
  @keyframes native-pulse { from { opacity: 0; } to { opacity: 1; } }
  @property --native-tone { syntax: "<color>"; inherits: false; initial-value: red; }
  .native-card { color: var(--native-tone); background-image: url("/reference.svg");
    display: -webkit-box; display: -webkit-flex; display: flex; }
  .native-motion { color: red; background-image: url("/reference.svg"); display: flex;
    animation-name: native-pulse; animation-duration: 2s; animation-play-state: paused; }
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
      <div id="motion"></div><div id="native-motion" class="native-motion"></div>
      <div id="fallback"><span>first</span><span>second</span></div>
      <div id="native-fallback" class="native-fallback"><span>first</span><span>second</span></div>
      <script type="module" src="/main.ts"></script></body></html>`);
    await writeFile(join(root, 'main.ts'), `import styles from './Card.gss';
      import fallback from './Fallback.gss'; import motion from './Motion.gss';
      document.getElementById('gss')!.className = styles.card.self;
      document.getElementById('fallback')!.className = fallback.fallback.self;
      document.getElementById('motion')!.className = motion.motion.self;`);
    await writeFile(join(root, 'Fallback.gss'),
      '.fallback { display: flex; flex-direction: column; background-image: url("./icon.svg"); }');
    await writeFile(join(root, 'Motion.gss'), `
      @keyframes pulse { from { opacity: 0; } to { opacity: 1; } }
      .motion { color: red; background-image: url("./icon.svg"); display: flex;
        animation-name: pulse; animation-duration: 2s; animation-play-state: paused; }
    `);
    await writeFile(join(root, 'Card.gss'), `
      @property --tone { syntax: "<color>"; inherits: false; initial-value: red; }
      .card { color: var(--tone); background-image: url("./icon.svg"); display: flex; }
    `);
    await build({ root, configFile: false, plugins: [gss({ adapter: react() })], logLevel: 'silent',
      build: { minify: true, cssTarget: 'safari6' } });
    const manifest = JSON.parse(await readFile(join(root, 'dist/gss-manifest.json'), 'utf8'));
    const cssFile = join(root, 'dist', manifest.cssAsset);
    const css = await readFile(cssFile, 'utf8');
    if (manifest.version !== 2 || !manifest.compiler.rules?.length || manifest.compiler.rules.some((rule) =>
      !rule.origins?.length || rule.origins.some((origin) => origin.range.end <= origin.range.start)) ||
      manifest.compiler.preservedRules?.[0]?.moduleId !== 'Fallback.gss' ||
      !manifest.compiler.resources?.[0]?.origins?.length ||
      !css.includes('display: -webkit-box;') || !css.includes('@property --tone') ||
      !css.includes('@-webkit-keyframes') || !css.includes('@keyframes') ||
      manifest.compiler.resources.filter((resource) => resource.kind === 'keyframes' &&
        resource.sources?.includes('Motion.gss')).length !== 1 ||
      !css.includes('flex-direction: column;') ||
      !manifest.compiler.moduleDetails.some((entry) => entry.id === 'Fallback.gss' &&
        entry.compilationMode === 'preserved' && entry.fallbackReasons.some((reason) =>
          reason.property === 'flex-direction' && reason.reason === 'compatibility-sequence-unatomizable')) ||
      !manifest.compiler.moduleDetails.some((entry) => entry.id === 'Motion.gss' &&
        entry.compilationMode === 'preserved' && entry.fallbackReasons.some((reason) =>
          reason.property === 'animation-name' && reason.reason === 'compatibility-sequence-unatomizable'))) {
      throw new Error(`Host artifact lacks the requested sequence, resource or compatibility fallback: ${JSON.stringify({
        resources: manifest.compiler.resources, keyframes: css.match(/@(?:-webkit-)?keyframes[^{]*/g),
        fallback: manifest.compiler.moduleDetails
      })}`);
    }
    server = await preview({ root, configFile: false, logLevel: 'silent',
      preview: { host: '127.0.0.1', port: 0, strictPort: false } });
    const address = server.httpServer.address();
    if (!address || typeof address === 'string') throw new Error('No Vite preview address.');
    const url = `http://127.0.0.1:${address.port}/`;
    const mapReference = /sourceMappingURL=([^\s*]+)/.exec(css)?.[1];
    if (!mapReference) throw new Error('Host CSS did not link a source map.');
    const mapUrl = new URL(mapReference, new URL(manifest.cssAsset, url));
    const mapResponse = await fetch(mapUrl);
    if (!mapResponse.ok) throw new Error(`Linked host source map returned ${mapResponse.status}.`);
    const sourceMap = await mapResponse.json();
    const authoredSources = new Map(sourceMap.sources?.map((id, index) => [id, sourceMap.sourcesContent?.[index]]));
    if (mapUrl.pathname !== '/gss.css.map' || sourceMap.file !== manifest.cssAsset ||
      JSON.stringify(sourceMap.sources?.slice().sort()) !== JSON.stringify(['Card.gss', 'Fallback.gss', 'Motion.gss']) ||
      !authoredSources.get('Card.gss')?.includes('@property --tone') ||
      !authoredSources.get('Fallback.gss')?.includes('flex-direction: column') ||
      !authoredSources.get('Motion.gss')?.includes('@keyframes pulse')) {
      throw new Error('Linked host source map lost its logical sources or authored source content.');
    }
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
          const animations = document.getElementById(id).getAnimations().map((animation) => ({
            playState: animation.playState,
            frames: animation.effect?.getKeyframes().map(({ offset, opacity }) => [offset, opacity])
          }));
          return { color: style.color, display: style.display, flexDirection: style.flexDirection,
            size: `${image.naturalWidth}x${image.naturalHeight}`, imageUrl,
            animationName: style.animationName, animationDuration: style.animationDuration, animations };
        }
        return { gss: await sample('gss'), native: await sample('native'),
          motion: await sample('motion'), nativeMotion: await sample('native-motion'),
          fallback: await sample('fallback'), nativeFallback: await sample('native-fallback'),
          linked: [...document.querySelectorAll('link[rel="stylesheet"]')].some((link) => link.href.includes('gss-')) };
      });
      return { readings, pageErrors };
    }
    const baseline = await readPage();
    const expected = (entry) => entry.color === 'rgb(255, 0, 0)' && entry.display === 'flex' && entry.size === '3x2';
    const expectedFallback = (entry) => entry.color === 'rgb(0, 0, 0)' && entry.display === 'flex' &&
      entry.flexDirection === 'column' && entry.size === '3x2';
    const expectedAnimation = (entry) => entry.animationDuration === '2s' &&
      entry.animations.length === 1 && entry.animations[0].playState === 'paused' &&
      JSON.stringify(entry.animations[0].frames) === JSON.stringify([[0, '0'], [1, '1']]);
    if (!baseline.readings.linked || !expected(baseline.readings.gss) || !expected(baseline.readings.native) ||
      !expected(baseline.readings.motion) || !expected(baseline.readings.nativeMotion) ||
      !expectedAnimation(baseline.readings.motion) || !expectedAnimation(baseline.readings.nativeMotion) ||
      baseline.readings.motion.animationName === baseline.readings.nativeMotion.animationName ||
      !expectedFallback(baseline.readings.fallback) || !expectedFallback(baseline.readings.nativeFallback) ||
      baseline.pageErrors.length || !baseline.readings.gss.imageUrl.includes('/assets/') ||
      !baseline.readings.motion.imageUrl.includes('/assets/') ||
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
      expectedAnimation(control.readings.motion) && expectedAnimation(control.readings.nativeMotion) &&
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
      expectedAnimation(fallbackControl.readings.motion) && expectedAnimation(fallbackControl.readings.nativeMotion) &&
      fallbackControl.pageErrors.length === 0;

    const keyframesName = manifest.compiler.resources.find((resource) => resource.kind === 'keyframes')?.name;
    const changed = postcss.parse(css);
    let removed = 0;
    changed.walkAtRules(/^(?:-webkit-)?keyframes$/, (rule) => {
      if (rule.params !== keyframesName) return;
      rule.remove();
      removed++;
    });
    if (removed !== 2) throw new Error(`Keyframe control expected one prefixed resource pair, found ${removed}.`);
    await writeFile(cssFile, changed.toString());
    const keyframeControl = await readPage();
    const keyframesDetected = keyframeControl.readings.motion.animations.length === 0 &&
      keyframeControl.readings.motion.animationName === baseline.readings.motion.animationName &&
      expectedAnimation(keyframeControl.readings.nativeMotion) &&
      expected(keyframeControl.readings.motion) && expected(keyframeControl.readings.nativeMotion) &&
      expected(keyframeControl.readings.gss) && expected(keyframeControl.readings.native) &&
      expectedFallback(keyframeControl.readings.fallback) && expectedFallback(keyframeControl.readings.nativeFallback) &&
      keyframeControl.pageErrors.length === 0;
    return { detected: resourceDetected && fallbackDetected && keyframesDetected,
      resourceDetected, fallbackDetected, keyframesDetected,
      sourceMapLinked: true, baseline: baseline.readings, control: control.readings,
      fallbackControl: fallbackControl.readings, keyframeControl: keyframeControl.readings,
      pageErrors: [...baseline.pageErrors, ...control.pageErrors, ...fallbackControl.pageErrors,
        ...keyframeControl.pageErrors] };
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

/** A Vite-managed SSG HTML document, real React SSR render, client hydration and CSS link. */
export async function checkViteSsgHydration(browser) {
  const root = normalizePath(await realpath(await mkdtemp(join(tmpdir(), 'gss-ssg-browser-'))));
  let devServer;
  let previewServer;
  const contexts = [];
  try {
    await symlink(join(process.cwd(), 'node_modules'), join(root, 'node_modules'), 'dir');
    await writeFile(join(root, 'Card.gss'), '.card { color: red; }');
    await writeFile(join(root, 'index.html'), '<!doctype html><html><head></head><body><div id="app"><!--ssg--></div><script type="module" src="/main.tsx"></script></body></html>');
    await writeFile(join(root, 'App.tsx'), `import React, { useEffect } from 'react'; import styles from './Card.gss';
      export function App() {
        useEffect(() => {
          (window as any).__GSS_CLIENT_CLASS__ = styles.card.self;
          (window as any).__GSS_HYDRATED__ = true;
        }, []);
        return <div className={styles.card.self + ' external'}>Hello</div>;
      }`);
    await writeFile(join(root, 'entry-server.tsx'), `export { App } from './App';`);
    await writeFile(join(root, 'main.tsx'), `import React from 'react'; import { hydrateRoot } from 'react-dom/client';
      import { App } from './App';
      (window as any).__GSS_HYDRATION_ERRORS__ = [];
      hydrateRoot(document.getElementById('app')!, <App />, {
        onRecoverableError(error) { (window as any).__GSS_HYDRATION_ERRORS__.push(String(error)); }
      });`);
    devServer = await createServer({ root, configFile: false, plugins: [gss({ adapter: react() })],
      logLevel: 'silent', server: { middlewareMode: true } });
    const { App } = await devServer.ssrLoadModule('/entry-server.tsx');
    const rendered = renderToString(createElement(App));
    await devServer.close();
    devServer = undefined;
    await build({ root, configFile: false, plugins: [gss({ adapter: react() })], logLevel: 'silent',
      build: { minify: false } });
    const manifest = JSON.parse(await readFile(join(root, 'dist/gss-manifest.json'), 'utf8'));
    const css = await readFile(join(root, 'dist', manifest.cssAsset), 'utf8');
    const htmlFile = join(root, 'dist/index.html');
    const builtHtml = await readFile(htmlFile, 'utf8');
    if (!builtHtml.includes('<!--ssg-->')) throw new Error('Vite removed the SSG insertion point.');
    const html = builtHtml.replace('<!--ssg-->', rendered).replace('</body>',
      '<script>window.__GSS_SERVER_CLASS__ = document.querySelector("#app > div").className;</script></body>');
    const ownedClass = /class="([^"]+) external"/.exec(rendered)?.[1];
    if (!ownedClass || !css.includes(`.${ownedClass} {`) ||
      !html.includes(`href="/${manifest.cssAsset}"`)) {
      throw new Error('SSG markup and Vite CSS asset do not agree on the owned class/link.');
    }
    await writeFile(htmlFile, html);
    previewServer = await preview({ root, configFile: false, logLevel: 'silent',
      preview: { host: '127.0.0.1', port: 0, strictPort: false } });
    const address = previewServer.httpServer.address();
    if (!address || typeof address === 'string') throw new Error('No SSG preview address.');
    const url = `http://127.0.0.1:${address.port}/`;
    async function readPage() {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(String(error)));
      page.on('console', (message) => { if (message.type() === 'error') pageErrors.push(message.text()); });
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__GSS_HYDRATED__ === true);
      const state = await page.evaluate(() => ({
        className: document.querySelector('#app > div')?.className,
        serverClass: window.__GSS_SERVER_CLASS__, clientClass: window.__GSS_CLIENT_CLASS__,
        text: document.querySelector('#app > div')?.textContent,
        color: getComputedStyle(document.querySelector('#app > div')).color,
        links: [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.getAttribute('href')),
        recoverable: window.__GSS_HYDRATION_ERRORS__
      }));
      return { state, pageErrors };
    }
    const baseline = await readPage();
    if (baseline.state.className !== `${ownedClass} external` || baseline.state.serverClass !== `${ownedClass} external` ||
      baseline.state.clientClass !== ownedClass ||
      baseline.state.text !== 'Hello' ||
      baseline.state.color !== 'rgb(255, 0, 0)' ||
      JSON.stringify(baseline.state.links) !== JSON.stringify([`/${manifest.cssAsset}`]) ||
      baseline.state.recoverable.length || baseline.pageErrors.length) {
      throw new Error(`SSG/hydration baseline differs: ${JSON.stringify(baseline)}`);
    }
    const corrupt = html.replace('>Hello</div>', '>Corrupt</div>');
    if (corrupt === html) throw new Error('Hydration control did not alter server markup.');
    await writeFile(htmlFile, corrupt);
    const control = await readPage();
    const badClass = 'gss-deliberately-wrong';
    const classCorrupt = html.replace(`class="${ownedClass} external"`, `class="${badClass} external"`);
    if (classCorrupt === html) throw new Error('Class control did not alter server markup.');
    await writeFile(htmlFile, classCorrupt);
    const classControl = await readPage();
    const textDetected = control.state.recoverable.length > 0 && control.state.text === 'Hello' &&
      control.state.color === 'rgb(255, 0, 0)';
    const classDetected = classControl.state.serverClass === `${badClass} external` &&
      classControl.state.clientClass === ownedClass &&
      classControl.state.serverClass !== `${classControl.state.clientClass} external`;
    return { detected: textDetected && classDetected, textDetected, classDetected,
      baseline, control, classControl, pageErrors: baseline.pageErrors,
      controlPageErrors: [...control.pageErrors, ...classControl.pageErrors] };
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    await previewServer?.close();
    await devServer?.close();
    await rm(root, { recursive: true, force: true });
  }
}
