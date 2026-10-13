import { describe, expect, it } from 'vitest';
import { performanceConfiguration, performanceRendererNames } from './performance-config';

describe('performance renderer contract', () => {
  it('exposes only the two SSR comparison renderers', () => {
    expect(performanceConfiguration({}).renderer).toBe('three-dev');
    expect(performanceRendererNames).toEqual(['three-dev', 'three-gpu-pathtracer']);
    expect(performanceRendererNames).toContain('three-gpu-pathtracer');
  });
  it('rejects external renderers, Blender and invalid experiment combinations', () => {
    for (const renderer of ['blender', 'webgpu-three-pathtracer'])
      expect(() => performanceConfiguration({ renderer })).toThrow('Unsupported performance renderer');
    expect(() => performanceConfiguration({ renderer: 'three-current', experiment: 'hierarchy-combined' })).toThrow();
    expect(() => performanceConfiguration({ renderer: 'three-dev', experiment: 'ssgi-4x16' })).toThrow();
    for (const experiment of ['ssgi-2x16', 'ssgi-2x8'])
      expect(() => performanceConfiguration({ renderer: 'three-new', experiment })).toThrow();
  });
  it('validates dimensions, deterministic seed and workload', () => {
    for (const params of [{ width: 0 }, { height: 1.5 }, { seed: NaN }, { motion: 'random' }])
      expect(() => performanceConfiguration(params)).toThrow();
  });
});
