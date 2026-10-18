import { readFile, writeFile } from 'node:fs/promises';
import { ssrExperimentProfiles } from '../packages/renderers/src/ssr-experiments.ts';
const registry = JSON.parse(await readFile('registry.json', 'utf8'));
registry.renderers = registry.renderers.filter((item) => ['three-dev', 'three-gpu-pathtracer'].includes(item.id));
for (const [id, profile] of Object.entries(ssrExperimentProfiles))
  registry.renderers.push({
    id,
    name: profile.name,
    reference: false,
    enabled: true,
    params: { renderer: id },
    category:
      profile.kind === 'projected'
        ? 'Experimental power lobe'
        : profile.kind === 'contribution'
          ? 'Conditional comparisons'
          : profile.kind === 'hook'
            ? 'Independent PRs'
            : profile.proposal === null
              ? 'Controls'
              : 'Independent PRs',
  });
registry.comparisonPresets = [
  { id: 'ssr', name: 'Stochastic SSR baseline', ref: 'three-gpu-pathtracer', renderers: ['three-dev'] },
  {
    id: 'ssr-proposals',
    name: 'Independent SSR PRs',
    ref: 'three-gpu-pathtracer',
    renderers: [
      'three-dev',
      ...Object.entries(ssrExperimentProfiles)
        .filter(([, p]) => p.kind !== 'contribution' && p.kind !== 'projected')
        .map(([id]) => id),
    ],
  },
  {
    id: 'ssr-power-lobe',
    name: 'Experimental power lobe and matched GGX controls',
    ref: 'three-gpu-pathtracer',
    renderers: Object.entries(ssrExperimentProfiles)
      .filter(([, p]) => p.kind === 'projected')
      .map(([id]) => id),
  },
  {
    id: 'ssr-contributions',
    name: 'Full pipeline and feature-removal comparisons',
    ref: 'three-gpu-pathtracer',
    renderers: [
      'three-dev',
      ...Object.entries(ssrExperimentProfiles)
        .filter(([, p]) => p.kind === 'contribution')
        .map(([id]) => id),
    ],
  },
];
registry.performance.representative.entries = registry.scenes.flatMap((scene) =>
  registry.renderers.map((renderer) => ({
    renderer: renderer.id,
    scene: scene.id,
    durationMs: 10000,
    params: { width: 480, height: 360 },
  })),
);
registry.performance.experiments = { ...registry.performance.representative };
await writeFile('registry.json', JSON.stringify(registry, null, 2) + '\n');
await writeFile(
  'fidelity-results/fidelity.json',
  JSON.stringify(
    {
      title: registry.title,
      renderers: registry.renderers.map(({ id, name, reference, enabled, category }) => ({
        id,
        label: name,
        reference,
        enabled,
        category,
      })),
      comparisonPresets: registry.comparisonPresets,
    },
    null,
    2,
  ) + '\n',
);
