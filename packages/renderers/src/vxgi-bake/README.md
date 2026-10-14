# Retained light-baking sources

These inherited three-fidelity research sources are not used by the active SSR scene registry or renderer catalogue. They remain available for development; three-ssr-fidelity currently compares screen-space reflections against a path-traced reference.

LightMapper.js, VXGIIrradiance.js and unwrapUVs.js originate from [Three.js PR #34991](https://github.com/mrdoob/three.js/pull/34991), at bhouston/three.js commit `afffb03157212f7bcf413cede8f97b470abf4c09` (MIT). remapAttribute.js extracts the upstream BufferGeometryUtils helper.

VXGIConeTracer.js and potpack.module.js come from fork commit `83c310af72715ae558beea12d169f00c62ea48eb`. Imports are local. potpack retains its ISC notice in the source header; other source notices and the repository LICENSE remain applicable.
