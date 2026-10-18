// Independent runtime pin: three.js PR #72. Existing renderer source pins stay unchanged.
import * as Fork from 'three';
import {
  AmbientLightNode,
  DirectionalLightNode,
  HemisphereLightNode,
  LightProbeNode,
  PhysicalLightingModel,
  PMREMGenerator,
  PointLightNode,
  RectAreaLightNode,
  RenderPipeline,
  SpotLightNode,
  UnsignedByteType,
  WebGPURenderer,
  CubeCamera,
  DataTexture,
  EquirectangularReflectionMapping,
  HalfFloatType,
  LinearFilter,
  MeshBasicNodeMaterial,
  QuadMesh,
  RenderTarget,
  RepeatWrapping,
  RGBAFormat,
  CubeRenderTarget,
} from 'three-pr72/webgpu';
import {
  color,
  diffuseColor,
  metalness,
  mrt,
  normalView,
  output,
  packNormalToRGB,
  pass,
  roughness,
  sample,
  screenUV,
  unpackRGBToNormal,
  vec2,
  vec3,
  vec4,
  velocity,
  cubeTexture,
  uv as textureUV,
} from 'three-pr72/tsl';
import { ssr } from 'three-pr72/addons/tsl/display/SSRNode.js';
import { traa } from 'three-pr72/addons/tsl/display/TRAANode.js';
import { powerLobeSSR, createSSRComparisonDenoiser, createSSRHistoryReset } from '../ssr-pr72-addons.js';
import type { SceneInstance } from '@three-fidelity/scenes';
import type { LiveRenderer, RendererOptions } from './types.js';
import { configureRenderer, prepareScene, setRenderSize } from './helpers.js';
import type { ProjectedProfile } from './ssr-experiments.js';

// Three.js versions have separate TSL stacks. Only this adapter crosses the duck-typed scene boundary.
// oxlint-disable-next-line typescript/no-explicit-any
type AnyNode = any;
const forkLights: [AnyNode, AnyNode][] = [
  [PointLightNode, Fork.PointLight],
  [DirectionalLightNode, Fork.DirectionalLight],
  [SpotLightNode, Fork.SpotLight],
  [AmbientLightNode, Fork.AmbientLight],
  [HemisphereLightNode, Fork.HemisphereLight],
  [RectAreaLightNode, Fork.RectAreaLight],
  [LightProbeNode, Fork.LightProbe],
];

// All four PR72 methods replace environment specular with the estimator's own fallback.
// This isolated runtime is never used by the existing baseline/proposal renderers.
const indirectSpecular = PhysicalLightingModel.prototype.indirectSpecular;
PhysicalLightingModel.prototype.indirectSpecular = function (this: AnyNode, builder: AnyNode) {
  builder.context.radiance = vec3(0);
  if (this.clearcoatRadiance) this.clearcoatRadiance.assign(vec3(0));
  indirectSpecular.call(this, builder);
};

/** Stock SSR requires CPU equirectangular data, while power also accepts PMREM.
 * Bake the authored environment identically for both; never give one a black miss fallback.
 * This is initialization work, independent of the per-frame HDR history.
 */
async function bakeSharedEnvironment(renderer: WebGPURenderer, setup: SceneInstance) {
  if (!setup.environment) return null;
  const cube = new CubeRenderTarget(256, { type: HalfFloatType });
  const camera = new CubeCamera(0.1, 100, cube);
  const material = new MeshBasicNodeMaterial();
  const quad = new QuadMesh(material);
  const target = new RenderTarget(512, 256, { type: HalfFloatType });
  const previous = renderer.getRenderTarget();
  try {
    camera.update(renderer, setup.environment.scene as AnyNode);
    const theta = textureUV()
      .x.sub(0.5)
      .mul(Math.PI * 2);
    const phi = textureUV().y.sub(0.5).mul(-Math.PI);
    const direction = vec3(theta.sin().mul(phi.cos()), phi.sin(), theta.cos().mul(phi.cos()).negate());
    material.colorNode = cubeTexture(cube.texture, direction);
    material.toneMapped = false;
    renderer.setRenderTarget(target);
    quad.render(renderer);
    const pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, 512, 256);
    const texture = new DataTexture(pixels, 512, 256, RGBAFormat, HalfFloatType);
    texture.mapping = EquirectangularReflectionMapping;
    texture.wrapS = RepeatWrapping;
    texture.generateMipmaps = false;
    texture.minFilter = texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
  } finally {
    renderer.setRenderTarget(previous);
    material.dispose();
    quad.dispose();
    target.dispose();
    cube.dispose();
  }
}

