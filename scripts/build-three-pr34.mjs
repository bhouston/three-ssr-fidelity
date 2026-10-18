import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
// Reuse the installed, pinned build tools without changing the proposal's package or lockfile.
const require = createRequire(new URL('../submodules/three.js/package.json', import.meta.url));
const name = process.argv[2] ?? 'three-pr34';
if (!['three-pr34', 'three-pr72'].includes(name)) throw new Error('Unknown pinned Three.js runtime');
const root = resolve('submodules', name);
await mkdir(join(root, 'build'), { recursive: true });
const temporary = join(root, 'build/.ssr-rollup.config.mjs');
const config = (await readFile(join(root, 'utils/build/rollup.config.js'), 'utf8')).replace(
  "from 'magic-string'",
  `from '${pathToFileURL(require.resolve('magic-string')).href}'`,
);
await writeFile(temporary, config);
try {
  const cli = join(dirname(require.resolve('rollup')), 'bin/rollup');
  const child = spawn(process.execPath, [cli, '--config', temporary], { cwd: root, stdio: 'inherit' });
  process.exitCode = await new Promise((done, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => done(code ?? 1));
  });
} finally {
  await rm(temporary, { force: true });
}
