import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ssrExperimentProfiles } from '../packages/renderers/src/ssr-experiments.ts';
const require = createRequire(new URL('../submodules/fidelity-kit/packages/cli/package.json', import.meta.url));
const sharp = require('sharp');
const root = resolve(process.argv[2] ?? 'fidelity-results');
const registry = JSON.parse(await readFile('registry.json', 'utf8'));
const comparisons = [];
for (const scene of registry.scenes.filter((s) => s.id.startsWith('diag-'))) {
  const output = resolve(root, scene.id, 'beauty');
  for (const [renderer, profile] of Object.entries(ssrExperimentProfiles).filter(([, p]) => p.kind === 'hiz')) {
    const candidate = await sharp(resolve(output, `${renderer}.avif`))
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (const reference of [profile.comparator, 'three-gpu-pathtracer']) {
      const control = await sharp(resolve(output, `${reference}.avif`))
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      if (
        candidate.info.width !== control.info.width ||
        candidate.info.height !== control.info.height ||
        candidate.data.length !== control.data.length
      )
        throw new Error(`Mismatched dimensions: ${scene.id}/${renderer}/${reference}`);
      const delta = Buffer.alloc(candidate.data.length);
      let squaredError = 0,
        changed = 0,
        maxDelta = 0;
      for (let i = 0; i < delta.length; i++) {
        const difference = Math.abs(candidate.data[i] - control.data[i]);
        squaredError += difference * difference;
        if (difference) changed++;
        maxDelta = Math.max(maxDelta, difference);
        delta[i] = Math.min(255, difference * 8);
      }
      const mse = squaredError / delta.length;
      const row = {
        scene: scene.id,
        renderer,
        reference,
        mse,
        psnrDb: mse === 0 ? null : 10 * Math.log10((255 * 255) / mse),
        identical: mse === 0,
        changedChannelFraction: changed / delta.length,
        maxDelta,
        deltaGain: 8,
      };
      await sharp(delta, { raw: candidate.info })
        .png()
        .toFile(resolve(output, `${renderer}.vs-${reference}.delta8.png`));
      await writeFile(
        resolve(output, `${renderer}.vs-${reference}.hiz-metrics.json`),
        JSON.stringify(row, null, 2) + '\n',
      );
      comparisons.push(row);
    }
  }
}
await mkdir('docs/data', { recursive: true });
await writeFile(
  'docs/data/SSR-HIZ-COMPARISONS.json',
  JSON.stringify(
    { metric: 'display RGB8 PSNR, decoded AVIF; null PSNR denotes identical images', deltaGain: 8, comparisons },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify(comparisons, null, 2));
