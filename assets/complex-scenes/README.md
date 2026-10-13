# Retained complex-scene assets

These fixtures were imported by three-fidelity and are not selected by the active ten-scene SSR suite. The active textured scene is the upstream steampunk camera; synthetic reflection diagnostics load no external models.

The retained fixtures preserve original materials and cameras. Preprocessing added a scene-wide secondary-UV lightmap atlas, split shared mesh instances, repaired degenerate UV islands and recompressed geometry with Draco. Textures were retained. The generation manifest records hashes, atlas padding and validation results. Regeneration is handled by `scripts/preunwrap-scenes.mjs` with populated source asset submodules.

## Attribution and licenses

These assets are third-party content and are not covered by this repository's MIT
license. Their licenses permit redistribution and modification. CC BY assets require
crediting the author, linking the license, and indicating modifications; retain this
file and the `licenses/` directory when redistributing the fixtures. The modifications
to all models are the UV atlas generation and geometry compression described above.

| File                      | Model                 | Author         | License                                                       | Original source                                                                                                    |
| ------------------------- | --------------------- | -------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| bedroom.glb               | Bedroom               | SlykDrako      | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Bitterli rendering resources](https://benedikt-bitterli.me/resources/)                                            |
| breakfast-room.glb        | The Breakfast Room    | Wig42          | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)     | [Bitterli rendering resources](https://benedikt-bitterli.me/resources/)                                            |
| coffee-maker.glb          | Coffee Maker          | cekuhnen       | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)     | [Bitterli rendering resources](https://benedikt-bitterli.me/resources/)                                            |
| contemporary-bathroom.glb | Contemporary Bathroom | Mareck         | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Bitterli rendering resources](https://benedikt-bitterli.me/resources/)                                            |
| country-kitchen.glb       | Country Kitchen       | Jay-Artist     | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)     | [Bitterli rendering resources](https://benedikt-bitterli.me/resources/)                                            |
| grey-and-white-room.glb   | The Grey & White Room | Wig42          | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)     | [Bitterli rendering resources](https://benedikt-bitterli.me/resources/)                                            |
| headphone-with-stand.glb  | Headphone with stand  | Halil Kantarci | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)     | [Sketchfab](https://sketchfab.com/3d-models/headphone-with-stand-4ffedc9bffad4a549f6e0a46b0f92b05)                 |
| transmission-test.glb     | Transmission Test     | Adobe (2020)   | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/TransmissionTest) |

The first seven source files were copied from the sibling project's
[`3d-demo-data`](https://github.com/gkjohnson/3d-demo-data) submodule, which already
converted their geometry to Draco and their textures to WebP. The upstream attribution
documents are preserved in `licenses/`. The headphone's CC BY 4.0 license was confirmed
through the [original Sketchfab model API](https://api.sketchfab.com/v3/models/4ffedc9bffad4a549f6e0a46b0f92b05).
TransmissionTest came from the sibling project's `glTF-Sample-Assets` submodule;
its upstream license notice is also retained. Its model is CC0, while its accompanying
license documentation is CC BY 4.0. Licenses do not grant rights to logos or trademarks.
