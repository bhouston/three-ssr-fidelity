# three-ssr-fidelity

A focused base for evaluating Three.js SSR PRs, derived from [three-fidelity](https://github.com/bhouston/three-fidelity) under its MIT license. Compare **three-gpu-pathtracer** ground truth with **upstream Three.js dev**, using stochastic GGX SSRNode, non-metal reflections and TRAA.

Upstream dev is pinned to `286e2d8cba7088982eb9068d4bb8f68e42c3bf67` as `submodules/three-dev`, with its own TSL module stack. The inherited Three.js fork supplies shared scene objects and the path tracer. The baseline uses upstream SSRNode; SSGI is disabled so SSR changes can be evaluated independently.

## Scenes

The same 10 scenes are used for fidelity, performance and live views:

| Scene              | Purpose                                               |
| ------------------ | ----------------------------------------------------- |
| diag-mirror        | Sharp planar reflection control                       |
| diag-rough-30      | Broad stochastic GGX lobe                             |
| diag-dielectric-30 | Dielectric Fresnel and non-metal reflections          |
| diag-grazing       | Low-angle depth precision and stretching              |
| diag-offscreen     | Missing screen-space information and edge behavior    |
| diag-occlusion     | Hidden surfaces, thin geometry and thickness          |
| diag-wall          | Vertical reflector                                    |
| diag-sphere        | Curved normals                                        |
| diag-metal-hit     | View-dependent radiance and secondary reflections     |
| steampunk-camera   | Authored metal and roughness textures in a real model |

Minor roughness variants, white-material duplicates and unrelated GI scenes are excluded. Inherited research files remain available, but public selectors expose only this suite and its two renderers. Historical captures are removed because they do not represent this upstream baseline.

## Run

Use Node 26 and pnpm 11.0.8:

```powershell
git-dedup.cmd submodule update --init submodules/three.js submodules/three-dev submodules/three-gpu-pathtracer submodules/fidelity-kit submodules/fidelity-kit-blender submodules/fidelity-kit-three-gpu-pathtracer
pnpm install --frozen-lockfile
pnpm build
pnpm live
node scripts/build-render-server.mjs
pnpm render
pnpm performance:run
pnpm exec fidelity-kit process fidelity-results --performance-root performance-results
pnpm site:build
node scripts/build-render-server.mjs --out site/render
```

Captures require a physical GPU; software adapters are rejected. Performance runs disable vsync/frame caps, warm up, run sequentially for ten seconds per scene/renderer, and count GPU-completed frames. A path-tracer frame is a sample, not a converged image; fidelity uses 4096 reference samples. Reports retain machine and adapter metadata. Fidelity uses canonical scene dimensions; performance uses a common 480×360 workload.

Add future SSR variants as separate adapters and registry entries, preserving the pinned baseline. Keep scene additions distinct and the suite at 20 scenes or fewer. Regenerate quality and performance results for each variation.

## Deployment

GitHub Pages publishes the viewer and browser render host at https://three-ssr-fidelity.ben3d.ca. `CNAME` and `registry.json` configure the hostname. The owner must configure DNS to GitHub Pages. The workflow supports manual deployment of review branches and deployment on main.

Validation: `pnpm build`, `pnpm tsc`, `pnpm lint`, `pnpm test --coverage`, and `pnpm audit --audit-level=high`. See [CONTRIBUTING.md](CONTRIBUTING.md).
