# ゴジラ 怪獣大決戦 — 全10ステージ

Single-page HTML5 canvas kaiju fighter: Godzilla fights the ten Showa
monsters, Japanese UI, no build step, no dependencies.

## Play

Open `index.html` in a browser, or serve it:

    python3 -m http.server 8000    # then visit http://localhost:8000

The run is saved in `localStorage`, which most browsers allow from
`file://`; serving the page keeps the continue working everywhere.

## Controls

| Action | Keys |
|---|---|
| 移動 move | `←` `→` / `A` `D` |
| ジャンプ jump | `↑` / `W` |
| パンチ punch — fast, light | `J` |
| キック kick — slow, heavy, big knockback | `K` |
| 踏みつけ stomp — ground pound, while guarding | `K` + `↓` |
| 放射熱線 atomic breath — 30 energy | `Space` / `L` |
| 全身放射熱線 full-body pulse — 55 energy, breaks guard, 4 wins to unlock | `Q` |
| ガード block — 75% damage reduction | `↓` / `S` |
| 決定 / やり直し start, restart | `Enter` / `R` |
| 一時停止 pause | `Esc` |

Touch devices: on-screen buttons below the canvas.

## Run

Ten battles, then the ending. Godzilla starts at 1000 HP with 100
energy regenerating ~9/s. Between battles pick one of three upgrades
(HP, regeneration, beam power, melee power, an immediate heal, cheaper
costs, tighter guard); the same upgrade can be taken more than once.

The atomic breath improves with wins: 放射熱線, then レッド熱線 at 4 wins,
then 放射火炎 at 7. The final battle is Burning Godzilla — he hits 35%
harder with everything and burns 4 HP a second, so the last fight is a
race.

Kaiju change form partway through a fight — Rodan catches fire, Mothra
drops from imago to larva, Hedorah swaps between its perfect and saucer
forms, Biollante turns into its beast form, SpaceGodzilla takes to the
air, Ghidorah enters 第三形態, Destoroyah calls in juveniles before
becoming 完全体 — and each card lists the element its weakness is.
Heavy hits knock windows out of the city backdrop and leave the blocks
leaning for the rest of the battle.

Progress — the battle about to be fought, the difficulty and the
upgrades taken — is stored under `godzilla-webgame.save.v1`. ENTER on
the title screen resumes it, R starts over.

## Files

- `index.html` — page shell, CSS, control legend, touch pad
- `js/data.js` — all tuning: player kit, upgrades, ten kaiju with phases
- `js/audio.js` — WebAudio synth: roars, beams, impacts, UI blips
- `js/input.js` — keyboard and touch pad, held vs pressed-this-frame
- `js/fx.js` — particles, shockwaves, projectiles, hazards, telegraphs
- `js/rig.js` — drawing primitives and pose helpers shared by the art
- `js/art.js` — one silhouette function per kaiju and per form
- `js/ai.js` — kaiju behaviour: spacing, tells, phase scripts
- `js/fighter.js` — shared body: states, hitboxes, damage, guard, KO
- `js/player.js` — Godzilla controller, kit, unlocks, burning form
- `js/ui.js` — HUD, title card, dossier, upgrade and result screens
- `js/game.js` — level flow, stage backdrop, combat resolution, save

## Design docs

- `docs/design.md` — the spec: systems, data shapes, screen flow
- `docs/research.md` — the kaiju, their attacks, and the film facts behind them
