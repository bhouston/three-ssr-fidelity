import {
  BackSide,
  DataUtils,
  FloatType,
  Mesh,
  MeshBasicNodeMaterial,
  PerspectiveCamera,
  QuadMesh,
  RenderTarget,
  Scene,
  SphereGeometry,
  WebGPURenderer,
} from 'three-pr72/webgpu';
import { equirectUV, positionWorld, texture, vec3 } from 'three-pr72/tsl';
import type { SceneInstance } from '@three-fidelity/scenes';
import { bakeSharedEnvironment } from './three-pr72.js';

/** Hardware-only asymmetric HDR round trip: catches yaw rotation, row flips and HDR clipping. */
export async function runEnvironmentCheck() {
  const renderer = new WebGPURenderer();
  await renderer.init();
  const environment = new Scene();
  const material = new MeshBasicNodeMaterial({ side: BackSide });
  // Position encodes a distinct linear-HDR color for every world direction.
  material.colorNode = positionWorld.normalize().mul(0.5).add(0.5).mul(2);
  material.toneMapped = false;
  const geometry = new SphereGeometry(20, 64, 32);
  environment.add(new Mesh(geometry, material));
  const setup = {
    scene: new Scene(),
    camera: new PerspectiveCamera(),
    environment: { scene: environment, sigma: 0 },
  } as unknown as SceneInstance;
  const target = new RenderTarget(1, 1, { type: FloatType });
  const probe = new MeshBasicNodeMaterial();
  probe.toneMapped = false;
  const quad = new QuadMesh(probe);
  let baked: Awaited<ReturnType<typeof bakeSharedEnvironment>> | undefined;
  const results = [];
  try {
    baked = await bakeSharedEnvironment(renderer, setup);
    const data = (baked.texture?.image as { data?: Uint16Array } | undefined)?.data;
    if (!data || !Array.from(data).every((value) => Number.isFinite(DataUtils.fromHalfFloat(value))))
      throw new Error('Nonfinite baked HDR');
    for (const direction of [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
      [0.3, 0.4, 0.5],
    ]) {
      const length = Math.hypot(...direction);
      const d = direction.map((value) => value / length);
      probe.colorNode = texture(baked.texture!, equirectUV(vec3(d[0]!, d[1]!, d[2]!))).rgb;
      probe.needsUpdate = true;
      renderer.setRenderTarget(target);
      quad.render(renderer);
      const pixels = (await renderer.readRenderTargetPixelsAsync(target, 0, 0, 1, 1)) as Float32Array;
      const expected = d.map((value) => value + 1);
      const actual = Array.from(pixels).slice(0, 3);
      const maxError = Math.max(...actual.map((value, index) => Math.abs(value - expected[index]!)));
      results.push({ direction: d, expected, actual, maxError });
      if (maxError > 0.02) throw new Error(`Environment orientation mismatch: ${JSON.stringify(results.at(-1))}`);
    }
    return { results };
  } finally {
    renderer.setRenderTarget(null);
    baked?.texture?.dispose();
    target.dispose();
    quad.dispose();
    probe.dispose();
    material.dispose();
    geometry.dispose();
    renderer.dispose();
  }
}
