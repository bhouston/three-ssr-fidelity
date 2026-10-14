# Temporal antialiasing for SSR experiments

This directory supplies the final TRAA resolve used by the full reflection pipeline and its feature-removal comparisons in three-ssr-fidelity. The stock dev and independent PR renderers use their pinned upstream TRAA.

TRAANode.js and TAAUtils.js come from the MIT-licensed [Three.js fork](https://github.com/bhouston/three.js/tree/83c310af72715ae558beea12d169f00c62ea48eb/examples/jsm/tsl), commit `83c310af72715ae558beea12d169f00c62ea48eb`. Local changes express neighborhood traversal with TSL loops while preserving traversal order and progressive accumulation.

TRAA remains enabled when the dedicated reflection filter is removed, so that comparison isolates the reflection filter rather than final antialiasing.
