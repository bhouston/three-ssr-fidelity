# Hi-Z traversal comparisons

Six fork renderers compare linear marching, conservative Hi-Z, and adaptive cell traversal in both mirror and stochastic GGX modes. All variants share one scene pass, material inputs, camera, resolution, binary refinement, denoising and 64-frame capture history. Each hierarchy reads the exact same depth node supplied to SSR. Linear variants do not build a hierarchy. Adaptive traversal changes hit selection and work limits; it is an opt-in quality/performance tradeoff.

The fixed `three-dev` and vendored experiment baselines remain independent. The `hiz-mirror` and `hiz-ggx` presets compare against the corresponding fork linear renderer; `hiz-pathtracer` compares all six against pathtraced references.

After installing and building the pinned code submodules, run from the repository root:

```powershell
pnpm build
pnpm --filter @three-fidelity/playground build
pnpm render:experiments --renderers 'three-hiz-*' --scenes 'diag-*'
pnpm performance:process
node scripts/report-hiz-comparisons.mjs
pnpm performance:run --collection hiz
```

The capture script fixes seed 1 and 64 completed frames in a fresh page per variant, checks the physical GPU adapter, and stores adapter provenance. Existing diagnostic pathtrace references are reused; capture those with the normal render CLI if missing. The performance collection runs each diagnostic/variant sequentially for 10 seconds at 480×360 with vsync disabled by the runner. GPU-completed throughput is the relevant performance measure; image quality does not imply a speedup.

The direct comparison report writes per-scene PSNR, MSE, changed channel fraction and maximum delta against both matching linear and pathtrace images, plus `*.delta8.png` (absolute RGB difference ×8). Identical images have null PSNR and `identical: true`, avoiding non-JSON infinity. Metrics decode the same AVIF capture files shown by the viewer, so small compression effects are included. Examine local differences as well as PSNR: full-image PSNR can conceal missing narrow reflection features. The regular fidelity processor supplies viewer metrics and delta images, while this report makes the matched linear contract explicit.
