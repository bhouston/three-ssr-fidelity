# SSR renderer comparisons

The twelve-scene registry is shared by fidelity-kit capture, performance and live views.
The path-tracer reference uses 4096 samples. Screen-space captures use native scene
dimensions, seed 1 and 64 completed frames, with SSGI disabled and TRAA retained.

## Independent proposals

`three-dev` preserves the pinned upstream stochastic GGX baseline. Each proposal
loads its own pinned source; no proposal renderer combines unrelated patches.

| Renderer                     | Change                                                                                            | Matched control  |
| ---------------------------- | ------------------------------------------------------------------------------------------------- | ---------------- |
| three-dev-pr28-normal-bias   | [PR #28](https://github.com/bhouston/three.js/pull/28): depth-scaled normal offset                | three-dev        |
| three-dev-pr29-ray-guard     | [PR #29](https://github.com/bhouston/three.js/pull/29): invalid-ray rejection and grazing bound   | three-dev        |
| three-dev-pr30-sampling-docs | [PR #30](https://github.com/bhouston/three.js/pull/30): comments only                             | three-dev        |
| three-dev-pr32-dielectric    | [PR #32](https://github.com/bhouston/three.js/pull/32): dielectric mirror Fresnel                 | three-dev-mirror |
| three-dev-pr33-back-depth    | [PR #33](https://github.com/bhouston/three.js/pull/33): optional back-face depth validation       | three-dev        |
| three-dev-pr34-radiance-hook | [PR #34](https://github.com/bhouston/three.js/pull/34): material radiance API, stock SSR provider | three-dev        |

The mirror control enables dielectric reflections with the same composition and
settings as PR #32. Its fix does not affect GGX mode. PR #30 cannot change executable
shader behavior. PR #34 is an API foundation: the stock provider does not supply
incoming reflection radiance to the hook, so this capture does not claim the gains
of a complete radiance-based SSR implementation.

PR source commits are recorded in [sources.json](../packages/renderers/src/ssr-pr/sources.json).
The five SSR nodes retain upstream code, with only module imports and formatting
adapted. PR #34 uses its own pinned `submodules/three-pr34` runtime. The shared dev
runtime is pinned at `286e2d8cba7088982eb9068d4bb8f68e42c3bf67`; its SSRNode matches
the proposals' base `e615266e7647f0a062219d55e79913237594b6b7`.

## Opt-in power-lobe investigation

The `ssr-power-lobe` comparison preset adds four methods from
[three.js PR #72](https://github.com/bhouston/three.js/pull/72). The default `ssr`
preset, existing source pins and path-traced reference images remain unchanged.

| Method                     | Estimator                          | SSR filtering               | Matched estimator control             |
| -------------------------- | ---------------------------------- | --------------------------- | ------------------------------------- |
| three-pr72-ggx-raw         | Stock stochastic GGX               | None                        | Baseline for this runtime/composition |
| three-pr72-ggx-recurrent   | Stock stochastic GGX               | Existing temporal/recurrent | Raw GGX for filter-only comparison    |
| three-pr72-power-raw       | Biased power lobe, projected steps | None                        | three-pr72-ggx-raw                    |
| three-pr72-power-recurrent | Biased power lobe, projected steps | Existing temporal/recurrent | three-pr72-ggx-recurrent              |

All four use the same isolated `submodules/three-pr72` runtime, scene, full native
trace resolution, one ray, 16-step budget, authored absolute reach/thickness and
intensity, disabled radiance clamp, and non-jittered final TRAA. The power seed is
1; it does not control stock noise. A separate opaque pass supplies matching
geometry and unexposed linear HDR beauty. Power samples its own reprojected
previous opaque color; stock samples current opaque color. Transparent beauty is
added downstream and never enters power's history. SSGI and SSR multibounce are off.

Both estimators receive the same 512×256 linear HDR equirectangular environment,
baked from the authored environment using a 256-pixel cube. This conversion is
necessary because stock SSR requires CPU equirectangular data and rejects PMREM.
The bake uses the inverse of SSR's `equirectUV`, verified on hardware with six
cardinal directions and an oblique direction in an asymmetric HDR environment.
If a caller already supplies a CPU-readable HDR equirectangular scene environment,
both methods borrow it without disposing it; unsupported borrowed maps throw
instead of silently removing miss fallback.
Beauty retains its existing diffuse environment lighting; its indirect specular
is suppressed only in the isolated experimental runtime so fallback is not applied
twice. Scenes without SSR are explicitly rejected. GGX's native BRDF weights,
edge fade, distance scaling, thickness acceptance and step distribution still
differ from the alternative. Matching numeric budgets does not make the methods
quality-equivalent. Compare within this four-method group before using the older
`three-dev` captures, which have different runtime/composition defaults.

Power is deliberately **biased**, not GGX VNDF or an unbiased Monte Carlo BRDF
estimator: restricted Ey and missing BRDF/PDF correction change energy/lobe shape.
It normalizes over valid launched samples, including environment misses, and
applies approximate Fresnel once. Its weighted RGB/ray-distance output feeds the
unchanged specular temporal/recurrent adapter. Coverage, hit distance and filter
inverse-age alpha remain distinct. Raw means no SSR filter; final TRAA is retained
on both sides. No moments/à-trous denoiser is added.

Limitations include single-depth screen-space misses/false hits, one-frame incident
lighting lag, conservative history rejection for depth-moving objects, a
representative multi-ray distance adapter and approximate additive glass layering.
The static captures measure one pose/seed after 64 completed frames; they do not
establish motion quality or speed. Full-frame RGB8 PSNR can hide local reflection
errors. Inspect images/differences against the existing 4096-sample references.

To regenerate only this investigation after the standard build steps:

```powershell
pnpm render:experiments --renderers three-pr72-ggx-raw,three-pr72-ggx-recurrent,three-pr72-power-raw,three-pr72-power-recurrent
pnpm exec fidelity-kit process fidelity-results --performance-root performance-results
node scripts/report-ssr-experiments.mjs
pnpm site:build
```

Run `node scripts/verify-ssr-environment.mjs` to check the shared bake's direction,
row orientation and values above one on a physical WebGPU adapter. It rejects
software adapters and writes a report when `SWARM_ARTIFACTS` is set.

## Conditional contributions

`three-ssr-full` reproduces the reflection pipeline from the
[contributions report](https://github.com/bhouston/three-fidelity/blob/8a797865611/docs/research/SSR-CONTRIBUTIONS.md).
Its source is pinned to three-fidelity commit `8a797865611` and the Three.js fork
`83c310af72715ae558beea12d169f00c62ea48eb`.

Each additional `three-ssr-*` renderer removes one feature: environment replacement,
reflection filtering, hit-specular handling, back-depth validation, Hi-Z, full GGX
sampling, long ray reach or distance-fade removal. The 32-step capped march is compared
with uncapped linear marching (`three-ssr-no-hiz`), so both sides disable Hi-Z.

These are leave-one-out comparisons within the full pipeline. Benefits are conditional
and cannot be summed or presented as standalone PR gains. Final TRAA remains active
in the no-filter variant. All variants are scored against the same path-tracer reference;
the report compares their per-scene PSNR differences using the matched controls above.

## Reproduce

Use Node 26 and pnpm 11.0.8. Initialize the code submodules listed by the deployment
workflow through git-dedup, then run:

```powershell
pnpm install --frozen-lockfile
pnpm build
node scripts/build-render-server.mjs
pnpm render:experiments
pnpm exec fidelity-kit process fidelity-results --performance-root performance-results
node scripts/report-ssr-experiments.mjs
pnpm site:build
```

`render:experiments` accepts `--renderers`, `--scenes` and `--missing-only`. It verifies
the actual WebGPU adapter, rejects software fallbacks and shader errors, and records
capture provenance in `SWARM_ARTIFACTS` when set. Reuse the committed path-tracer
references unless scene content or cameras change. Regenerate them with `pnpm render`
when needed.

The Cornell reflection scenes preserve three-fidelity's authored geometry, camera and
materials: `cornell-box-metallic` has a cone and perfect mirror sphere;
`cornell-box-mirror` has two boxes and a planar mirror back wall. Both use 640×480
captures with the same 64-frame SSR and 4096-sample reference budgets. To regenerate
all fidelity images for these scenes:

```powershell
pnpm render --scenes cornell-box-metallic,cornell-box-mirror --renderers three-gpu-pathtracer
pnpm render:experiments --scenes cornell-box-metallic,cornell-box-mirror
pnpm exec fidelity-kit process fidelity-results --performance-root performance-results
```

SSGI remains disabled by the SSR adapters, so these Cornell comparisons measure
reflections with direct lighting rather than the source project's SSGI pipeline.

The opt-in performance collection is available through
`pnpm performance:run --collection experiments`. Fidelity scores alone establish no
performance benefit; use sequential GPU-completed runs on an isolated physical GPU.
Full-frame RGB8 PSNR can conceal local reflection regressions. Inspect difference images
alongside scores; these captures are static views with one seed.
