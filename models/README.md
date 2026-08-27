# InstaBuilt — 3D house models

This folder is where real `.glb` / `.gltf` models live, one per house variant.

## Current state (placeholder)

The 3D configurator currently renders a **procedural placeholder house** built
from Three.js primitives (`js/house-configurator.js`). No `.glb` files are
required — the interaction (orbit, walkthrough, material swaps, save) works
end-to-end out of the box.

## Swapping in real models

1. Export each InstaBuilt variant to `.glb` (from CAD/BIM via Blender, or have
   a modeler build simplified models from floor plans/photos). Keep them small
   — target **≤ 1–2 MB** each, with draco/meshopt compression where possible.
2. Drop the files here, e.g. `models/popup-28.glb`.
3. Add a `glb` path to the relevant entry in `js/models-config.js`:
   ```js
   { id: 'popup', label: 'POP UP Solutions', shape: 'flat', storeys: 1,
     sizes: ['28 m²', '52 m²', '104 m²'], glb: 'models/popup-28.glb' }
   ```
4. In `js/house-configurator.js`, add a `GLTFLoader` branch that loads the
   model when `config.line.glb` is set (falling back to the procedural house
   on error). `three/addons/loaders/GLTFLoader.js` is available via the same
   import map used across the configurator.

Nothing else in the UI, modes, or save flow needs to change.
