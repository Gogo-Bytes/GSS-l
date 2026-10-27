import type { ResolvedConfig } from 'vite';
import type { GssCompilerConfig } from '@gss-l/compiler';

type Stages = NonNullable<GssCompilerConfig['compatibilityTargetStages']>;
type Result = { stages?: Stages; error?: string };
const browserNames: Readonly<Record<string, string>> = {
  chrome: 'chrome', edge: 'edge', firefox: 'firefox', safari: 'safari', ios: 'ios_saf', ios_saf: 'ios_saf'
};

/** Follow the effective Vite CSS processing stages, not project Browserslist or JS targets. */
export function resolveViteCssTargets(config: ResolvedConfig): Result {
  const stages: Readonly<Record<string, string>>[] = [];
  const lightningUsed = config.css.transformer === 'lightningcss' ||
    (config.command === 'build' && config.build.cssMinify === 'lightningcss');
  if (lightningUsed && Object.entries(config.css.lightningcss ?? {}).some(([name, value]) =>
    name !== 'targets' && value !== undefined)) {
    return { error: 'Lightning CSS feature overrides cannot be mirrored by the GSS compatibility transformer.' };
  }
  if (config.css.transformer === 'lightningcss') {
    const targets = config.css.lightningcss?.targets;
    if (!targets || Object.keys(targets).length === 0) return { error: 'Lightning CSS transformer has no resolved browser targets.' };
    const browsers: Record<string, string> = {};
    for (const [name, encoded] of Object.entries(targets)) {
      if (!browserNames[name] || !Number.isInteger(encoded) || encoded < 0 || encoded > 0xffffff) {
        return { error: `Unsupported Lightning CSS target ${name}.` };
      }
      browsers[browserNames[name]] = `${encoded >>> 16}.${(encoded >>> 8) & 255}.${encoded & 255}`;
    }
    stages.push(browsers);
  }
  if (config.command === 'build' && config.build.cssMinify !== false) {
    const target = config.build.cssTarget;
    if (target === false) return { error: 'Vite CSS minifier target is disabled.' };
    const values = typeof target === 'string' ? [target] : target;
    if (!values?.length) return { error: 'Vite CSS minifier has no resolved target.' };
    // Vite's CSS target conversion skips esnext and non-browser runtimes.
    const concrete = values.filter((value) => value !== 'esnext' &&
      !/^(?:node|hermes|rhino)\d+(?:\.\d+){0,2}$/.test(value));
    if (concrete.length === 0) return stages.length ? { stages } : {};
    const browsers: Record<string, string> = {};
    for (const value of concrete) {
      const match = /^(chrome|edge|firefox|safari|ios)(\d+(?:\.\d+){0,2})$/.exec(value);
      if (!match) return { error: `Cannot map Vite CSS target ${value} to a browser version.` };
      const name = browserNames[match[1]!]!;
      // Vite's Lightning CSS target converter discards patch versions; esbuild receives the authored target.
      const version = config.build.cssMinify === 'lightningcss'
        ? `${match[2]!.split('.')[0]}.${match[2]!.split('.')[1] ?? '0'}.0`
        : match[2]!;
      const previous = browsers[name];
      const encoded = (value: string) => {
        const [major = 0, minor = 0, patch = 0] = value.split('.').map(Number);
        return major * 65536 + minor * 256 + patch;
      };
      // Vite's target conversion keeps the oldest requested version per browser.
      if (!previous || encoded(version) < encoded(previous)) browsers[name] = version;
    }
    stages.push(browsers);
  }
  return stages.length ? { stages } : {};
}
