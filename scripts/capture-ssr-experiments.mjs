import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { parseRegistry, rendererParams, rendererUrl } from '../submodules/fidelity-kit/packages/cli/dist/registry.js';
import { selectNames } from '../submodules/fidelity-kit/packages/cli/dist/select.js';
import { execFileSync } from 'node:child_process';
const require = createRequire(new URL('../submodules/fidelity-kit/packages/cli/package.json', import.meta.url));
const puppeteer = require('puppeteer');
const sharp = require('sharp');
const sourceCommit = (
  process.platform === 'win32'
    ? execFileSync('cmd.exe', ['/d', '/s', '/c', 'git-dedup.cmd rev-parse HEAD'], { encoding: 'utf8' })
    : execFileSync('git-dedup', ['rev-parse', 'HEAD'], { encoding: 'utf8' })
).trim();
const { values } = parseArgs({
  options: {
    registry: { type: 'string', default: 'registry.json' },
    out: { type: 'string', default: 'fidelity-results' },
    'root-url': { type: 'string' },
    'executable-path': { type: 'string' },
    renderers: { type: 'string' },
    scenes: { type: 'string', default: '*' },
    'missing-only': { type: 'boolean', default: false },
  },
});
const suite = parseRegistry(JSON.parse(await readFile(values.registry, 'utf8')));
const scenes = selectNames(
  suite.scenes.map((s) => s.id),
  values.scenes,
  'scene',
);
const renderers = selectNames(
  suite.renderers.filter((r) => !r.reference || values.renderers !== undefined).map((r) => r.id),
  values.renderers ?? '*',
  'renderer',
);
const artifactRoot = resolve(process.env.SWARM_ARTIFACTS ?? 'capture-artifacts');
await mkdir(artifactRoot, { recursive: true });
const manifestFile = join(artifactRoot, 'ssr-experiment-captures.json');
const rows = existsSync(manifestFile) ? JSON.parse(await readFile(manifestFile, 'utf8')) : [];
const browser = await puppeteer.launch({
  executablePath: values['executable-path'],
  headless: true,
  args: [
    '--disable-software-rasterizer',
    '--enable-unsafe-webgpu',
    '--enable-webgpu-developer-features',
    '--disable-gpu-vsync',
    '--disable-frame-rate-limit',
    ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []),
  ],
  protocolTimeout: 300000,
});
const browserVersion = await browser.version();
try {
  captures: for (const scene of suite.scenes.filter((s) => scenes.includes(s.id)))
    for (const renderer of suite.renderers.filter((r) => renderers.includes(r.id))) {
      const file = resolve(values.out, scene.id, 'beauty', `${renderer.id}.avif`);
      if (values['missing-only'] && existsSync(file)) continue;
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error' && /shader|wgsl|validation|compil|uncaught/i.test(message.text()))
          errors.push(message.text());
      });
      try {
        await page.evaluateOnNewDocument(() => {
          window.__ssrHardware = [];
          const gpu = navigator.gpu;
          if (!gpu) throw new Error('Hardware WebGPU unavailable');
          const request = gpu.requestAdapter.bind(gpu);
          gpu.requestAdapter = async (...args) => {
            const adapter = await request(...args);
            const info = adapter?.info;
            const identity = {
              vendor: info?.vendor,
              architecture: info?.architecture,
              description: info?.description,
              fallback: adapter?.isFallbackAdapter ?? info?.isFallbackAdapter ?? false,
            };
            if (
              !info?.vendor ||
              identity.fallback ||
              /swiftshader|llvmpipe|lavapipe|software|basic render|\bwarp\b/i.test(JSON.stringify(identity))
            )
              throw new Error('Physical WebGPU required');
            window.__ssrHardware.push(identity);
            return adapter;
          };
        });
        const params = {
          seed: 1,
          ...rendererParams(suite, renderer.id, scene.id),
          width: scene.fidelity.width,
          height: scene.fidelity.height,
          frames: 64,
        };
        await page.setViewport({ width: params.width, height: params.height, deviceScaleFactor: 1 });
        const url = new URL(rendererUrl(suite, renderer.id, values['root-url']));
        url.searchParams.set('fidelityKitMode', 'capture');
        url.searchParams.set('fidelityKitParams', JSON.stringify(params));
        console.log(`${scene.id} / ${renderer.id}`);
        await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => window.__fidelityKitCapture || window.__fidelityKitError, { timeout: 300000 });
        const status = await page.evaluate(() => ({
          capture: window.__fidelityKitCapture,
          error: window.__fidelityKitError,
          adapters: window.__ssrHardware,
        }));
        if (status.error || errors.length || !status.adapters.length)
          throw new Error(JSON.stringify({ ...status, errors }));
        const canvas = await page.$('canvas');
        if (!canvas) throw new Error('Missing capture canvas');
        const png = await canvas.screenshot({ type: 'png' });
        if (renderer.id.startsWith('three-hiz-')) {
          const lossless = join(artifactRoot, 'hiz-captures', scene.id, `${renderer.id}.png`);
          await mkdir(dirname(lossless), { recursive: true });
          await writeFile(lossless, png);
        }
        const stats = await sharp(png).stats();
        if (!stats.channels.slice(0, 3).some((channel) => channel.stdev > 5)) throw new Error('Flat capture');
        await mkdir(dirname(file), { recursive: true });
        await sharp(png).avif({ quality: 90, chromaSubsampling: '4:4:4' }).toFile(file);
        const previous = rows.findIndex((row) => row.scene === scene.id && row.renderer === renderer.id);
        if (previous >= 0) rows.splice(previous, 1);
        rows.push({
          sourceCommit,
          browserVersion,
          scene: scene.id,
          renderer: renderer.id,
          frames: 64,
          seed: 1,
          width: params.width,
          height: params.height,
          adapters: status.adapters,
          errors,
          capturedAt: new Date().toISOString(),
        });
        await writeFile(manifestFile, JSON.stringify(rows, null, 2) + '\n');
      } finally {
        await page.close();
      }
      if (process.env.SWARM_COMMENTS && existsSync(process.env.SWARM_COMMENTS)) {
        const inbox = JSON.parse(await readFile(process.env.SWARM_COMMENTS, 'utf8'));
        if (inbox.comments?.length) {
          console.log('Pending swarm comment; stopping after completed capture.');
          process.exitCode = 75;
          break captures;
        }
      }
    }
} finally {
  await browser.close();
}
