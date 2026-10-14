import { beforeEach, expect, it, vi } from 'vitest';
import type { SceneInstance } from '@three-fidelity/scenes';
import { createRenderer } from './index.js';
import { createDevRenderer } from './three-dev.js';
import { createRenderer as createPathTracerRenderer } from 'fidelity-kit-three-gpu-pathtracer';
import type { RendererName } from './types.js';

vi.mock('./three-dev.js', () => ({ createDevRenderer: vi.fn() }));
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
