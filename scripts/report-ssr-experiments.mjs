import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ssrExperimentProfiles } from '../packages/renderers/src/ssr-experiments.ts';
const registry = JSON.parse(await readFile('registry.json', 'utf8'));
const reference = 'three-gpu-pathtracer';
const index = JSON.parse(await readFile('fidelity-results/index.json', 'utf8'));
const score = (scene, renderer) => {
  const key = `${scene}/beauty/${renderer}.vs-${reference}.metrics.json`;
  const value = index.metrics[key]?.psnr;
  if (!Number.isFinite(value)) throw new Error(`Missing finite score: ${key}`);
  return value;
};
const hash = async (scene, renderer) =>
  createHash('sha256')
    .update(await readFile(`fidelity-results/${scene}/beauty/${renderer}.avif`))
    .digest('hex');
const comparisons = [];
for (const [id, profile] of Object.entries(ssrExperimentProfiles)) {
  const scenes = [];
  for (const scene of registry.scenes) {
    const candidate = score(scene.id, id),
      control = score(scene.id, profile.comparator);
    scenes.push({
      scene: scene.id,
      candidatePsnrDb: candidate,
      controlPsnrDb: control,
      candidateDeltaDb: candidate - control,
      identicalAvif: (await hash(scene.id, id)) === (await hash(scene.id, profile.comparator)),
    });
  }
  comparisons.push({
    renderer: id,
    name: profile.name,
    kind: profile.kind,
    control: profile.comparator,
    meanDeltaDb: scenes.reduce((sum, row) => sum + row.candidateDeltaDb, 0) / scenes.length,
    identicalScenes: scenes.filter((row) => row.identicalAvif).length,
    scenes,
  });
}
await mkdir('docs/data', { recursive: true });
await writeFile(
  'docs/data/SSR-EXPERIMENTS.json',
  JSON.stringify(
    {
      reference,
      frames: 64,
      seed: 1,
      scenes: registry.scenes.map((s) => s.id),
      comparisons,
      sourceReport: 'https://github.com/bhouston/three-fidelity/blob/8a797865611/docs/research/SSR-CONTRIBUTIONS.md',
    },
    null,
    2,
  ) + '\n',
);
const table = [
  '| Renderer | Matched control | Mean PSNR change (dB) | Identical scenes |',
  '| --- | --- | ---: | ---: |',
  ...comparisons.map(
    (row) =>
      `| ${row.renderer} | ${row.control} | ${row.meanDeltaDb.toFixed(4)} | ${row.identicalScenes}/${registry.scenes.length} |`,
  ),
];
const proposal32 = comparisons.find((row) => row.renderer === 'three-dev-pr32-dielectric');
const proposal33 = comparisons.find((row) => row.renderer === 'three-dev-pr33-back-depth');
const dielectric = proposal32.scenes.find((row) => row.scene === 'diag-dielectric-30');
const wall = proposal32.scenes.find((row) => row.scene === 'diag-wall');
const observations = `PR #32 improves the intended dielectric diagnostic by ${dielectric.candidateDeltaDb.toFixed(4)} dB but changes the wall scene by ${wall.candidateDeltaDb.toFixed(4)} dB; its mean is ${proposal32.meanDeltaDb.toFixed(4)} dB. Treat it as a targeted flag-behavior fix with composition regressions, not a broad fidelity improvement. Standalone PR #33 in GGX mode averages ${proposal33.meanDeltaDb.toFixed(4)} dB; this suite supports keeping it experimental. Its effect is distinct from removing back depth from the full pipeline. The mirror-control row compares sampling modes and is not an independent PR result.`;
const report = `# Captured SSR comparisons\n\n${registry.scenes.length} scenes, seed 1, 64 completed frames, 4096-sample path-traced references. Actual adapter provenance is retained in [capture records](data/SSR-EXPERIMENTS-CAPTURES.json).\n\nPositive values mean the candidate scores higher than its matched control. For feature-removal comparisons, a negative value measures a conditional penalty: restoring that feature provides the opposite signed benefit within this full pipeline. The capped march uses uncapped linear marching as its control; both disable Hi-Z. These deltas are not additive or predictions for standalone PRs.\n\n${table.join('\n')}\n\n${observations}\n\nPR #30 changes documentation only. PR #34 adds an unused radiance API in the stock-provider capture; a radiance-producing provider is required to realize integration gains. Compare PR #32 with the mirror control, since it does not alter stochastic GGX. No throughput claim is inferred from image quality.\n\nInspect scene-level scores and difference images in the viewer before deciding on a merge. Full-frame RGB8 PSNR can hide local regressions; this is one GPU, one static pose and one seed per scene. [Per-scene scores](data/SSR-EXPERIMENTS.json) and [renderer definitions](SSR-EXPERIMENTS.md) retain the matched controls and source pins.\n`;
await writeFile('docs/SSR-EXPERIMENT-RESULTS.md', report);
console.log(table.join('\n'));
