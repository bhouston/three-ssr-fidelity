import { Mesh, MeshPhysicalMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { getScene } from './index.js';
import { disposeSceneInstance } from './lifecycle.js';
import type { SceneContext } from './types.js';

const registry = JSON.parse(readFileSync(new URL('../../../registry.json', import.meta.url), 'utf8')) as {
  scenes: { id: string; fidelity: { width: number; height: number } }[];
};

const noAssets: SceneContext = {
  loadGLTF: async () => {
    throw new Error('Cornell reflection scenes must not load assets');
  },
  loadHDR: async () => {
    throw new Error('Cornell reflection scenes must not load assets');
  },
};

describe('Cornell reflection fixtures', () => {
  it.each([
    ['cornell-box-metallic', 'SphereGeometry'],
    ['cornell-box-mirror', 'PlaneGeometry'],
  ])('registers %s with its source mirror geometry and capture dimensions', async (name, geometryType) => {
    const definition = getScene(name);
    const capture = registry.scenes.find((scene) => scene.id === name)!;
    expect(capture.fidelity.width).toBe(definition.width);
    expect(capture.fidelity.height).toBe(definition.height);
    const setup = await definition.create(noAssets);
    try {
      const mirrors: Mesh[] = [];
      setup.scene.traverse((object) => {
        if (
          object instanceof Mesh &&
          object.material instanceof MeshPhysicalMaterial &&
          object.material.metalness === 1 &&
          object.material.roughness === 0
        )
          mirrors.push(object);
      });
      expect(mirrors).toHaveLength(1);
      expect(mirrors[0]!.geometry.type).toBe(geometryType);
      expect(setup.effects.ssr).toBeDefined();
      expect(setup.camera.aspect).toBe(capture.fidelity.width / capture.fidelity.height);
    } finally {
      disposeSceneInstance(setup);
    }
  });
});
