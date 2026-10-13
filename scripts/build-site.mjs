import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { copyFile } from 'node:fs/promises';
const args = process.argv.slice(2);
let out = 'site/';
const rest = [];
for (let index = 0; index < args.length; index++) {
  const argument = args[index];
  if (argument === '--out') {
    out = args[++index];
    if (!out || out.startsWith('--')) throw new Error('--out requires a directory');
  } else if (argument.startsWith('--out=')) {
    out = argument.slice(6);
    if (!out) throw new Error('--out requires a directory');
  } else rest.push(argument);
}
const result = spawnSync(
  process.execPath,
  [
    resolve('submodules/fidelity-kit/packages/cli/dist/bin.js'),
    'build',
    'fidelity-results',
    '--performance-root',
    'performance-results',
    '--registry',
    'registry.json',
    '--out',
    out,
    ...rest,
  ],
  { stdio: 'inherit' },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
await copyFile('CNAME', join(out, 'CNAME'));
