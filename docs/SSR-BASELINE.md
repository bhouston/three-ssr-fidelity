# Initial SSR baseline

The initial suite contains ten distinct scenes and two active renderer adapters.
Upstream Three.js dev is pinned at `286e2d8cba7088982eb9068d4bb8f68e42c3bf67`.
The baseline follows the stock additive SSR composition with stochastic GGX and
TRAA; it does not use the inherited experimental NewSSRNode or SSGI.

Fidelity captures use seed 1, 4096 completed path-tracer samples and the registry's
fixed SSR frame budget. Captures stop at the exact sample target and drain the GPU
before screenshot readback. Quality scores and difference images are regenerated
by fidelity-kit from the committed AVIF images during site builds.

The Windows001 performance session contains 20 successful workloads: both renderers
on every scene, measured sequentially for ten seconds after warmup, at 480×360,
with vsync and frame caps disabled and GPU queue completion accounted for. Adapter
metadata confirms NVIDIA RTX 3060 Ti through WebGPU for Three.js dev and WebGL/D3D11
for the path tracer. Path-tracer throughput counts samples, not converged images.

The first performance session was captured from the initial implementation's working
tree before its first commit. Its raw `environment.gitCommit` identifies the inherited
parent, not a clean committed SSR suite. The registry and upstream baseline adapter
match the initial implementation commit `1f1f410efc2`; subsequent changes restrict
the factory and batch fidelity capture without changing benchmark rendering.

This is a shared swarm host without an exclusive GPU reservation. These measurements
establish an initial baseline; rerun isolated measurements when making final performance
claims for a Three.js PR. Preserve raw reports and adapter provenance when adding variants.
