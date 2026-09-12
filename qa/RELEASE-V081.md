# Web v0.8.1 rendering correction evidence

## Root cause

The WebGL/Three.js HD-2D world and real 3D buildings were still present. The inspection browser disables WebGL, so the runtime correctly entered its Canvas compatibility renderer. That renderer still used four flat rectangles as early building placeholders, creating an unacceptable visual downgrade and a misleading screenshot.

## Correction

- Three.js remains the preferred path and is unchanged: real meshes, perspective camera, light, shadows and postprocessing are used whenever WebGL is available.
- Canvas compatibility structures now have projected foundations, cast shadows, front and side walls, roof depth, roof detail, structural beams, framed windows, doors and zone palette integration.
- Zone 1/3/4 use dedicated sewer, fortress and rift-shrine silhouettes instead of reusing village houses.
- The Web control panel identifies `三维渲染 · HD-2D` or `兼容渲染 · HD-2D 2.5D`, so a constrained browser no longer silently looks like the primary renderer.

## Verification before publication

- `node --test tests/web-runtime.test.cjs`: 15/15 PASS. The added renderer test exercises all five zone structure routes and verifies polygon depth, curved pipework, masonry detail and shadows are emitted.
- `node tests/playthrough.cjs`: campaign victory 225.18 simulated seconds; Fangborn trial victory 41.48 simulated seconds. Logic results are unchanged.
- All 15 inline scripts parse, all seven embedded PNG sheets remain present and the page has no external startup dependency.
- HTML: 19,965,686 bytes; SHA-256 `711fe660e78903cf09ff7067a3da529ecb1205311be4fadca77644a6532964fe`.

## Browser gate

Pending publication and in-context screenshot inspection. Canvas evidence must remain labeled compatibility output and must not be represented as real WebGL/GPU evidence.

## Rollback

Use a normal Git revert. No save schema, gameplay state or asset bytes changed in v0.8.1.
