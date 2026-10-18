export type SSRContribution =
  | 'full'
  | 'no-filter'
  | 'no-hit-specular'
  | 'no-back-depth'
  | 'no-hiz'
  | 'biased-lobe'
  | 'short-rays'
  | 'distance-fade'
  | 'additive-env'
  | 'capped-march';

type StockProfile = {
  kind: 'stock';
  name: string;
  proposal: 28 | 29 | 30 | 32 | 33 | null;
  stochastic: boolean;
  comparator: string;
};
type ContributionProfile = { kind: 'contribution'; name: string; contribution: SSRContribution; comparator: string };
type HookProfile = { kind: 'hook'; name: string; comparator: string };
type HiZProfile = {
  kind: 'hiz';
  minMip?: number;
  name: string;
  traversal: 'linear' | 'conservative' | 'adaptive';
  stochastic: boolean;
  comparator: string;
};
type Profile = StockProfile | ContributionProfile | HookProfile | HiZProfile;

/** Standalone proposals and conditional ablations have deliberately separate comparison controls. */
export const ssrExperimentProfiles = {
  'three-hiz-mirror-adaptive-coarse': {
    kind: 'hiz',
    name: 'Fork mirror · adaptive mip 1',
    traversal: 'adaptive',
    minMip: 1,
    stochastic: false,
    comparator: 'three-hiz-mirror-linear',
  },
  'three-hiz-ggx-adaptive-coarse': {
    kind: 'hiz',
    name: 'Fork ggx · adaptive mip 1',
    traversal: 'adaptive',
    minMip: 1,
    stochastic: true,
    comparator: 'three-hiz-ggx-linear',
  },

  'three-hiz-mirror-linear': {
    kind: 'hiz',
    name: 'Fork mirror · linear',
    traversal: 'linear',
    stochastic: false,
    comparator: 'three-hiz-mirror-linear',
  },
  'three-hiz-mirror-conservative': {
    kind: 'hiz',
    name: 'Fork mirror · conservative',
    traversal: 'conservative',
    stochastic: false,
    comparator: 'three-hiz-mirror-linear',
  },
  'three-hiz-mirror-adaptive': {
    kind: 'hiz',
    name: 'Fork mirror · adaptive',
    traversal: 'adaptive',
    stochastic: false,
    comparator: 'three-hiz-mirror-linear',
  },
  'three-hiz-ggx-linear': {
    kind: 'hiz',
    name: 'Fork ggx · linear',
    traversal: 'linear',
    stochastic: true,
    comparator: 'three-hiz-ggx-linear',
  },
  'three-hiz-ggx-conservative': {
    kind: 'hiz',
    name: 'Fork ggx · conservative',
    traversal: 'conservative',
    stochastic: true,
    comparator: 'three-hiz-ggx-linear',
  },
  'three-hiz-ggx-adaptive': {
    kind: 'hiz',
    name: 'Fork ggx · adaptive',
    traversal: 'adaptive',
    stochastic: true,
    comparator: 'three-hiz-ggx-linear',
  },

  'three-dev-mirror': {
    kind: 'stock',
    name: 'Dev mirror control · dielectrics enabled',
    proposal: null,
    stochastic: false,
    comparator: 'three-dev',
  },
  'three-dev-pr28-normal-bias': {
    kind: 'stock',
    name: 'PR #28 · normal bias (GGX)',
    proposal: 28,
    stochastic: true,
    comparator: 'three-dev',
  },
  'three-dev-pr29-ray-guard': {
    kind: 'stock',
    name: 'PR #29 · ray-length guard (GGX)',
    proposal: 29,
    stochastic: true,
    comparator: 'three-dev',
  },
  'three-dev-pr30-sampling-docs': {
    kind: 'stock',
    name: 'PR #30 · sampling documentation (GGX)',
    proposal: 30,
    stochastic: true,
    comparator: 'three-dev',
  },
  'three-dev-pr32-dielectric': {
    kind: 'stock',
    name: 'PR #32 · dielectric mirror Fresnel',
    proposal: 32,
    stochastic: false,
    comparator: 'three-dev-mirror',
  },
  'three-dev-pr33-back-depth': {
    kind: 'stock',
    name: 'PR #33 · back-face depth (GGX)',
    proposal: 33,
    stochastic: true,
    comparator: 'three-dev',
  },
  'three-dev-pr34-radiance-hook': {
    kind: 'hook',
    name: 'PR #34 · radiance API (stock provider)',
    comparator: 'three-dev',
  },
  'three-ssr-full': {
    kind: 'contribution',
    name: 'Full reflection pipeline',
    contribution: 'full',
    comparator: 'three-dev',
  },
  'three-ssr-additive-env': {
    kind: 'contribution',
    name: 'Full pipeline · add environment again',
    contribution: 'additive-env',
    comparator: 'three-ssr-full',
  },
  'three-ssr-capped-march': {
    kind: 'contribution',
    name: 'Linear march · cap at 32 steps',
    contribution: 'capped-march',
    comparator: 'three-ssr-no-hiz',
  },
  'three-ssr-no-hiz': {
    kind: 'contribution',
    name: 'Full pipeline · uncapped linear march',
    contribution: 'no-hiz',
    comparator: 'three-ssr-full',
  },
  'three-ssr-distance-fade': {
    kind: 'contribution',
    name: 'Full pipeline · restore distance fade',
    contribution: 'distance-fade',
    comparator: 'three-ssr-full',
  },
  'three-ssr-no-back-depth': {
    kind: 'contribution',
    name: 'Full pipeline · omit back depth',
    contribution: 'no-back-depth',
    comparator: 'three-ssr-full',
  },
  'three-ssr-no-filter': {
    kind: 'contribution',
    name: 'Full pipeline · omit reflection filter',
    contribution: 'no-filter',
    comparator: 'three-ssr-full',
  },
  'three-ssr-no-hit-specular': {
    kind: 'contribution',
    name: 'Full pipeline · omit hit specular',
    contribution: 'no-hit-specular',
    comparator: 'three-ssr-full',
  },
  'three-ssr-biased-lobe': {
    kind: 'contribution',
    name: 'Full pipeline · mirror bias 0.5',
    contribution: 'biased-lobe',
    comparator: 'three-ssr-full',
  },
  'three-ssr-short-rays': {
    kind: 'contribution',
    name: 'Full pipeline · authored ray reach',
    contribution: 'short-rays',
    comparator: 'three-ssr-full',
  },
} as const satisfies Record<string, Profile>;

export type SSRExperimentName = keyof typeof ssrExperimentProfiles;
export function isSSRExperiment(name: string): name is SSRExperimentName {
  return Object.hasOwn(ssrExperimentProfiles, name);
}
