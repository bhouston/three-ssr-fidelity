import { expect, it, vi } from 'vitest';
import { NoToneMapping, PerspectiveCamera, Scene, Vector3 } from 'three';
import { createHiZRenderer } from './three-hiz.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
// @ts-expect-error The fork's HiZ addon is newer than @types/three.
import { hiZ } from 'three/addons/tsl/display/HiZNode.js';
import { ssrExperimentProfiles } from './ssr-experiments.js';
import type { SceneInstance } from '@three-fidelity/scenes';
vi.mock('three/webgpu', async (original) => ({
  ...(await original<typeof import('three/webgpu')>()),
  WebGPURenderer: class {
    shadowMap = { enabled: false };
    async init() {}
    dispose() {}
  },
  RenderPipeline: class {
    dispose() {}
  },
}));
vi.mock('./helpers.js', () => ({ configureRenderer: vi.fn(), prepareScene: () => () => {}, setRenderSize: vi.fn() }));
vi.mock('three/addons/tsl/display/SSRNode.js', async (original) => {
  const actual = await original<{ ssr: typeof ssr }>();
  return { ...actual, ssr: vi.fn(actual.ssr) };
});
vi.mock('three/addons/tsl/display/HiZNode.js', async (original) => {
  const actual = await original<{ hiZ: typeof hiZ }>();
  return { ...actual, hiZ: vi.fn(actual.hiZ) };
});
it('shares scene depth with the hierarchy and omits hierarchy work for linear controls', async () => {
  for (const [name, profile] of Object.entries(ssrExperimentProfiles)) {
    if (profile.kind !== 'hiz') continue;
    vi.clearAllMocks();
    const setup: SceneInstance = {
      scene: new Scene(),
      camera: new PerspectiveCamera(),
      target: new Vector3(),
      effects: {
        frames: 64,
        toneMapping: NoToneMapping,
        toneMappingExposure: 1,
        temporalDenoise: false,
        ssr: { maxDistance: 20 },
      },
    };
    const live = await createHiZRenderer(
      {} as HTMLCanvasElement,
      setup,
      { width: 480, height: 360 },
      { name, ...profile },
    );
    const call = vi.mocked(ssr).mock.calls[0]!;
    expect(call[3]).toMatchObject({
      stochastic: profile.stochastic,
      hiZEnabled: profile.traversal !== 'linear',
      hiZTraversal: profile.traversal === 'adaptive' ? 'adaptive' : 'conservative',
    });
    if (profile.traversal === 'linear') expect(hiZ).not.toHaveBeenCalled();
    else {
      expect(hiZ).toHaveBeenCalledExactlyOnceWith(call[1]);
      expect(call[3]).toHaveProperty('hiZNode', vi.mocked(hiZ).mock.results[0]!.value);
    }
    live.dispose();
  }
});
