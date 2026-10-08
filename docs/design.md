# 哥吉拉 十大怪獸決戦 — game design

Godzilla fights ten classic kaiju in ten consecutive boss fights. One
campaign, escalating difficulty, no build step, no dependencies, plain
`<script>` tags so `index.html` opens straight from disk.

## Premise

ゴジラが東京湾に現れた十大怪獣と十番勝負で戦う。各戦いの間に力を伸ばし、
最終決戦では燃え上がるゴジラになる。

Ten bosses drawn from the films (see `docs/research.md`). Each fight is a
self-contained arena duel; the campaign glue is a between-level upgrade pick
and a form change at the end.

## Files

| File | Responsibility |
|---|---|
| `index.html` | page shell, CSS, canvas, touch pad, control legend, script order |
| `js/data.js` | all tuning data: player kit, ten kaiju, attacks, elements, upgrades |
| `js/input.js` | keyboard + on-screen pad → abstract actions |
| `js/audio.js` | WebAudio synthesis: roars, beams, thuds, UI tones (no samples) |
| `js/fx.js` | particles, projectiles, shockwaves, screen shake, hit-stop, damage numbers |
| `js/rig.js` | shared procedural drawing primitives and pose maths |
| `js/art.js` | Godzilla + ten kaiju silhouettes, drawn from the research briefs |
| `js/ai.js` | kaiju behaviour: range selection, telegraphs, phases, difficulty scaling |
| `js/player.js` | Godzilla controller, kit, unlocks, burning form |
| `js/ui.js` | HUD, dossier card, level intro/outro, upgrade pick, screens |
| `js/game.js` | state machine, level orchestration, rAF loop, save/load |

Load order in `index.html` is `data → input → audio → fx → rig → art → ai →
player → ui → game`. Everything shares one global namespace, deliberately, to
keep `file://` working.

## Screen and arena

- Canvas 1024 × 576, scaled to container width.
- `GROUND = 486`. Fighters are positioned by their feet.
- Arena is the visible width; fighters clamp to `[60, W-60]`. No scrolling —
  a boss-fight frame, like the Ultraman game this sits beside.
- Backdrop is procedural and per-level (Tokyo, Osaka Castle, Letchi Island
  sea, Infant Island, Mt. Fuji, Lake Ashi, Fukuoka Tower, Tokyo Bay), keyed
  off `monster.stage`.

## Player: ゴジラ

| Stat | Base |
|---|---|
| HP | 1000 |
| 放射線エネルギー radiation energy | 100, regen 9/s |
| Guard | 75% damage reduction, cannot move |
| Walk | 190 px/s |
| Jump | vy −1050, gravity 2600 |

### Kit

| Action | Keys | Cost | Damage | Notes |
|---|---|---|---|---|
| パンチ punch | `J` | — | 10 | 0.10 windup / 0.10 active / 0.16 recover, reach 92 |
| キック kick | `K` | — | 20 | 0.20 / 0.14 / 0.30, reach 116, heavy knockback |
| 踏みつけ stomp | `K` in air | — | 16 | ground shockwave, r=150 |
| 放射熱線 atomic breath | `Space` / `L` | 30 | 38 | beam, 0.35 s charge telegraph, tiered |
| ガード guard | `S` / `↓` | — | — | hold; 75% cut |
| ジャンプ jump | `↑` / `W` | — | — | — |
| 全身放射熱線 nuclear pulse | `Q` | 55 | 30 | **unlocked after level 4**; radial, breaks guard |
| 放射火炎 fire ray | `Space` when Burning | 60 | 70 | **unlocked after level 7**; fire element, wide |

Energy is the pacing valve: a full bar buys three atomic breaths. `ai.js` and
`player.js` both treat "out of energy" as a real window of vulnerability.

### Progression

- After each victory: choose **one of three** upgrades (`UPGRADES` in
  `data.js`) — +12% max HP, +25% energy regen, +15% beam damage, +12% melee
  damage, heal 40%, −20% beam cost, +guard to 85%.
- Atomic breath tiers: 放射熱線 → レッド熱線 (after level 4) → 放射火炎 (after
  level 7). Tier changes damage, colour, and element (fire from tier 3).
- **バーニングゴジラ Burning Godzilla** in level 10 only: HP drains 4/s,
  all damage ×1.35, Fire Ray available. Canonical — he is melting down, so the
  finale is a race.
- Death → retry the same level with the same upgrades. Progress (level index,
  difficulty and the upgrades taken) is kept in `localStorage` under
  `godzilla-webgame.save.v1`, written whenever a battle after the first is
  started and cleared on a full clear or when a new game is started.

## Kaiju model

Every boss is data. `MONSTERS[i]`:

```js
{
  id, ja, en, subtitle, film, era, height, weight, element, threat, // dossier
  hp, speed, defense, weightClass,                                  // stats
  palette: { skin, skin2, belly, eye, accent, glow },                // art
  art: 'ghidorah',                                                   // key into art.js
  stage: { bg: 'city', sky: [...], timeOfDay },                      // backdrop
  attacks: [ { id, ja, en, kind, dmg, windup, active, recover,
               reach, shape, proj, element, telegraph, cooldown,
               minRange, maxRange, hits, knock, cost, tags } ],
  phases: [ { atHp, moves, speedMul, note } ],
  weakness: { text, element, mult, where },                          // shown in dossier
  resist: { radiation, melee, fire },
  ai: { aggression, preferRange, dodge, flank }
}
```

