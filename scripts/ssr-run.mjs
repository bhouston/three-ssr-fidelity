import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { spawn } from 'node:child_process';

const mode = process.argv[2];
if (!['render', 'benchmark', 'experiments'].includes(mode))
  throw new Error('Expected render, benchmark or experiments');
const extra = process.argv.slice(3);
if (extra.some((arg) => /allow-software|swiftshader|llvmpipe|lavapipe/i.test(arg)))
  throw new Error('Software rendering is not supported');
const root = resolve('render-site');
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
};
const server = createServer(async (request, response) => {
  try {
    let file = resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (file !== root && !file.startsWith(root + sep)) throw new Error('Invalid path');
    if ((await stat(file)).isDirectory()) file = resolve(file, 'performance.html');
    response.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
    response.end(await readFile(file));
  } catch {
    response.statusCode = 404;
    response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const args = [
  resolve(
    mode === 'experiments' ? 'scripts/capture-ssr-experiments.mjs' : 'submodules/fidelity-kit/packages/cli/dist/bin.js',
  ),
  ...(mode === 'experiments' ? [] : [mode]),
  '--registry',
  'registry.json',
  '--root-url',
  `http://127.0.0.1:${server.address().port}/`,
  '--out',
  mode === 'benchmark' ? 'performance-results' : 'fidelity-results',
];
if (mode === 'benchmark') args.push('--collection', 'default', '--new-run', '--vsync', 'off');
if (process.env.CHROME_EXECUTABLE) args.push('--executable-path', process.env.CHROME_EXECUTABLE);
args.push(...extra);
try {
  const child = spawn(process.execPath, args, { stdio: 'inherit' });
  process.exitCode = await new Promise((done, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => done(code ?? 1));
  });
} finally {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
}
