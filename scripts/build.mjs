import { build, context } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const WATCH = args.includes('--watch');
const ZIP = args.includes('--zip');

const ENTRIES = [
  ['src/background/sw.js', 'background.js'],
  ['src/content/main.js', 'content.js'],
  ['src/content/youtube/injector-page.js', 'injector-page.js'],
  ['src/popup/popup.js', 'popup.js'],
  ['src/options/options.js', 'options.js'],
];

const TARGETS = {
  chrome: (m) => ({ ...m, background: { service_worker: 'background.js' } }),
  firefox: (m) => ({
    ...m,
    background: { scripts: ['background.js'] },
    browser_specific_settings: {
      gecko: { id: 'transflow@local.dev', strict_min_version: '109.0' },
    },
  }),
};

const STATIC = [
  ['src/popup/popup.html', 'popup.html'],
  ['src/popup/popup.css', 'popup.css'],
  ['src/options/options.html', 'options.html'],
  ['src/options/options.css', 'options.css'],
  ['icons/icon16.png', 'icons/icon16.png'],
  ['icons/icon48.png', 'icons/icon48.png'],
  ['icons/icon128.png', 'icons/icon128.png'],
  ['_locales', '_locales'],
];

async function bundleAll(outdir) {
  for (const [src, out] of ENTRIES) {
    await build({
      entryPoints: [path.join(root, src)],
      bundle: true,
      format: 'iife',
      target: ['chrome110', 'firefox115'],
      loader: { '.css': 'text' },
      outfile: path.join(outdir, out),
      logLevel: 'silent',
    });
  }
}

async function buildTarget(name) {
  const outdir = path.join(root, 'dist', name);
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });
  await bundleAll(outdir);
  for (const [src, dst] of STATIC) {
    const full = path.join(outdir, dst);
    await mkdir(path.dirname(full), { recursive: true });
    await cp(path.join(root, src), full, { recursive: true });
  }
  const base = JSON.parse(await readFile(path.join(root, 'manifests/base.json'), 'utf8'));
  const manifest = TARGETS[name](base);
  await writeFile(path.join(outdir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`built dist/${name}`);
}

async function zipTarget(name) {
  const outdir = path.join(root, 'dist', name);
  execSync(`cd "${outdir}" && zip -qr "../transflow-${name}.zip" .`, { stdio: 'inherit' });
  console.log(`zipped dist/transflow-${name}.zip`);
}

async function all() {
  for (const name of Object.keys(TARGETS)) {
    await buildTarget(name);
    if (ZIP) await zipTarget(name);
  }
}

if (WATCH) {
  // 开发模式：单 target 增量构建 + 静态拷贝一次
  const outdir = path.join(root, 'dist', 'chrome');
  await buildTarget('chrome');
  const ctxs = await Promise.all(
    ENTRIES.map(([src, out]) =>
      context({
        entryPoints: [path.join(root, src)],
        bundle: true,
        format: 'iife',
        target: ['chrome110', 'firefox115'],
        loader: { '.css': 'text' },
        outfile: path.join(outdir, out),
      }),
    ),
  );
  for (const ctx of ctxs) await ctx.watch();
  console.log('watching… (dist/chrome)');
} else {
  await all();
}
