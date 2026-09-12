# Web v0.7 release evidence

## Scope and provenance

Desktop Web update, not a separate mobile build. Recovered the complete editable inline runtime and embedded assets from public release afbc63a after workspace maintenance removed the former source checkout. This repository's index.html is now the canonical self-contained runtime. Tests execute its actual modules.

## Implemented

- Six destructible supplies per campaign region; heal/essence/XP rewards require pickup. Melee respects facing/reach, pulse and ultimate affect nearby props. Broken state persists. Trial excludes props.
- Applied-damage numbers; finisher emphasis; four-second devour chain, reset on injury/timeout, capped extra ultimate gain from the third kill. Cosmetic numbers stay within the existing 180-effect bound, with at most 32 visible labels.
- Right-click aims and bites; wheel/slider zoom 75–135%; P pauses observation and hides the HUD. P/Esc/button restores play. Reduced-motion preference disables number drift.
- Existing authored PNGs, animation poses, shaders, lighting and five-zone progression remain. No new commercial-art or GPU-quality claim.

## Checks before publication

- node --test tests/web-runtime.test.cjs: 11/11 PASS (inline syntax, real combat, reach/arc/pause, loot ownership, duplicate prevention, save migration/invalid-save preservation, trial continuation, Three.js CPU geometry lifecycle).
- node tests/playthrough.cjs: public-API-only accelerated simulation. Story campaign wins at 225.18 simulated seconds, five zones, 14 props broken, maximum chain 21. Fangborn story trial wins at 41.48 simulated seconds. No hero-position, health, level, unlock or reward injection. These are not natural-player time measurements.
- All seven embedded PNG SHA-256 hashes equal prior release.
- HTML: 19,955,969 bytes; SHA-256 c07995a2663ec07eecf48032e59535598898911739de451651392ef43d305f53. Fifteen inline classic scripts; no external startup dependencies.
- Recovery migration adds new supply state to old v0.6 saves once; preserves HP/RNG and reserves new object IDs. Broken props cannot yield repeated loot after reload.

## Browser release check

Public Pages HTML checksum matches the final HTML above (runtime commit 6424678). Browser UI operations verified:

- Menu shows v0.7.0 WEB; old save continues with HP and level preserved.
- Damage labels and a three-devour chain with +1 energy appear during play.
- Observation hides HUD and pauses simulation; slider reaches 135%; Escape exits even with slider focus. Hero position and HP remain unchanged during observation.
- On final runtime, normal ground click moves the hero beside a supply. Two right-click attacks change its HP from 26 to 8.3744 to 0 (broken=true). Save/menu/reload/continue preserves broken=true and hero HP 161.52.
- Browser testing exposed an upgrade-interruption bug in pulse supply damage. Fixed in 6424678 and covered by the eleventh regression test: an enemy kill may open upgrade selection without cancelling the already-started attack's prop damage. New attacks remain blocked during upgrade.

Browser could not create WebGL context and used the existing animated Canvas fallback (18 actor definitions, six animation atlases). Online interaction checks are not GPU/HD-2D visual evidence. Three.js geometry lifecycle was tested on CPU only; real GPU visual QA remains outstanding.

## Rollback and follow-up

Rollback through a normal git revert, never force push or clear player storage. devourHD2D.v1 remains unchanged. Existing save parser accepts the prior schema; new optional fields are validated. Browser errors, loading layer and actual HTML checksum are inspected after publishing. Large browser GPU/visual QA remains a separate gate. This turn owns the implementation and records the evidence; no independent-agent review is claimed.
