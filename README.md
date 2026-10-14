# three-ssr-fidelity

A [fidelity-kit](https://github.com/bhouston/fidelity-kit) project for evaluating Three.js screen-space reflection changes before proposing them upstream.

It supplies twelve reflection scenes, a path-traced reference, pinned Three.js dev and independent SSR proposal renderers. Fidelity-kit captures and scores their images, records hardware performance runs, and provides the fidelity, performance and live comparison views.

The Cornell fixtures include `cornell-box-metallic` (a cone and a perfect mirror sphere) and `cornell-box-mirror` (two boxes and a planar mirror back wall), preserving the scenes from three-fidelity. The sphere fixture is the source project's single mirror-ball Cornell test; the planar mirror provides a second reflection comparison.

The suite also reproduces the full reflection pipeline and its individual feature-removal comparisons. These show conditional contributions; their gains cannot be added together or treated as standalone PR improvements.

[Open the viewer](https://three-ssr-fidelity.ben3d.ca) · [Renderers and reproduction](docs/SSR-EXPERIMENTS.md) · [Contributing](CONTRIBUTING.md)

Derived from [three-fidelity](https://github.com/bhouston/three-fidelity), under the MIT license. Renderer source pins and third-party notices are retained with their implementations.