export async function createProjectedSSRRenderer(
  canvas: HTMLCanvasElement,
  sceneSetup: SceneInstance,
  { width, height, trackTimestamp = false }: RendererOptions,
  profile: ProjectedProfile,
): Promise<LiveRenderer> {
  if (!sceneSetup.effects.ssr) throw new Error('PR72 experiments require a scene with SSR enabled');
  const setup = { ...sceneSetup, effects: { ...sceneSetup.effects, ssgi: undefined } };
  const { scene, camera, effects } = setup as AnyNode;
  const renderer = new WebGPURenderer({ canvas, antialias: false, trackTimestamp } as AnyNode);
  for (const [node, light] of forkLights) renderer.library.addLight(node, light);
  renderer.shadowMap.enabled = true;
  configureRenderer(renderer, effects);
  await renderer.init();
  const releaseScene = prepareScene(setup, {
    createGradient: ({ center, edge }) => screenUV.distance(0.5).remap(0, 0.5).mix(color(center), color(edge)),
    bakeEnvironment(environment) {
      const generator = new PMREMGenerator(renderer);
      try {
        return generator.fromScene(environment.scene as AnyNode, environment.sigma) as AnyNode;
      } finally {
        generator.dispose();
      }
    },
  });
  const environment = await bakeSharedEnvironment(renderer, setup);
  const pipeline = new RenderPipeline(renderer);
  const beauty = pass(scene, camera);
  // Both estimators use the same opaque geometry/color pass and final transparent beauty.
  // Power's node owns a separate previous opaque linear-HDR copy; AA/exposure never feed it.
  const opaque = pass(scene, camera);
  opaque.transparent = false;
  opaque.setMRT(
    mrt({
      output,
      normal: vec4(packNormalToRGB(normalView), roughness),
      diffuse: vec4(diffuseColor.rgb, metalness),
      velocity,
    }),
  );
  opaque.getTexture('normal').type = UnsignedByteType;
  opaque.getTexture('diffuse').type = UnsignedByteType;
  const depth = opaque.getTextureNode('depth');
  const packedNormal = opaque.getTextureNode('normal');
  const diffuse = opaque.getTextureNode('diffuse');
  const motion = opaque.getTextureNode('velocity');
  const material = sample((uv: AnyNode) => vec2(diffuse.sample(uv).a, packedNormal.sample(uv).a));
  const normal = sample((uv: AnyNode) => unpackRGBToNormal(packedNormal.sample(uv).rgb));
  const params = effects.ssr;
  const createSSR: AnyNode = profile.estimator === 'power' ? powerLobeSSR : ssr;
  const node: AnyNode = createSSR(opaque.getTextureNode('output'), depth, normal, {
    camera,
    stochastic: true,
    binaryRefine: true,
    maxRayLength: params?.maxDistance ?? 1,
    metalnessNode: material.r,
    roughnessNode: material.g,
    diffuseNode: diffuse,
    environmentNode: environment,
    velocityNode: motion,
  });
  node.maxDistance.value = params?.maxDistance ?? 1;
  node.thickness.value = params?.thickness ?? 0.03;
  node.intensity.value = params?.intensity ?? 1;
  node.environmentIntensity.value = scene.environmentIntensity;
  node.resolutionScale = 1;
  if (profile.estimator === 'power') {
    node.steps.value = 16;
    node.rayCount.value = 1;
    node.seed.value = 1;
    node.maxLuminance.value = 0;
  } else {
    node.quality.value = 16 / 64;
    node.maxLuminance.value = 1e20; // Stock API has no off toggle.
  }
  const reconstruction = profile.denoise
    ? createSSRComparisonDenoiser(node, depth, packedNormal, motion, material, camera)
    : null;
  // Raw weighted RGB/distance enters the existing filter adapter; inverse-age alpha stays internal.
  // Coverage is diagnostic metadata, never opacity or another RGB weight.
  const composite = beauty.getTextureNode('output').add((reconstruction?.color ?? node).rgb);
  const aa: AnyNode = traa(composite, depth, motion, camera);
  aa.jitter = false; // Match camera sampling across raw and recurrent methods.
  pipeline.outputNode = aa;
  const history = createSSRHistoryReset(node, camera, reconstruction?.temporal, reconstruction?.denoise);
  let frames = 0;
  const handle: LiveRenderer = {
    name: profile.name,
    renderer: renderer as AnyNode,
    get frames() {
      return frames;
    },
    render() {
      history.update();
      pipeline.render();
      frames++;
    },
    setSize(w, h) {
      setRenderSize(renderer, camera, w, h);
      history.reset();
    },
    setCamera(next) {
      if (next !== camera) camera.copy(next);
      history.update();
    },
    dispose() {
      pipeline.dispose();
      node.dispose();
      reconstruction?.temporal.dispose();
      reconstruction?.denoise.dispose();
      aa.dispose();
      opaque.dispose();
      beauty.dispose();
      environment?.dispose();
      releaseScene();
      renderer.dispose();
    },
  };
  handle.setSize(width, height);
  return handle;
}
