import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../packages/playground/package.json', import.meta.url));
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
const cliRequire = createRequire(new URL('../submodules/fidelity-kit/packages/cli/package.json', import.meta.url));
const puppeteer = cliRequire('puppeteer');
const server = await createServer({
  root: resolve('packages/playground'),
  configFile: resolve('packages/playground/vite.config.ts'),
  server: { port: 0, open: false },
});
let browser;
try {
  await server.listen();
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_EXECUTABLE,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-software-rasterizer',
      '--enable-unsafe-webgpu',
      ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []),
    ],
  });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    window.ssrAdapters = [];
    const request = navigator.gpu.requestAdapter.bind(navigator.gpu);
    navigator.gpu.requestAdapter = async (...args) => {
      const adapter = await request(...args),
        info = adapter?.info;
      const identity = {
        vendor: info?.vendor,
        architecture: info?.architecture,
        description: info?.description,
        fallback: adapter?.isFallbackAdapter ?? info?.isFallbackAdapter,
      };
      if (
        !identity.vendor ||
        identity.fallback ||
        /swiftshader|llvmpipe|lavapipe|software|basic render|\bwarp\b/i.test(JSON.stringify(identity))
      )
        throw new Error('Physical GPU required');
      window.ssrAdapters.push(identity);
      return adapter;
    };
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/e2e/ssr-environment.html`);
  await page.waitForFunction(() => window.ssrEnvironmentCheck, { timeout: 180000 });
  const result = await page.evaluate(() => ({ ...window.ssrEnvironmentCheck, adapters: window.ssrAdapters }));
  const artifact = process.env.SWARM_ARTIFACTS;
  if (artifact) {
    await mkdir(artifact, { recursive: true });
    await writeFile(resolve(artifact, 'ssr-environment-orientation.json'), JSON.stringify(result, null, 2) + '\n');
  }
  assert.equal(result.passed, true, JSON.stringify(result));
  assert.ok(result.adapters.length);
  console.log(JSON.stringify(result));
} finally {
  await browser?.close();
  await server.close();
}
