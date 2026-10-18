import { beforeEach, expect, it, vi } from 'vitest';
import type { SceneInstance } from '@three-fidelity/scenes';
import { createProjectedSSRRenderer } from './three-pr72.js';
import { ssrExperimentProfiles } from './ssr-experiments.js';

const mock = vi.hoisted(() => {
  // These factories must stay inside vi.hoisted.
  // oxlint-disable-next-line unicorn/consistent-function-scoping
  const value = () => ({ value: 0 });
  // oxlint-disable-next-line unicorn/consistent-function-scoping
  const graph = () => {
    const n = { rgb: {}, r: {}, g: {}, a: {}, add: vi.fn(), sample: vi.fn() };
    n.add.mockReturnValue(n);
    n.sample.mockReturnValue(n);
    return n;
  };
  const estimator = () => ({
    maxDistance: value(),
    thickness: value(),
    intensity: value(),
    environmentIntensity: value(),
    quality: value(),
    steps: value(),
    rayCount: value(),
    seed: value(),
    maxLuminance: value(),
    rgb: {},
    dispose: vi.fn(),
    resetHistory: vi.fn(),
  });
  return {
    graph,
    passes: [] as { transparent: boolean; getTextureNode: (name: string) => ReturnType<typeof graph> | undefined }[],
    power: vi.fn(() => estimator()),
    ggx: vi.fn(() => estimator()),
    denoise: vi.fn(() => ({ color: graph(), temporal: { dispose: vi.fn() }, denoise: { dispose: vi.fn() } })),
    aa: vi.fn(() => ({ jitter: true, dispose: vi.fn() })),
    reset: vi.fn(() => ({ update: vi.fn(), reset: vi.fn() })),
  };
});
vi.mock('three-pr72/webgpu', () => {
  class Renderer {
    library = { addLight: vi.fn() };
    shadowMap = { enabled: false };
    init = vi.fn();
    setSize = vi.fn();
    dispose = vi.fn();
  }
  class Lighting {
    indirectSpecular() {}
  }
  class Pipeline {
    render = vi.fn();
    dispose = vi.fn();
  }
  return {
    WebGPURenderer: Renderer,
    RenderPipeline: Pipeline,
    PhysicalLightingModel: Lighting,
    AmbientLightNode: vi.fn(),
    DirectionalLightNode: vi.fn(),
    HemisphereLightNode: vi.fn(),
    LightProbeNode: vi.fn(),
    PointLightNode: vi.fn(),
    RectAreaLightNode: vi.fn(),
    SpotLightNode: vi.fn(),
    PMREMGenerator: vi.fn(),
    UnsignedByteType: 1009,
    CubeCamera: vi.fn(),
    DataTexture: vi.fn(),
    EquirectangularReflectionMapping: 303,
    HalfFloatType: 1016,
    LinearFilter: 1006,
    MeshBasicNodeMaterial: vi.fn(),
    QuadMesh: vi.fn(),
    RenderTarget: vi.fn(),
    RepeatWrapping: 1000,
    RGBAFormat: 1023,
    CubeRenderTarget: vi.fn(),
  };
});
vi.mock('three-pr72/tsl', () => ({
  pass: vi.fn(() => {
    const nodes = new Map<string, ReturnType<typeof mock.graph>>();
    const p = {
      transparent: true,
      setMRT: vi.fn(),
      dispose: vi.fn(),
      getTexture: vi.fn(() => ({})),
      getTextureNode: vi.fn((name: string) => {
        if (!nodes.has(name)) nodes.set(name, mock.graph());
        return nodes.get(name);
      }),
    };
    mock.passes.push(p);
    return p;
  }),
  mrt: vi.fn(),
  sample: vi.fn(() => mock.graph()),
  vec2: vi.fn(),
  vec3: vi.fn(),
  vec4: vi.fn(),
  packNormalToRGB: vi.fn(),
  unpackRGBToNormal: vi.fn(),
  color: vi.fn(),
  diffuseColor: { rgb: {} },
  metalness: {},
  roughness: {},
  normalView: {},
  output: {},
  velocity: {},
  screenUV: {},
  cubeTexture: vi.fn(),
  uv: vi.fn(),
}));
vi.mock('three-pr72/addons/tsl/display/PowerLobeSSRNode.js', () => ({ powerLobeSSR: mock.power }));
vi.mock('three-pr72/addons/tsl/display/SSRNode.js', () => ({ ssr: mock.ggx }));
vi.mock('three-pr72/addons/tsl/display/TRAANode.js', () => ({ traa: mock.aa }));
vi.mock('three-pr72/addons/tsl/display/SSRComparison.js', () => ({
  createSSRComparisonDenoiser: mock.denoise,
  createSSRHistoryReset: mock.reset,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mock.passes.length = 0;
});
const setup = () =>
  ({
    scene: { environmentIntensity: 0.5, environment: null },
    camera: { updateProjectionMatrix: vi.fn(), copy: vi.fn() },
    effects: { ssr: { maxDistance: 2, thickness: 0.02, intensity: 0.8 } },
  }) as unknown as SceneInstance;

it('feeds power opaque HDR and hit-surface motion, with one ray and clamp disabled', async () => {
  const live = await createProjectedSSRRenderer(
    {} as HTMLCanvasElement,
    setup(),
    { width: 480, height: 360 },
    ssrExperimentProfiles['three-pr72-power-raw'],
  );
  const opaque = mock.passes[1]!;
  expect(opaque.transparent).toBe(false);
  expect(mock.power).toHaveBeenCalledWith(
    opaque.getTextureNode('output'),
    opaque.getTextureNode('depth'),
    expect.anything(),
    expect.objectContaining({ velocityNode: opaque.getTextureNode('velocity'), environmentNode: null }),
  );
  const node = mock.power.mock.results[0]!.value;
  expect(node.maxDistance.value).toBe(2);
  expect(node.rayCount.value).toBe(1);
  expect(node.steps.value).toBe(16);
  expect(node.seed.value).toBe(1);
  expect(node.maxLuminance.value).toBe(0);
  expect(mock.denoise).not.toHaveBeenCalled();
  expect(mock.aa.mock.results[0]!.value.jitter).toBe(false);
  live.setSize(640, 480);
  expect(mock.reset.mock.results[0]!.value.reset).toHaveBeenCalledTimes(2);
  live.dispose();
  expect(node.dispose).toHaveBeenCalledOnce();
});

it('uses the same raw-distance filter adapter and camera sampling for GGX and power', async () => {
  for (const id of ['three-pr72-ggx-recurrent', 'three-pr72-power-recurrent'] as const) {
    const live = await createProjectedSSRRenderer(
      {} as HTMLCanvasElement,
      setup(),
      { width: 480, height: 360 },
      ssrExperimentProfiles[id],
    );
    const factory = id.includes('ggx') ? mock.ggx : mock.power;
    const node = factory.mock.results.at(-1)!.value;
    expect(mock.denoise).toHaveBeenLastCalledWith(
      node,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    expect(mock.aa.mock.results.at(-1)!.value.jitter).toBe(false);
    live.dispose();
  }
});

it('rejects scenes without SSR instead of removing their environment specular', async () => {
  const scene = setup();
  scene.effects.ssr = undefined;
  await expect(
    createProjectedSSRRenderer(
      {} as HTMLCanvasElement,
      scene,
      { width: 1, height: 1 },
      ssrExperimentProfiles['three-pr72-power-raw'],
    ),
  ).rejects.toThrow('require a scene with SSR enabled');
  expect(mock.power).not.toHaveBeenCalled();
});
