import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const require = createRequire(new URL('../submodules/fidelity-kit/packages/cli/package.json', import.meta.url));
const sharp = require('sharp');
const scenes = ['diag-mirror', 'diag-dielectric-30', 'diag-metal-hit', 'steampunk-camera'];
const renderers = ['three-gpu-pathtracer', 'three-dev', 'three-ssr-full', 'three-ssr-additive-env'];
const labels = [
  'Path tracer · 4096 samples',
  'Dev · stochastic GGX',
  'Full reflection pipeline',
  'Full · environment added again',
];
const width = 480,
  height = 360,
  header = 54,
  labelHeight = 28;
const composites = [];
const text = (value, size = 16) =>
  Buffer.from(
    `<svg width="${width}" height="${header}" xmlns="http://www.w3.org/2000/svg"><text x="12" y="25" fill="white" font-family="Arial" font-size="${size}">${value}</text></svg>`,
  );
for (let column = 0; column < renderers.length; column++)
  composites.push({ input: text(labels[column]), left: column * width, top: 0 });
for (let row = 0; row < scenes.length; row++)
  for (let column = 0; column < renderers.length; column++) {
    composites.push({ input: text(scenes[row], 14), left: column * width, top: header + row * (height + labelHeight) });
    composites.push({
      input: await sharp(`fidelity-results/${scenes[row]}/beauty/${renderers[column]}.avif`)
        .resize(width, height)
        .png()
        .toBuffer(),
      left: column * width,
      top: header + row * (height + labelHeight) + labelHeight,
    });
  }
const out = resolve(process.env.SWARM_ARTIFACTS ?? 'capture-artifacts');
await mkdir(out, { recursive: true });
await sharp({
  create: {
    width: width * renderers.length,
    height: header + scenes.length * (height + labelHeight),
    channels: 4,
    background: '#111111',
  },
})
  .composite(composites)
  .png()
  .toFile(resolve(out, 'ssr-experiment-comparison.png'));
