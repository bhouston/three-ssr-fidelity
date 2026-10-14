import { browserAssetUrl } from './asset-paths.js';
import { loadBrowserLDraw, loadBrowserCollada } from './legacy-browser.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RGBAKTX2Loader } from './ktx2.js';
import { ssrScenes } from './ssr.js';
import { ssrDiagnosticScenes } from './ssr-diagnostics.js';
import { ssgiScenes } from './ssgi.js';
import type { SceneContext, SceneDefinition } from './types.js';

export type * from './types.js';
export * from './lifecycle.js';
export { ANIMATED_POSE_TIME } from './ssgi.js';

const scenes = new Map<string, SceneDefinition>(
  [...ssrScenes, ...ssrDiagnosticScenes, ...ssgiScenes]
    .filter((scene) =>
      [
        'diag-mirror',
        'diag-rough-30',
        'diag-dielectric-30',
        'diag-grazing',
        'diag-offscreen',
        'diag-occlusion',
        'diag-wall',
        'diag-sphere',
        'diag-metal-hit',
        'steampunk-camera',
        'cornell-box-metallic',
        'cornell-box-mirror',
      ].includes(scene.name),
    )
    .map((scene) => [scene.name, scene]),
);

export function listSceneNames(): string[] {
  return [...scenes.keys()];
}

export function getScene(name: string): SceneDefinition {
  const scene = scenes.get(name);
  if (!scene) throw new Error(`Unknown scene "${name}". Available: ${listSceneNames().join(', ')}`);
  return scene;
}

/** Browser context: `baseUrl` serves the contents of `submodules/three.js/examples/` (e.g. '/three-examples/'). */
export function createBrowserSceneContext(baseUrl: string, assetsBaseUrl = '/suite-assets/'): SceneContext {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const dracoLoader = new DRACOLoader().setDecoderPath(`${base}jsm/libs/draco/`);
  const loader = new GLTFLoader()
    .setDRACOLoader(dracoLoader)
    .setKTX2Loader(new RGBAKTX2Loader().setTranscoderPath(`${base}jsm/libs/basis/`))
    .setMeshoptDecoder(MeshoptDecoder);
  const assets = assetsBaseUrl.replace(/\/$/, '') + '/';
  const resolveAsset = (asset: string) => browserAssetUrl(asset, base, assets);
  return {
    loadGLTF: (asset) => loader.loadAsync(resolveAsset(asset)),
    loadHDR: (asset) => new HDRLoader().loadAsync(resolveAsset(asset)),
    loadLDraw: (asset) => loadBrowserLDraw(resolveAsset(asset), resolveAsset('@/submodules/ldraw-parts-library/')),
    loadCollada: (asset) => loadBrowserCollada(resolveAsset(asset)),
  };
}
