# Web v0.8 release evidence

## Scope

Desktop Web combat-depth update on the existing self-contained Three.js/Canvas runtime. It preserves all v0.7 art, animation, campaign, trial, progression, save key and compatibility behavior.

## Implemented

- A 0.30-second precision-dodge window attached to Q dash. One dash can reward at most one actual avoided hit.
- Every precision dodge grants 16 ultimate energy, removes one second from pulse cooldown, adds 75 score and emits a visible callout/effect.
- Boss attacks carry their source through direct telegraphs, charges and spawned projectiles. Three precision dodges against a boss reset its guard, cancel its outstanding telegraphs/projectiles and open a 2.5-second stagger window.
- Bosses take 35% extra damage while staggered. Boss HUD displays guard progress or remaining stagger time. End screen includes perfect-dodge and boss-break counts.
- Old saves migrate missing dodge state, statistics, boss guard and stagger fields without changing the save key or requiring a reset.

## Verification before publication

- `node --test tests/web-runtime.test.cjs`: 14/14 PASS. Tests cover single-reward behavior, ordinary invulnerability separation, three-dodge boss break, attack cancellation, 35% stagger damage, old-save migration, corruption rejection and save/reload persistence in addition to all v0.7 regressions.
- `node tests/playthrough.cjs`: five-zone story campaign reaches victory at 225.18 simulated seconds with 14 supplies broken and a maximum chain of 21. The unlocked Fangborn trial reaches victory at 41.48 simulated seconds. Both use public APIs with no hero-position, health, level, unlock or reward injection; the driver does not attempt precision dodges, so both report zero rather than fabricating coverage.
- All inline scripts parse. The runtime remains self-contained with 15 classic inline scripts, seven embedded PNGs and no external startup dependency.
- All seven embedded PNG SHA-256 hashes match v0.7 byte-for-byte. HTML is 19,960,169 bytes with SHA-256 `20920a5732c0d8ec89a83a425af62f00fd6513275f6a995af1a26f23cfca5eb0`.

## Remaining publication gates

- Confirm deployed HTML checksum equals the local runtime.
- Operate the published page, verify v0.8 menu/load/save and inspect browser diagnostics.
- WebGL/GPU visual evidence remains separate when the controlled browser cannot create a WebGL context; Canvas fallback evidence must not be presented as GPU proof.

## Rollback

Use a normal Git revert. Do not force-push or clear `devourHD2D.v1`; v0.8 preserves the schema version and adds only optional validated runtime fields.
