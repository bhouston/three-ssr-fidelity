import { beforeEach, expect, it, vi } from 'vitest';
import type { SceneInstance } from '@three-fidelity/scenes';
import { createRenderer } from './index.js';
import { createDevRenderer } from './three-dev.js';
import { createProjectedSSRRenderer } from './three-pr72.js';
import { ssrExperimentProfiles } from './ssr-experiments.js';
import { createRenderer as createPathTracerRenderer } from 'fidelity-kit-three-gpu-pathtracer';
import type { RendererName } from './types.js';

vi.mock('./three-dev.js', () => ({ createDevRenderer: vi.fn() }));
vi.mock('./three-pr72.js', () => ({ createProjectedSSRRenderer: vi.fn() }));
vi.mock('fidelity-kit-three-gpu-pathtracer', () => ({ createRenderer: vi.fn(), dequantizeAttributes: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

it('preserves scene setup when dispatching the upstream baseline', () => {
  const setup = { effects: { ssr: { intensity: 1 } } } as SceneInstance;
  const before = structuredClone(setup);
  const canvas = {} as HTMLCanvasElement;
  const options = { width: 640, height: 480 };
  createRenderer('three-dev', canvas, setup, options);
  expect(createDevRenderer).toHaveBeenCalledWith(canvas, setup, options);
  expect(createPathTracerRenderer).not.toHaveBeenCalled();
  expect(setup).toEqual(before);
});

it('dispatches every opt-in PR72 method with the same scene and explicit filter profile', () => {
  const setup = { effects: { ssr: { intensity: 1 } } } as SceneInstance;
  const before = structuredClone(setup);
  const canvas = {} as HTMLCanvasElement;
  const options = { width: 480, height: 360 };
  for (const [name, profile] of Object.entries(ssrExperimentProfiles)) {
    if (profile.kind !== 'projected') continue;
    createRenderer(name as RendererName, canvas, setup, options);
    expect(createProjectedSSRRenderer).toHaveBeenLastCalledWith(canvas, setup, options, profile);
  }
  expect(createProjectedSSRRenderer).toHaveBeenCalledTimes(4);
  expect(createDevRenderer).not.toHaveBeenCalled();
  expect(setup).toEqual(before);
});

it('rejects inherited renderers before initializing a GPU', () => {
  for (const name of ['three-current', 'three-new', 'vxgi', 'blender', 'unknown']) {
    expect(() =>
      createRenderer(name as RendererName, {} as HTMLCanvasElement, {} as SceneInstance, {
        width: 1,
        height: 1,
      }),
    ).toThrow('Unknown renderer');
  }
  expect(createPathTracerRenderer).not.toHaveBeenCalled();
  expect(createDevRenderer).not.toHaveBeenCalled();
});

it('rejects unsupported variants rather than quietly measuring a baseline', () => {
  expect(() =>
    createRenderer('three-dev', {} as HTMLCanvasElement, {} as SceneInstance, {
      width: 1,
      height: 1,
      hierarchyExperiment: 'ssr-hiz-tight',
    }),
  ).toThrow();
  expect(() =>
    createRenderer('three-dev', {} as HTMLCanvasElement, {} as SceneInstance, {
      width: 1,
      height: 1,
      ssrTemporalProfile: 'validated',
    }),
  ).toThrow();
  expect(createDevRenderer).not.toHaveBeenCalled();
});
