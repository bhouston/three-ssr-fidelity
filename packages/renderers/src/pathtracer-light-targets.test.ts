import { expect, it } from 'vitest';
import { DirectionalLight, Group, Scene, SpotLight, Vector3 } from 'three';
import type { SceneInstance } from '@three-fidelity/scenes';
import { cloneScene } from 'fidelity-kit-three-gpu-pathtracer';

function direction(light: DirectionalLight | SpotLight): Vector3 {
  return new Vector3()
    .setFromMatrixPosition(light.matrixWorld)
    .sub(new Vector3().setFromMatrixPosition(light.target.matrixWorld))
    .normalize();
}

it.each([DirectionalLight, SpotLight])('resolves parented targets for %s', (Light) => {
  const scene = new Scene();
  const parent = new Group();
  parent.position.set(7, 3, -2);
  parent.rotation.y = Math.PI / 3;
  const light = new Light();
  light.name = 'parented-light';
  light.position.set(-10, 8, 4);
  light.target.position.set(1, 2, 3);
  parent.add(light.target);
  scene.add(light, parent);
  const expectedTarget = light.target.position
    .clone()
    .applyAxisAngle(new Vector3(0, 1, 0), parent.rotation.y)
    .add(parent.position);
  const expected = light.position.clone().sub(expectedTarget).normalize();
  const setup = { scene, effects: {} } as SceneInstance;
  const after = cloneScene(setup.scene);
  expect(
    direction(after.getObjectByName(light.name) as DirectionalLight | SpotLight).distanceTo(expected),
  ).toBeLessThan(1e-12);
  expect(light.target.parent).toBe(parent);
  expect(light.target.position.toArray()).toEqual([1, 2, 3]);
});
