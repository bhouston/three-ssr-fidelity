# Hi-Z traversal comparisons

Eight fork renderers compare linear marching, conservative Hi-Z, and adaptive cell traversal in both mirror and stochastic GGX modes, plus adaptive mip-1 variants that stop at a coarser hierarchy level. All variants share one scene pass, material inputs, camera, resolution, requested `binaryRefine=true` setting, denoising and 64-frame capture history. Each hierarchy reads the exact same depth node supplied to SSR. Linear variants do not build a hierarchy. Adaptive traversal solves leaf depth planes instead of running the legacy binary-refinement loop. It changes hit selection and work limits; it is an opt-in quality/performance tradeoff.

The GGX controls use TRAA over 64 frames and do not reproduce the castle demo’s recurrent denoising/environment fallback chain. Relative differences isolate traversal within this pipeline. The existing custom `NewSSRNode` Hi-Z/capped-march experiments remain independent; these eight profiles exercise the fork’s `SSRNode`.

The fixed `three-dev` and vendored experiment baselines remain independent. The `hiz-mirror` and `hiz-ggx` presets compare against the corresponding fork linear renderer; `hiz-pathtracer` compares all eight against pathtraced references.

After installing and building the pinned code submodules, run from the repository root:

```powershell
pnpm build
pnpm --filter @three-fidelity/playground build --outDir ../../render-site
pnpm render:experiments --renderers 'three-hiz-*' --scenes 'diag-*'
pnpm performance:process
node scripts/report-hiz-comparisons.mjs
pnpm performance:run --collection hiz
node scripts/report-hiz-performance.mjs performance-results/<machine>/<run>
```

The capture script fixes seed 1 and 64 completed frames in a fresh page per variant, checks the physical GPU adapter, and stores adapter provenance. Existing diagnostic pathtrace references are reused; capture those with the normal render CLI if missing. The diagnostic scene presets use quality 0.5. The performance collection runs each diagnostic/variant sequentially for 10 seconds at 480×360 with vsync disabled by the runner. GPU-completed throughput is the relevant performance measure; image quality does not imply a speedup.

The direct comparison report writes per-scene PSNR, MSE, changed channel fraction and maximum delta against both matching linear and pathtrace images, plus `*.delta8.png` (absolute RGB difference ×8). Identical images have null PSNR and `identical: true`, avoiding non-JSON infinity. Captures preserve lossless screenshots under `$SWARM_ARTIFACTS/hiz-captures/<scene>/<renderer>.png`. The direct report uses these PNGs for matching-linear comparisons when both are present (optionally pass the artifact directory as its second argument). Pathtrace comparisons and the regular viewer use decoded AVIF quality-90 captures, so small codec differences are included; each direct report row records its encoding. Examine local differences as well as PSNR: full-image PSNR can conceal missing narrow reflection features. The regular fidelity processor supplies viewer metrics and delta images, while this report makes the matched linear contract explicit.

The isolated `three-hiz` submodule pins the new fork without changing the suite’s original `three.js` core or existing custom SSR pipeline. [Measured quality and throughput](SSR-HIZ-RESULTS.md) include the tradeoffs and representative local artifacts.
