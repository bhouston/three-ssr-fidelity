import { cp, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const at = process.argv.indexOf('--out');
const out = resolve(at < 0 ? 'render-site' : process.argv[at + 1]);
await mkdir(out, { recursive: true });
await cp('packages/playground/dist', out, { recursive: true });
// The curated suite has one external model; avoid publishing unrelated upstream assets.
for (const file of ['models/gltf/steampunk_camera.glb', 'jsm/libs/draco', 'jsm/libs/basis']) {
  await mkdir(resolve(out, file, '..'), { recursive: true });
  await cp(join('submodules/three.js/examples', file), join(out, file), { recursive: true });
}
console.log(`SSR browser render server: ${out}`);