### The ten levels

| # | Kaiju | HP | Threat | Element | Phase twist |
|---|---|---|---|---|---|
| 1 | アンギラス | 720 | ★ | 獣 | none |
| 2 | エビラ | 880 | ★☆ | 水 | enrage below 40% |
| 3 | ラドン | 1000 | ★★ | 風 | airborne; Fire Rodan beam at 55% |
| 4 | モスラ | 1150 | ★★ | 風 | imago → larva |
| 5 | ガイガン | 1300 | ★★★ | 機械 | none; buzzsaw channel |
| 6 | ヘドラ | 1450 | ★★★ | 毒 | perfect → saucer → perfect |
| 7 | キングギドラ | 1650 | ★★★★ | 宇宙 | per-head stagger; merged beam |
| 8 | ビオランテ | 1800 | ★★★★ | 植物 | flower (rooted) → plant beast |
| 9 | スペースゴジラ | 2050 | ★★★★☆ | 結晶 | photon shield uptime |
| 10 | デストロイア | 2400 | ★★★★★ | 微氧 | aggregate → perfect; Burning player |

### Attack vocabulary (`kind`)

| kind | Behaviour |
|---|---|
| `melee` | hitbox rect in front during `active` |
| `dash` | moves the kaiju through the box (Gigan flight, Anguirus charge) |
| `beam` | hitscan line after a telegraph (gravity beams, corona beam, Hedrium ray) |
| `proj` | projectile with speed/gravity/radius (water blast, slicers, homing ghosts, thorns) |
| `grab` | contact → hold N ticks → damage + throw (neck constriction, pincer, vines, gravity tornado) |
| `aura` | persistent area (scale cloud, acid mist, micro-oxygen fog) |
| `channel` | windup, sustained damage over `active`, interruptible by stagger (buzzsaw) |
| `quake` | ground wave from the feet (stomp, tail strike) |

### Telegraph contract

Every kaiju attack shows a tell before it lands — the player must always be
able to react. Three tell languages, matching the Ultraman game's telegraphed
stomp ring:

- `flash` — the kaiju glows in its accent colour,
- `line` — a thin trace along the beam path,
- `ring` — an arc/ring on the ground under the impact area.

Windup is ≥0.35 s for anything above 40 damage, scaled by difficulty.

## Damage maths

```
dmg = base
    * elementMul(attacker.element, defender)      // resist table
    * (defender.guarding ? guardCut : 1)
    * playerDamageMul | kaijuDamageMul            // upgrades / enrage
```

`elementMul` reads `resist = {radiation, melee, fire}` per monster, exactly the
matrix in `docs/research.md`. Weaknesses are **advertised in the dossier card**
before the fight — the research is the player's weapon.

Stagger: each hit adds to a stagger meter; `channel` and `grab` attacks are
interrupted when it overflows, then reset. This is how Hedorah's fog and
Gigan's buzzsaw are answered.

## Difficulty scaling

`ai.aggression` (0–1) drives attack selection frequency; `ai.preferRange`
drives spacing; `difficulty` (easy 0.7 / normal 1.0 / hard 1.35) scales kaiju
HP, damage, and telegraph time. Player is never gated by a stat check — every
boss is beatable with the right element.

## Feel

- Hit-stop 40–90 ms scaled by damage; screen shake on heavy hits.
- Particle types: dust, sparks, blood, scale dust, sludge, crystal shards, embers.
- Roars are synthesised (sawtooth glide + noise burst), beams are a swept
  oscillator, per the Ultraman game's approach — no audio files.
- City backdrop takes damage: buildings lose windows and lean after big hits
  (cheap, high payoff).

## Screens

1. タイトル — `←` `→` picks the difficulty; ENTER starts a new run, or resumes
   the saved run at its next battle when a save exists, with R starting over.
2. 怪獣資料 dossier card — name, film, height/weight, threat stars, element,
   key attacks, **weakness hint**. Enter to fight.
3. 戦闘 — HUD: player HP + energy, kaiju HP + phase pips, level x/10, timer.
4. 勝利 → 力アップ upgrade pick (3 cards) → next dossier.
5. 全戦勝利 ending.
6. 敗北 → retry / back to title.

## Controls (both keyboard and touch pad)

| | |
|---|---|
| 移動 | `←` `→` / `A` `D` |
| ジャンプ | `↑` / `W` |
| パンチ | `J` |
| キック / 踏みつけ | `K` |
| 放射熱線 / 放射火炎 | `Space` / `L` |
| 全身放射熱線 | `Q` |
| ガード | `S` / `↓` |
| スタート / 再戦 | `Enter` / `R` |

## Out of scope

No multiplayer, no scrolling levels, no minions beyond scripted phase spawns,
no photographed assets in the build. Reference art in `refs/` informs the
procedural drawing only.
