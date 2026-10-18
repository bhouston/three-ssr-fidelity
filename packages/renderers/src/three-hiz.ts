// Matched fork controls: only Hi-Z traversal differs within each sampling mode.
import * as Fork from 'three';
import {
  AmbientLightNode,
  DirectionalLightNode,
  HemisphereLightNode,
  LightProbeNode,
  PMREMGenerator,
  PointLightNode,
  RectAreaLightNode,
  RenderPipeline,
  SpotLightNode,
  UnsignedByteType,
  WebGPURenderer,
} from 'three/webgpu';
import {
  color,
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
  velocity,
} from 'three/tsl';
// @ts-expect-error The fork's HiZ addon is newer than @types/three.
import { hiZ } from 'three/addons/tsl/display/HiZNode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import type { SceneInstance } from '@three-fidelity/scenes';
import type { LiveRenderer, RendererOptions } from './types.js';
import { configureRenderer, prepareScene, setRenderSize } from './helpers.js';

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

export type HiZSSRVariant = { name: string; stochastic: boolean; traversal: 'linear' | 'conservative' | 'adaptive' };

function createPipeline(renderer: WebGPURenderer, setup: SceneInstance, variant: HiZSSRVariant): RenderPipeline {
  const { scene, camera, effects } = setup as AnyNode as {
    scene: AnyNode;
    camera: AnyNode;
    effects: SceneInstance['effects'];
  };
  const renderPipeline = new RenderPipeline(renderer);

  // only the attachments the stock examples use for this scene's effects
  const scenePass = pass(scene, camera);
  scenePass.setMRT(
    mrt({
      output,
      normal: packNormalToRGB(normalView),
      ...(effects.ssr ? { metalrough: vec2(metalness, roughness) } : {}),
      velocity,
    }),
  );
  const scenePassColor: AnyNode = scenePass.getTextureNode('output');
  const scenePassDepth: AnyNode = scenePass.getTextureNode('depth');
  const scenePassNormal: AnyNode = scenePass.getTextureNode('normal');
  scenePass.getTexture('normal').type = UnsignedByteType;
  const sceneNormal = sample((uv: AnyNode) => unpackRGBToNormal(scenePassNormal.sample(uv)));
  const antialias = (node: AnyNode): AnyNode =>
    traa(node, scenePassDepth, scenePass.getTextureNode('velocity'), camera);

  let composite: AnyNode = scenePassColor;
  if (effects.ssr) {
    const params = effects.ssr;
    scenePass.getTexture('metalrough').type = UnsignedByteType;
    const scenePassMetalRough: AnyNode = scenePass.getTextureNode('metalrough');
    const ssrPass: AnyNode = ssr(scenePassColor, scenePassDepth, sceneNormal, {
      metalnessNode: scenePassMetalRough.r,
      roughnessNode: scenePassMetalRough.g,
      camera,
      binaryRefine: true,
      stochastic: variant.stochastic,
      hiZ: variant.traversal === 'linear' ? null : hiZ(scenePassDepth),
      hiZEnabled: variant.traversal !== 'linear',
      hiZTraversal: variant.traversal === 'adaptive' ? 'adaptive' : 'conservative',
      reflectNonMetals: true,
    } as AnyNode);
    ssrPass.maxDistance.value = params.maxDistance;
    if (params.quality !== undefined) ssrPass.quality.value = params.quality;
    if (params.blurQuality !== undefined) ssrPass.blurQuality = params.blurQuality;
    if (params.intensity !== undefined) ssrPass.intensity.value = params.intensity;
    if (params.thickness !== undefined) ssrPass.thickness.value = params.thickness;
    ssrPass.resolutionScale = effects.resolutionScale ?? 1;
    // SSR outputs premultiplied color: additive blend over the beauty
    composite = composite.add(ssrPass.rgb);
  }
  renderPipeline.outputNode = antialias(composite);
  return renderPipeline;
}

export async function createHiZRenderer(
  canvas: HTMLCanvasElement,
  sceneSetup: SceneInstance,
  { width, height, trackTimestamp = false }: RendererOptions,
  variant: HiZSSRVariant,
): Promise<LiveRenderer> {
  const setup = { ...sceneSetup, effects: { ...sceneSetup.effects, ssgi: undefined } };
  const { camera, effects } = setup;
  // SSGI + SSR + TRAA scenes need all five attachments (40 bytes/sample, over WebGPU's default 32)
  const renderer = new WebGPURenderer({
    canvas,
    antialias: false,
    trackTimestamp,
    requiredLimits: { maxColorAttachmentBytesPerSample: 64 },
  } as AnyNode);
  for (const [lightNode, light] of forkLights) renderer.library.addLight(lightNode, light);
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

  const renderPipeline = createPipeline(renderer, setup, variant);
  let frames = 0;
  const handle: LiveRenderer = {
    name: variant.name,
    renderer: renderer as AnyNode,
    get frames() {
      return frames;
    },
    render() {
      renderPipeline.render();
      frames++;
    },
    setSize(w, h) {
      setRenderSize(renderer, camera, w, h);
    },
    setCamera(newCamera) {
      if (newCamera !== camera) camera.copy(newCamera);
    },
    dispose() {
      renderPipeline.dispose();
      releaseScene();
      renderer.dispose();
    },
  };
  handle.setSize(width, height);
  return handle;
}
