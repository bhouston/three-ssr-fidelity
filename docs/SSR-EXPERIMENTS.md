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
