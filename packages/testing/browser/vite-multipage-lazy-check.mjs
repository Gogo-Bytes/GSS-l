/* global document, getComputedStyle, window, process, fetch, URL */

import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, createServer, normalizePath, preview } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import postcss from 'postcss';
import { gss } from '@gss-l/vite';
import { react } from '@gss-l/react';

/** TS and hydrated React Vite-managed HTML entries share one CSS asset before lazy GSS consumers execute. */
export async function checkViteMultipageLazy(browser) {
  const root = normalizePath(await realpath(await mkdtemp(join(tmpdir(), 'gss-multipage-lazy-'))));
  let server;
  const contexts = [];
  try {
    await symlink(join(process.cwd(), 'node_modules'), join(root, 'node_modules'), 'dir');
    const html = (entry, nativeColor, reactEntry = false) => `<!doctype html><html><head><style>
      .native-main { color: ${nativeColor}; }
      .native-lazy { background-color: green; }
    </style></head><body>
      ${reactEntry ? '<div id="app"></div>' : '<div id="main"></div><div id="lazy"></div><button id="load">Load lazy route</button>'}
      <div id="native-main" class="native-main"></div><div id="native-lazy" class="native-lazy"></div>
      <script type="module" src="/${entry}"></script>
    </body></html>`;
    await writeFile(join(root, 'index.html'), html('first.ts', 'red'));
    await writeFile(join(root, 'second.html'), html('second.tsx', 'blue', true));
    const entry = (name) => `import styles from './${name}.gss';
      document.getElementById('main')!.className = styles.main.self;
      document.getElementById('load')!.addEventListener('click', async () => {
        const { mount } = await import('./lazy.ts'); mount();
      });
      (window as any).__READY__ = true;`;
    await writeFile(join(root, 'first.ts'), entry('First'));
    await writeFile(join(root, 'App.tsx'), `import React, { Suspense, useEffect, useState } from 'react';
      import styles from './Second.gss';
      const Lazy = React.lazy(() => import('./LazyComponent'));
      export function App() {
        const [show, setShow] = useState(false);
        useEffect(() => {
          (window as any).__CLIENT_MAIN_CLASS__ = styles.main.self + ' external';
          (window as any).__READY__ = true;
        }, []);
        return <><div id="main" className={styles.main.self + ' external'}>React main</div>
          {show ? <Suspense fallback={<div id="lazy" />}><Lazy /></Suspense> : <div id="lazy" />}
          <button id="load" onClick={() => setShow(true)}>Load React lazy route</button></>;
      }`);
    await writeFile(join(root, 'second.tsx'), `import React from 'react'; import { hydrateRoot } from 'react-dom/client';
      import { App } from './App';
      (window as any).__HYDRATION_ERRORS__ = [];
      hydrateRoot(document.getElementById('app')!, <App />, {
        onRecoverableError(error) { (window as any).__HYDRATION_ERRORS__.push(String(error)); }
      });`);
    await writeFile(join(root, 'LazyComponent.tsx'), `import React, { useEffect } from 'react';
      import styles from './Lazy.gss';
      (window as any).__LAZY_EXECUTED__ = true;
      export default function LazyComponent() {
        useEffect(() => { (window as any).__LAZY_MOUNTED__ = true; }, []);
        return <div id="lazy" className={styles.lazy.self + ' external'}>React lazy</div>;
      }`);
    await writeFile(join(root, 'lazy.ts'), `import styles from './Lazy.gss';
      (window as any).__LAZY_EXECUTED__ = true;
      export function mount() {
        document.getElementById('lazy')!.className = styles.lazy.self;
        (window as any).__LAZY_MOUNTED__ = true;
      }`);
    await writeFile(join(root, 'First.gss'), '.main { color: red; }');
    await writeFile(join(root, 'Second.gss'), '.main { color: blue; }');
    await writeFile(join(root, 'Lazy.gss'), '.lazy { background-color: green; }');
    const ssrServer = await createServer({ root, configFile: false, plugins: [gss({ adapter: react() })],
      logLevel: 'silent', server: { middlewareMode: true } });
    let rendered;
    try {
      const { App } = await ssrServer.ssrLoadModule('/App.tsx');
      rendered = renderToString(createElement(App));
    } finally {
      await ssrServer.close();
    }
    await build({ root, configFile: false, plugins: [gss({ adapter: react() })], logLevel: 'silent',
      build: { minify: false, rollupOptions: { input: {
        first: join(root, 'index.html'), second: join(root, 'second.html')
      } } } });
    const secondHtmlFile = join(root, 'dist/second.html');
    const builtSecondHtml = await readFile(secondHtmlFile, 'utf8');
    const serverMainClass = /id="main" class="([^"]+)"/.exec(rendered)?.[1];
    if (!serverMainClass || !rendered.includes('React main') || !builtSecondHtml.includes('<div id="app"></div>')) {
      throw new Error('Multipage React SSG markup cannot be linked to the built HTML.');
    }
    const hydratedSecondHtml = builtSecondHtml.replace('<div id="app"></div>', `<div id="app">${rendered}</div>`);
    await writeFile(secondHtmlFile, hydratedSecondHtml);
    const manifest = JSON.parse(await readFile(join(root, 'dist/gss-manifest.json'), 'utf8'));
    const cssFile = join(root, 'dist', manifest.cssAsset);
    const css = await readFile(cssFile, 'utf8');
    const lazyRules = manifest.compiler.rules.filter((rule) => rule.property === 'background-color' &&
      rule.sources?.includes('Lazy.gss'));
    if (manifest.version !== 2 || JSON.stringify(manifest.compiler.modules) !==
        JSON.stringify(['First.gss', 'Lazy.gss', 'Second.gss']) || lazyRules.length !== 1 ||
      !css.includes(lazyRules[0].selector) || !/sourceMappingURL=([^\s*]+)/.test(css)) {
      throw new Error('Multipage artifact lacks one shared lazy GSS contribution or linked map.');
    }
    const map = JSON.parse(await readFile(join(root, 'dist/gss.css.map'), 'utf8'));
    if (map.file !== manifest.cssAsset || JSON.stringify(map.sources.slice().sort()) !==
      JSON.stringify(['First.gss', 'Lazy.gss', 'Second.gss'])) {
      throw new Error('Multipage CSS map lost a logical Module source.');
    }
    server = await preview({ root, configFile: false, logLevel: 'silent',
      preview: { host: '127.0.0.1', port: 0, strictPort: false } });
    const address = server.httpServer.address();
    if (!address || typeof address === 'string') throw new Error('No Vite preview address.');
    const origin = `http://127.0.0.1:${address.port}`;
    const mapReference = /sourceMappingURL=([^\s*]+)/.exec(css)?.[1];
    const mapUrl = new URL(mapReference, `${origin}/${manifest.cssAsset}`);
    const mapResponse = await fetch(mapUrl);
    if (mapUrl.pathname !== '/gss.css.map' || !mapResponse.ok ||
      JSON.stringify(await mapResponse.json()) !== JSON.stringify(map)) {
      throw new Error('Multipage CSS source-map URL does not resolve to the emitted map.');
    }
    async function readRoute(route) {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      await page.goto(`${origin}${route}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__READY__ === true);
      const sample = () => page.evaluate(() => {
        const main = document.getElementById('main');
        const lazy = document.getElementById('lazy');
        const links = [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.href);
        return { main: getComputedStyle(main).color, nativeMain: getComputedStyle(document.getElementById('native-main')).color,
          lazy: getComputedStyle(lazy).backgroundColor,
          nativeLazy: getComputedStyle(document.getElementById('native-lazy')).backgroundColor,
          mainClass: main.className, clientMainClass: window.__CLIENT_MAIN_CLASS__ ?? null,
          mainText: main.textContent, lazyClass: lazy.className,
          links, styles: document.querySelectorAll('style').length,
          lazyExecuted: window.__LAZY_EXECUTED__ === true,
          hydrationErrors: window.__HYDRATION_ERRORS__ ?? [] };
      });
      const before = await sample();
      await page.locator('#load').click();
      await page.waitForFunction(() => window.__LAZY_MOUNTED__ === true);
      const after = await sample();
      return { before, after, errors };
    }
    const routes = ['/', '/second.html'];
    const baseline = await Promise.all(routes.map(readRoute));
    const stylesheet = `${origin}/${manifest.cssAsset}`;
    const expectedMain = ['rgb(255, 0, 0)', 'rgb(0, 0, 255)'];
    const baselineDetected = baseline.every(({ before, after, errors }, index) =>
      errors.length === 0 && before.main === expectedMain[index] && before.nativeMain === expectedMain[index] &&
      before.lazy === 'rgba(0, 0, 0, 0)' && before.nativeLazy === 'rgb(0, 128, 0)' &&
      before.mainClass.length > 0 && before.mainClass.endsWith(' external') === (index === 1) &&
      (index !== 1 || before.mainClass === serverMainClass) &&
      before.clientMainClass === (index === 1 ? serverMainClass : null) &&
      before.mainText === (index === 1 ? 'React main' : '') &&
      before.lazyClass === '' && !before.lazyExecuted && before.hydrationErrors.length === 0 &&
      after.hydrationErrors.length === 0 && after.main === expectedMain[index] && after.nativeMain === expectedMain[index] &&
      after.lazy === 'rgb(0, 128, 0)' && after.nativeLazy === 'rgb(0, 128, 0)' &&
      after.mainClass === before.mainClass && after.mainText === before.mainText &&
      after.clientMainClass === before.clientMainClass && after.lazyClass.length > 0 &&
      after.lazyClass.endsWith(' external') === (index === 1) && after.lazyExecuted &&
      JSON.stringify(before.links) === JSON.stringify([stylesheet]) &&
      JSON.stringify(after.links) === JSON.stringify([stylesheet]) && before.styles === 1 && after.styles === 1);
    const corruptedSecondHtml = hydratedSecondHtml.replace('>React main</div>', '>Wrong main</div>');
    if (corruptedSecondHtml === hydratedSecondHtml) throw new Error('SSG text corruption did not change server markup.');
    await writeFile(secondHtmlFile, corruptedSecondHtml);
    const hydrationControl = await readRoute('/second.html');
    await writeFile(secondHtmlFile, hydratedSecondHtml);
    const hydrationControlDetected = hydrationControl.errors.length === 0 &&
      hydrationControl.after.hydrationErrors.length > 0 &&
      hydrationControl.before.mainText === 'React main' && hydrationControl.after.mainText === 'React main' &&
      hydrationControl.before.mainClass === serverMainClass &&
      hydrationControl.after.clientMainClass === serverMainClass &&
      hydrationControl.before.nativeMain === 'rgb(0, 0, 255)' &&
      hydrationControl.after.nativeMain === 'rgb(0, 0, 255)' &&
      hydrationControl.before.nativeLazy === 'rgb(0, 128, 0)' &&
      hydrationControl.after.nativeLazy === 'rgb(0, 128, 0)' &&
      hydrationControl.after.main === 'rgb(0, 0, 255)' &&
      hydrationControl.after.lazy === 'rgb(0, 128, 0)';
    const parsed = postcss.parse(css);
    const matches = [];
    parsed.walkRules((rule) => {
      if (rule.selector === lazyRules[0].selector) matches.push(rule);
    });
    if (matches.length !== 1 || matches[0].nodes.length !== 1 || matches[0].nodes[0].prop !== 'background-color') {
      throw new Error('Lazy corruption requires exactly one generated background rule.');
    }
    matches[0].remove();
    await writeFile(cssFile, parsed.toString());
    const control = await Promise.all(routes.map(readRoute));
    const controlDetected = control.every(({ before, after, errors }, index) =>
      errors.length === 0 && before.main === expectedMain[index] && before.nativeMain === expectedMain[index] &&
      before.lazy === 'rgba(0, 0, 0, 0)' && before.nativeLazy === 'rgb(0, 128, 0)' &&
      before.mainClass.endsWith(' external') === (index === 1) &&
      before.clientMainClass === (index === 1 ? serverMainClass : null) &&
      before.mainText === (index === 1 ? 'React main' : '') &&
      before.hydrationErrors.length === 0 && before.lazyClass === '' && !before.lazyExecuted &&
      after.main === expectedMain[index] && after.nativeMain === expectedMain[index] &&
      after.lazy === 'rgba(0, 0, 0, 0)' && after.nativeLazy === 'rgb(0, 128, 0)' &&
      after.mainClass === before.mainClass && after.clientMainClass === before.clientMainClass &&
      after.mainText === before.mainText && after.hydrationErrors.length === 0 && after.lazyClass.length > 0 &&
      after.lazyClass.endsWith(' external') === (index === 1) && after.lazyExecuted &&
      JSON.stringify(before.links) === JSON.stringify([stylesheet]) &&
      JSON.stringify(after.links) === JSON.stringify([stylesheet]) && before.styles === 1 && after.styles === 1);
    return { detected: baselineDetected && controlDetected && hydrationControlDetected,
      baselineDetected, controlDetected, hydrationControlDetected,
      linkedCss: manifest.cssAsset, baseline, control, hydrationControl };
  } finally {
    try {
      await Promise.all(contexts.map((context) => context.close()));
    } finally {
      try { await server?.close(); } finally { await rm(root, { recursive: true, force: true }); }
    }
  }
}
