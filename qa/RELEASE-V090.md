# Web v0.9.0 three-dimensional architecture evidence

## Observable change

- The WebGL village and outskirts now contain four real Three.js houses, matching all four collision footprints and minimap blocks.
- Each house retains volumetric foundations, walls, roof geometry, individual roof courses, beams, windows, chimney, props and lighting.
- The facade door is now a separate shadow-casting mesh attached to a hinge pivot. It opens smoothly when the hero is within 3.35 world units and closes at distance.
- Three chimney wisps per house rise, expand and fade in world space. Reduced-motion mode uses a bounded static presentation.
- The Canvas renderer remains the labeled HD-2D 2.5D compatibility path.

## Fresh verification before publication

- `node --test tests/web-runtime.test.cjs`: 16/16 PASS. The new test checks near/far door response, reduced-motion snapping, rotation and bounded smoke position, scale and opacity.
- `node tests/playthrough.cjs`: campaign victory in 225.18 simulated seconds; Fangborn trial victory in 41.48 simulated seconds.
- All 15 inline scripts parse, all seven embedded PNG sheets remain present and no external startup dependency was introduced.
- `git diff --check`: PASS.
- HTML: 19,967,753 bytes; SHA-256 `6c2838d90b3e51e6bf6651bd66350f289176777a641ce80b92e8892f901aefa9`.

## Browser gate

Pending public deployment. The controlled inspection browser disables WebGL, so it can verify loading, save compatibility and the Canvas fallback, but it cannot be used as visual proof of the GPU-only hinged door and smoke path.

## Rollback

Use a normal Git revert. Save schema and gameplay state are unchanged in v0.9.0.
