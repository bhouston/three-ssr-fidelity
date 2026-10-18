import { createHiZRenderer } from './three-hiz.js';
import { ssrExperimentProfiles, isSSRExperiment } from './ssr-experiments.js';
import { stockSSRFactories } from './ssr-pr/index.js';
import { createThreeNewRenderer } from './three-new.js';
import { createRadianceHookRenderer } from './three-pr34.js';
import { createDevRenderer } from './three-dev.js';
import type { SceneInstance } from '@three-fidelity/scenes';
import { createRenderer as createPathTracerRenderer } from 'fidelity-kit-three-gpu-pathtracer';
import { hierarchyExperiments, ssrTemporalProfiles } from './types.js';
import { createRendererProfiler } from './profiling.js';
import type { LiveRenderer, RendererName, RendererOptions } from './types.js';

export * from './types.js';
export * from './helpers.js';
export * from './profiling.js';
export * from './startup.js';

export function createRenderer(
  name: RendererName,
  canvas: HTMLCanvasElement,
  setup: SceneInstance,
  options: RendererOptions,
): Promise<LiveRenderer> {
  if (options.hierarchyExperiment !== undefined && !hierarchyExperiments.includes(options.hierarchyExperiment)) {
    throw new Error(`Unknown hierarchical experiment "${options.hierarchyExperiment}"`);
  }
  if (options.hierarchyExperiment && options.hierarchyExperiment !== 'baseline' && name !== 'three-new') {
    throw new Error('Hierarchical experiments require the three-new renderer');
  }
  if (options.ssrTemporalProfile !== undefined && !ssrTemporalProfiles.includes(options.ssrTemporalProfile)) {
    throw new Error(`Unknown SSR temporal profile "${options.ssrTemporalProfile}"`);
  }
  if (options.ssrTemporalProfile && name !== 'three-new') {
    throw new Error('SSR temporal profiles require the three-new renderer');
  }
  const instrument = (result: Promise<LiveRenderer>): Promise<LiveRenderer> => {
    if (!options.trackTimestamp) return result;
    return result.then((live) => {
      const profiler = createRendererProfiler(live.renderer);
      const dispose = live.dispose.bind(live);
      return {
        name: live.name,
        renderer: live.renderer,
        get frames() {
          return live.frames;
        },
        get lightBake() {
          return live.lightBake;
        },
        get virtualLights() {
          return live.virtualLights;
        },
        getCompletedSamples: live.getCompletedSamples?.bind(live),
        setSampleLimit: live.setSampleLimit?.bind(live),
        profiler,
        render: live.render.bind(live),
        setSize: live.setSize.bind(live),
        setCamera: live.setCamera.bind(live),
        dispose() {
          try {
            profiler.dispose();
          } finally {
            dispose();
          }
        },
      };
    });
  };
  if (isSSRExperiment(name)) {
    const profile = ssrExperimentProfiles[name];
    if (profile.kind === 'hiz') return instrument(createHiZRenderer(canvas, setup, options, { ...profile, name }));
    if (profile.kind === 'stock')
      return instrument(
        createDevRenderer(canvas, setup, options, {
          name,
          stochastic: profile.stochastic,
          ssrFactory: profile.proposal === null ? undefined : stockSSRFactories[profile.proposal],
          backDepth: profile.proposal === 33,
        }),
      );
    if (profile.kind === 'hook') return instrument(createRadianceHookRenderer(canvas, setup, options));
    return instrument(
      createThreeNewRenderer(
        canvas,
        { ...setup, effects: { ...setup.effects, ssgi: undefined } },
        options,
        undefined,
        profile.contribution,
      ),
    );
  }
  switch (name) {
    case 'three-dev':
      return instrument(createDevRenderer(canvas, setup, options));
    case 'three-gpu-pathtracer':
      return instrument(
        createPathTracerRenderer({
          canvas,
          scene: setup.scene,
          camera: setup.camera,
          ...options,
          toneMapping: setup.effects.toneMapping,
          toneMappingExposure: setup.effects.toneMappingExposure,
          outputColorSpace: 'srgb',
          environment: setup.environment ? { scene: setup.environment.scene } : undefined,
          gradientBackground: setup.gradientBackground,
        }),
      );
    default:
      throw new Error(`Unknown renderer "${name}"`);
  }
}
