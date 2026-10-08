/* =========================================================
   game.js — ループ、ステージ、判定、ステージ進行
   Scene flow: title -> intro -> fight -> result -> upgrade -> ...
   -> ending. One boss per level, ten levels, difficulty chosen
   on the title screen.
   ========================================================= */
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;

const Game = (() => {
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rnd = (a, b) => a + Math.random() * (b - a);

  const g = {
    mode: 'title',
    time: 0,
    diffKey: 'normal',
    diff: DIFFICULTY.normal,
    levelIndex: 0,
    player: null,
    boss: null,
    introT: 0,
    banner: null,
    bannerT: 0,
    upgrades: [],
    upgradeIndex: 0,
    result: null,
    resultT: 0,
    hitsTaken: 0,
    levelTime: 0,
    runSummary: [],
    paused: false,
    haze: 0,
    flashTint: null,
    save: null,            /* the run left in localStorage, if any */
    upgradeIds: [],        /* upgrade ids taken this run, for the save */
    city: [],              /* per-block damage on the backdrop, per level */
  };

  /* ---------------- stage background ---------------- */
  const STAGE_CACHE = {};
  const CITY_BG = { city: 1, tower: 1, ruins: 1 };
  let cityLayout = [];     /* the blocks of the stage being fought */

  /* the skyline is deterministic and shared between retries; the damage
     done to it belongs to one level and is rebuilt by resetCity */
  function layout(def) {
    if (!STAGE_CACHE[def.art])
      STAGE_CACHE[def.art] = skyline(def.stage.bg, def.n * 7919 + 13);
    return STAGE_CACHE[def.art];
  }

  function resetCity(def) {
    cityLayout = layout(def);
    g.city = cityLayout.map(() => ({ dmg: 0, lean: 0 }));
  }

  /* a heavy blow lands at x: the blocks nearby lose windows and lean
     away from the impact, and stay that way for the rest of the fight */
  function damageCity(x, power) {
    if (!g.boss || !CITY_BG[g.boss.def.stage.bg]) return;
    for (let i = 0; i < g.city.length; i++) {
      const b = cityLayout[i], d = g.city[i];
      const cx = b.x + b.w * 0.5;
      const dist = Math.abs(cx - x);
      if (dist > 340) continue;
      const near = 1 - dist / 340;
      d.dmg = Math.min(1, d.dmg + power * near * 0.45);
      d.lean = clamp(d.lean + (cx < x ? -1 : 1) * power * near * 0.014, -0.075, 0.075);
    }
  }

  function skyline(kind, seed) {
    /* deterministic pseudo-random skyline so it does not shimmer */
    let s = seed;
    const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const out = [];
    let x = -40;
    while (x < W + 40) {
      const w = 30 + rand() * 90;
      const h = kind === 'tower' ? 120 + rand() * 260
              : kind === 'city' ? 60 + rand() * 170
              : kind === 'ruins' ? 40 + rand() * 110
              : 50 + rand() * 120;
      out.push({ x, w, h, broken: kind === 'ruins' && rand() < 0.5 });
      x += w + 8 + rand() * 24;
    }
    return out;
  }

  /* Per-stage light rig. Shade.body reads the key/rim/ambient triple for
     form shading and Shade.far uses fog to push distance back, so the
     stage sets the lighting and every kaiju inherits it. */
  const STAGE_LIGHT = {
    ruins: { ang: -2.60, key: '#9ab2c8', rim: '#cfe0ff', amb: '#2a2030', fog: '#3a2436', fogAmt: 0.30,
      post: { bloom: 0.34, vignette: 0.36, grade: ['#4a6a8a', '#7a4a3a'] } },
    sea: { ang: -0.95, key: '#cfe8f0', rim: '#eaf6ff', amb: '#16283a', fog: '#1e3a52', fogAmt: 0.40,
      post: { bloom: 0.40, vignette: 0.32, grade: ['#5fd0ff', '#3a6a8a'] } },
    mountain: { ang: -2.30, key: '#ffb878', rim: '#ffd8a0', amb: '#241a2a', fog: '#3a2a3a', fogAmt: 0.35,
      post: { bloom: 0.42, vignette: 0.34, grade: ['#6a5a8a', '#ff8a4a'] } },
    island: { ang: -2.45, key: '#e2f0f4', rim: '#ffffff', amb: '#1a2a3a', fog: '#2a4a6a', fogAmt: 0.45,
      post: { bloom: 0.45, vignette: 0.28, grade: ['#7fe0ff', '#6a8a5a'] } },
    city: { ang: -2.70, key: '#a2a8cc', rim: '#d8e4ff', amb: '#1a1428', fog: '#2a2038', fogAmt: 0.35,
      post: { bloom: 0.36, vignette: 0.36, grade: ['#5fd0ff', '#c06a4a'] } },
    smog: { ang: -2.05, key: '#a8b894', rim: '#d0e0b0', amb: '#20241c', fog: '#2e3628', fogAmt: 0.55,
      post: { bloom: 0.26, vignette: 0.40, grade: ['#8ab070', '#4a5a3a'] } },
    lake: { ang: -2.50, key: '#bcd4e4', rim: '#e0f0ff', amb: '#16222e', fog: '#243a4a', fogAmt: 0.42,
      post: { bloom: 0.38, vignette: 0.34, grade: ['#5fb8ff', '#3a5a6a'] } },
    tower: { ang: -2.80, key: '#a4bce4', rim: '#d0e8ff', amb: '#101a2e', fog: '#1e2a4a', fogAmt: 0.45,
      post: { bloom: 0.46, vignette: 0.36, grade: ['#6fd8ff', '#4a5a9a'] } },
    bay: { ang: -2.20, key: '#e89080', rim: '#ffc0a0', amb: '#2a1016', fog: '#3a1a22', fogAmt: 0.35,
      post: { bloom: 0.36, vignette: 0.38, grade: ['#7a5a8a', '#ff6a4a'] } },
  };
  let gPost = { bloom: 0.34, vignette: 0.34 };

  function drawStage(def, t) {
    const sky = def.stage.sky;
    const L = STAGE_LIGHT[def.stage.bg] || STAGE_LIGHT.city;
    gPost = L.post;
    Shade.setLight({ ang: L.ang, key: L.key, rim: L.rim, amb: L.amb,
      fog: L.fog, fogAmt: L.fogAmt });

    const grad = ctx.createLinearGradient(0, 0, 0, GROUND + 40);
    grad.addColorStop(0, sky[0]);
    grad.addColorStop(0.55, sky[1]);
    grad.addColorStop(1, sky[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    /* sun / moon / fire glow */
    const glowX = def.stage.bg === 'sea' || def.stage.bg === 'bay' ? W * 0.72 : W * 0.28;
    const gl = ctx.createRadialGradient(glowX, 150, 8, glowX, 150, 240);
    gl.addColorStop(0, Rig.rgba(sky[2], 0.55));
    gl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, W, H);

    const bg = def.stage.bg;
    if (bg === 'smog') {
      for (let i = 0; i < 5; i++) {
        const y = 120 + i * 50 + Math.sin(t * 0.3 + i) * 12;
        ctx.fillStyle = 'rgba(120,130,110,' + (0.05 + 0.02 * i) + ')';
        ctx.fillRect(0, y, W, 60);
      }
    }
    if (bg === 'mountain') {
      ctx.fillStyle = Rig.shade(sky[1], -0.25);
      ctx.beginPath();
      ctx.moveTo(0, GROUND);
      ctx.lineTo(120, 200); ctx.lineTo(260, 300); ctx.lineTo(430, 150);
      ctx.lineTo(620, 300); ctx.lineTo(790, 210); ctx.lineTo(960, 320); ctx.lineTo(W, 260);
      ctx.lineTo(W, GROUND); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,120,60,.18)';
      ctx.beginPath(); ctx.arc(430, 168, 26, 0, 6.284); ctx.fill();
    }

    /* skyline / ruins / towers. The city is not scenery you can ignore:
       heavy hits knock the windows out and leave the blocks leaning */
    if (bg === 'city' || bg === 'tower' || bg === 'ruins') {
      const list = layout(def);
      const body = Rig.shade(sky[1], -0.20);
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        const d = g.city[i] || { dmg: 0, lean: 0 };
        ctx.save();
        if (d.lean) {
          ctx.translate(b.x + b.w * 0.5, GROUND);
          ctx.rotate(d.lean);
          ctx.translate(-b.x - b.w * 0.5, -GROUND);
        }
        ctx.fillStyle = body;
        ctx.fillRect(b.x, GROUND - b.h, b.w, b.h);
        if (b.broken)
          ctx.clearRect(b.x + b.w * 0.3, GROUND - b.h, b.w * 0.35, b.h * 0.4);
        if (d.dmg > 0.2) {
          ctx.fillStyle = 'rgba(0,0,0,' + (0.3 * d.dmg).toFixed(3) + ')';
          ctx.fillRect(b.x, GROUND - b.h, b.w, b.h);
        }
        /* windows go dark one by one, in a pattern fixed per block */
        ctx.fillStyle = 'rgba(255,230,140,.16)';
        for (let y = GROUND - b.h + 12; y < GROUND - 14; y += 22)
          for (let x = b.x + 6; x < b.x + b.w - 8; x += 16) {
            if (((x * 31 + y * 17 + b.x) % 7) >= 2) continue;
            if (((x * 13 + y * 29 + b.x) % 100) / 100 < d.dmg) continue;
            ctx.fillRect(x, y, 5, 8);
          }
        ctx.restore();
      }
    }

    /* water for sea, bay, lake, island */
    if (bg === 'sea' || bg === 'bay' || bg === 'lake' || bg === 'island') {
      const wc = bg === 'bay' ? '#3a1a22' : bg === 'lake' ? '#1e3a48' : '#1b3a52';
      ctx.fillStyle = wc;
      ctx.fillRect(0, GROUND - 6, W, H - GROUND + 6);
      ctx.strokeStyle = 'rgba(200,230,255,.16)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        const y = GROUND + 6 + i * 10;
        for (let x = 0; x <= W; x += 24)
          ctx.lineTo(x, y + Math.sin((x * 0.03) + t * 1.4 + i) * 2.5);
        ctx.stroke();
      }
    }
    if (bg === 'island') {
      ctx.fillStyle = Rig.shade(sky[1], -0.3);
      ctx.beginPath();
      ctx.ellipse(W * 0.5, GROUND + 10, 420, 90, 0, Math.PI, 0); ctx.fill();
      for (let i = 0; i < 4; i++) {
        const x = 240 + i * 150;
        ctx.strokeStyle = '#2a4a3a'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(x, GROUND - 40);
        ctx.quadraticCurveTo(x + 14, GROUND - 120, x + 6, GROUND - 170); ctx.stroke();
        ctx.fillStyle = '#2f5a3a';
        for (let k = 0; k < 5; k++)
          R_leaf(x + 6, GROUND - 170, 46, 14, -0.6 + k * 0.6);
      }
    }

    /* ground slab */
    const gg = ctx.createLinearGradient(0, GROUND, 0, H);
    gg.addColorStop(0, Rig.shade(sky[2], -0.26));
    gg.addColorStop(1, Rig.shade(sky[0], -0.16));
    ctx.fillStyle = gg;
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.strokeStyle = 'rgba(255,255,255,.10)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, GROUND + 0.5); ctx.lineTo(W, GROUND + 0.5); ctx.stroke();

    /* aerial perspective: a fog band sitting on the horizon line, so the
       skyline reads as behind the fighters instead of next to them */
    const hz = ctx.createLinearGradient(0, GROUND - 200, 0, GROUND + 8);
    hz.addColorStop(0, Rig.rgba(L.fog, 0));
    hz.addColorStop(1, Rig.rgba(L.fog, L.fogAmt * 0.55));
    ctx.fillStyle = hz;
    ctx.fillRect(0, GROUND - 200, W, 208);
  }

  function R_leaf(x, y, len, wid, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(wid, -len * 0.4, 0, -len);
    ctx.quadraticCurveTo(-wid, -len * 0.4, 0, 0);
    ctx.fill(); ctx.restore();
  }

  function drawFighter(f, t) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(f.facing, 1);
    if (f.flash > 0) ctx.globalAlpha = 0.75 + 0.25 * Math.sin(f.flash * 90);
    if (f.invuln > 0) ctx.globalAlpha = 0.55;
    Art.draw(f, t);
    ctx.restore();

    if (f.flash > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(f.flash * 4, 0, 0.65);
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(f.x, f.y); ctx.scale(f.facing, 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-f.w * 0.6, -f.h, f.w * 1.4, f.h);
      ctx.restore();
    }
  }

  /* ---------------- beams ---------------- */
  function drawBeam(f, t) {
    const a = f.state.atk;
    if (!a || a.kind !== 'beam') return;
    const stage = Fighter.stageOf(f);
    const b = a.beam;
    const lanes = b.lanes || 1;
    const x0 = f.x + f.facing * f.w * 0.32;
    const y0 = f.y + b.yOff;
    const len = b.len * (stage === 'active' ? 1 : 0.06);
    const el = ELEMENTS[a.element || f.def.element];
    const color = a.tierColor || (el ? el.color : '#ff8a3c');

    if (stage === 'windup') {
      /* the charge point at the mouth */
      const k = f.state.t / a.windup;
      FX.wave(x0, y0, 10 + 26 * k, color, { life: 0.12, ring: true });
      return;
    }
    if (stage !== 'active') return;

    const fade = clamp((a.windup + a.active - f.state.t) / 0.1, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < lanes; i++) {
      const ly = y0 + (i - (lanes - 1) / 2) * (b.laneGap || 0);
      const h = b.h * (0.7 + 0.3 * Math.sin(t * 40 + i));
      const grad = ctx.createLinearGradient(x0, 0, x0 + f.facing * len, 0);
      grad.addColorStop(0, 'rgba(255,255,255,.95)');
      grad.addColorStop(0.25, color);
      grad.addColorStop(1, Rig.rgba(color, 0.25));
      ctx.globalAlpha = 0.85 * fade;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x0, ly - h * 0.5);
      ctx.lineTo(x0 + f.facing * len, ly - h * 0.9);
      ctx.lineTo(x0 + f.facing * len, ly + h * 0.9);
      ctx.lineTo(x0, ly + h * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.35 * fade;
      ctx.fillStyle = color;
      ctx.fillRect(x0, ly - h * 1.8, f.facing * len, h * 3.6);
    }
    ctx.restore();
    if (Math.random() < 0.6)
      FX.burst(a.element === 'fire' ? 'ember' : 'beam',
               x0 + f.facing * rnd(20, len), y0 + rnd(-b.h, b.h), 2, { speed: 200 });
  }


  /* ---------------- combat ---------------- */
  function findMove(def, id) {
    if (def.attacks.some(a => a.id === id)) return def.attacks.find(a => a.id === id);
    for (const k in def)
      if (k.endsWith('Moves') && def[k].some(a => a.id === id)) return def[k].find(a => a.id === id);
    return null;
  }

  function applyDamage(att, vic, a) {
    const byPlayer = att.kind === 'player';
    let dmg = a.dmg * (byPlayer ? 1 : g.diff.dmg);
    if (vic.coreExposed && a.element === 'radiation') dmg *= 2;
    const weak = byPlayer && vic.def.weakness && vic.def.weakness.element === a.element;
    const applied = Fighter.hurt(vic, dmg, {
      element: a.element || 'melee',
      dir: att.facing,
      knock: a.knock || 90,
      knockUp: a.knock > 400 ? 260 : 0,
      stagger: a.stagger || 0,
      resist: byPlayer ? vic.def.resist : null,
      guardCut: g.player.st.guardCut,
      unguard: a.breaksGuard,
      weak: weak,
      crit: vic.coreExposed || (weak && dmg > 20),
    });
    if (vic.kind === 'player' && applied > 0) g.hitsTaken++;
    if (applied >= 50) damageCity(vic.x, Math.min(1.5, applied / 80));
    if (a.kind === 'grab' && applied > 0 && !vic.dead) startGrab(att, vic, a);
    return applied;
  }

  function startGrab(att, vic, a) {
    const gr = a.grab;
    Fighter.setState(vic, 'grabbed', gr.dur, { grabAt: att, grabA: a, t: 0 });
    vic.vx = 0; vic.vy = 0;
    Audio.SFX.grab();
    FX.label(vic.x, vic.y - vic.h * 1.1, '掴まれた!', '#ff9a6a');
  }

  function updateGrab(vic, dt) {
    const s = vic.state, att = s.grabAt, gr = s.grabA.grab;
    if (!att || att.dead) { Fighter.setState(vic, 'idle'); return; }
    vic.x = att.x + att.facing * att.w * 0.7;
    vic.y = vic.airborne ? vic.y : GROUND;
    const dps = (gr.dmg || 10) + (gr.drain ? gr.drain * 2 : 0);
    vic.hp = Math.max(1, vic.hp - dps * dt);
    if (gr.drain && vic.kind === 'player') vic.energy = Math.max(0, vic.energy - gr.drain * dt);
    FX.burst('spark', vic.x, vic.y - vic.h * 0.5, 1, { speed: 120 });
    if (s.t >= s.dur) {
      Fighter.setState(vic, 'hurt', 0.5);
      vic.vx = att.facing * (gr.throwVx || 300);
      vic.vy = gr.throwVy || -260;
      vic.onGround = false;
      Audio.SFX.throw();
      FX.addShake(14);
    }
  }

  /* one hitbox pass for the attacker against the victim */
  function resolveHits(att, vic) {
    if (att.dead || vic.dead) return;
    const hb = Fighter.hitbox(att);
    if (!hb) return;
    const a = att.state.atk;
    let key = a.id;
    if (a.kind === 'channel') key += ':' + Math.floor((att.state.t - a.windup) / a.channel.interval);
    if (Fighter.alreadyHit(att, key)) return;
    const hit = hb.kind === 'area' ? Fighter.areaHits(hb, vic) : Fighter.boxHits(hb, vic);
    if (!hit) return;
    Fighter.markHit(att, key);
    if (a.kind === 'channel') Audio.SFX.saw();
    applyDamage(att, vic, a);
  }

  /* things that happen once, when the active window opens */
  /* attacks that sound like something other than their kind's default */
  const VOICE = {
    water: 'splash', silk: 'silk', spikes: 'crystal',
    corona: 'laser', hedrium: 'laser',
  };

  function onActiveStart(f) {
    const a = f.state.atk;
    if (f.activeStarted === a.id + ':' + f.state.name) return;
    f.activeStarted = a.id + ':' + f.state.name;
    const dir = f.facing;
    const mx = f.x + dir * f.w * 0.5, my = f.y - f.h * 0.6;

    if (a.kind === 'proj' && a.proj) {
      const spec = Object.assign({}, a.proj, { dmg: a.dmg, atkId: a.id, element: a.element });
      const owner = f.kind === 'player' ? 'player' : 'kaiju';
      FX.shoot(owner, spec, mx, my, dir, a.element);
      if (VOICE[a.id]) Audio.SFX[VOICE[a.id]]();
      else if (a.proj.color) Audio.SFX.disc();
    }
    if (a.kind === 'aura' && a.area && a.area.dot) {
      const dur = a.area.dur || a.active;
      const kind = a.area.arena ? 'arena' : 'cloud';
      const x = a.area.arena ? W / 2 : f.x;
      FX.addHazard(kind, x, GROUND - 10, a.area.r, dur, a.dmg, a.element, { owner: f.kind });
      if (a.area.blind) g.haze = dur;
      Audio.SFX.acid();
    }
    if (a.kind === 'special') {
      if (a.id === 'barrier' || a.id === 'shield') {
        f.shield = true;
        Audio.SFX.charge();
        FX.wave(f.x, f.y - f.h * 0.5, f.h * 0.7, '#bfe0ff', { life: 0.5 });
      }
      if (a.id === 'spores') {
        const heal = Math.round(f.maxHp * 0.12);
        f.hp = Math.min(f.maxHp, f.hp + heal);
        FX.plume('scale', f.x, f.y - f.h * 0.6, 40, { w: f.w * 2, size: 7 });
        FX.damageText(f.x, f.y - f.h * 1.1, -heal, 'heal');
        FX.label(f.x, f.y - f.h * 1.3, '胞子再生', '#ffd86a');
      }
      if (a.id === 'split') doSplit(f);
    }
    if (a.kind === 'quake') {
      FX.wave(f.x, f.y, a.area.r, ELEMENTS[a.element || 'melee'].color, { life: 0.45 });
      FX.addShake(12);
      damageCity(f.x, 0.9);
      if (VOICE[a.id]) Audio.SFX[VOICE[a.id]](); else Audio.SFX.stomp();
    }
    if (a.kind === 'beam') {
      if (VOICE[a.id]) Audio.SFX[VOICE[a.id]](); else Audio.SFX.beam();
    }
  }

  /* Hedorah and Destoroyah scatter and recombine. */
  function doSplit(f) {
    const isHedorah = f.def.id === 'hedorah';
    f.invuln = 1.4;
    FX.burst(isHedorah ? 'sludge' : 'ember', f.x, f.y - f.h * 0.5, 60, { speed: 420 });
    FX.wave(f.x, f.y - f.h * 0.5, f.h, isHedorah ? '#8fd05a' : '#ff7a5a', { life: 0.6 });
    FX.addShake(16);
    Audio.SFX.boom();
    if (isHedorah) {
      for (let i = 0; i < 3; i++)
        FX.addHazard('pool', clamp(f.x + rnd(-260, 260), 80, W - 80), GROUND, 80, 4.5, 7, 'toxic');
      f.x = clamp(f.x + rnd(-180, 180), 120, W - 120);
    } else {
      for (let i = 0; i < 3; i++) spawnMinion(f);
      f.x = clamp(f.x + rnd(-220, 220), 120, W - 120);
    }
  }

  function spawnMinion(boss) {
    const def = {
      id: boss.def.id, ja: '幼体', element: boss.def.element,
      art: boss.def.id === 'destoroyah' ? 'destoroyah_juv' : 'hedorah_saucer',
      attacks: [], palette: boss.def.palette, ai: { aggression: .8, preferRange: 120, dodge: .1, flank: 0 },
      hp: 60, speed: 260, w: 46, h: 74, staggerMax: 40,
    };
    const m = Fighter.create(def, clamp(boss.x + rnd(-260, 260), 80, W - 80), { facing: -1 });
    m.maxHp = m.hp;
    m.isMinion = true;
    m.contactCd = 0;
    g.minions.push(m);
    FX.burst('smoke', m.x, m.y - 30, 14, { speed: 220 });
  }

  /* ---------------- projectiles and hazards ---------------- */
  function resolveProjectiles(dt) {
    const targets = { player: g.player, kaiju: g.boss };
    FX.updateProjectiles(dt, targets);
    for (const p of FX.projectilesOf('player')) {
      if (g.boss.dead || g.boss.invuln > 0) continue;
      const bb = Fighter.bodyBox(g.boss);
      if (p.x > bb.x && p.x < bb.x + bb.w && p.y > bb.y && p.y < bb.y + bb.h) {
        FX.removeProjectile(p);
        applyDamage(g.player, g.boss, { dmg: p.spec.dmg, element: p.spec.element,
                                        knock: 120, stagger: 10, kind: 'proj' });
      }
      for (const m of g.minions) {
        if (m.dead) continue;
        const mb = Fighter.bodyBox(m);
        if (p.x > mb.x && p.x < mb.x + mb.w && p.y > mb.y && p.y < mb.y + mb.h) {
          FX.removeProjectile(p);
          Fighter.hurt(m, p.spec.dmg, { element: p.spec.element, dir: 1, knock: 80, stagger: 6 });
        }
      }
    }
    for (const p of FX.projectilesOf('kaiju')) {
      if (g.player.dead || g.player.state.name === 'grabbed') continue;
      const bb = Fighter.bodyBox(g.player);
      if (p.x > bb.x && p.x < bb.x + bb.w && p.y > bb.y && p.y < bb.y + bb.h) {
        FX.removeProjectile(p);
        applyDamage(g.boss, g.player, { dmg: p.spec.dmg, element: p.spec.element,
                                        knock: 140, stagger: 8, kind: 'proj' });
      }
    }
  }

  function resolveHazards(dt) {
    for (const h of FX.hazardsOf()) {
      const owner = h.owner || 'kaiju';
      const vic = owner === 'kaiju' ? g.player : g.boss;
      if (vic.dead) continue;
      const bb = Fighter.bodyBox(vic);
      const cx = clamp(h.x, bb.x, bb.x + bb.w), cy = clamp(h.y, bb.y, bb.y + bb.h);
      if (Math.hypot(h.x - cx, h.y - cy) > h.r) continue;
      const dmg = h.dps * dt * (owner === 'kaiju' ? g.diff.dmg : 1);
      vic.hp = Math.max(owner === 'kaiju' ? 1 : 0, vic.hp - dmg);
      vic.flash = Math.max(vic.flash, 0.05);
      if (Math.random() < 0.25)
        FX.burst('sludge', vic.x + rnd(-20, 20), vic.y - rnd(0, vic.h * 0.7), 2, { speed: 90 });
      if (vic.hp <= 0 && owner === 'kaiju') {
        vic.dead = true; Fighter.setState(vic, 'ko', 99);
        FX.addShake(26); FX.addFlash(0.5, '#ffffff');
      }
      if (owner === 'kaiju') g.hitsTaken += dt > 0 ? 0 : 0;
    }
  }

  function resolveMinions(dt) {
    for (const m of g.minions) {
      if (m.dead) continue;
      AI.update(m, g.player, dt, { attack: () => {}, jump: () => {} });
      Fighter.update(m, dt, m.ai.move);
      m.contactCd -= dt;
      if (!g.player.dead && m.contactCd <= 0 && Fighter.boxHits(Fighter.bodyBox(m), g.player)) {
        m.contactCd = 1.1;
        applyDamage(m, g.player, { dmg: 9, element: m.def.element, knock: 200, stagger: 6, kind: 'melee' });
      }
    }
    g.minions = g.minions.filter(m => !m.dead);
  }

  /* ---------------- phases ---------------- */
  function applyPhase(b, ph) {
    if (ph.art) b.art = ph.art;
    if (ph.hp) { b.maxHp = ph.hp; b.hp = ph.hp; }
    if (ph.speedMul) b.speedMul = ph.speedMul;
    if (ph.dmgMul) b.dmgMul = ph.dmgMul;
    if (ph.speed) b.speed = ph.speed;
    if (ph.h) b.h = ph.h;
    if (ph.w) b.w = ph.w;
    if (ph.rooted !== undefined) b.rooted = ph.rooted;
    if (ph.airborne !== undefined) b.airborne = ph.airborne;
    if (ph.invuln) b.invuln = ph.invuln;
    if (ph.cooldownMul) b.cooldownMul = ph.cooldownMul;
    if (ph.restore) b.moves = b.def.attacks.slice();
    if (ph.replaceMoves)
      b.moves = b.moves.filter(a => ph.replaceMoves.indexOf(a.id) < 0);
    if (ph.addMoves)
      ph.addMoves.forEach(id => {
        const mv = findMove(b.def, id);
        if (mv && !b.moves.some(a => a.id === id)) b.moves.push(mv);
      });
    if (ph.spawnJuveniles) for (let i = 0; i < ph.spawnJuveniles; i++) spawnMinion(b);
    AI.refresh(b);
    g.banner = b.def.ja + '・' + ph.note;
    g.bannerT = 2.4;
    Audio.SFX.phase();
    Audio.SFX.roarOf(b.def.id);
    FX.addFlash(0.35, '#ffffff');
    FX.addShake(18);
    FX.wave(b.x, b.y - b.h * 0.5, b.h * 1.2, '#ffd75e', { life: 0.7 });
  }

  function checkPhases() {
    const b = g.boss;
    while (b.phaseIndex < b.def.phases.length && b.hp / b.maxHp <= b.def.phases[b.phaseIndex].at)
      applyPhase(b, b.def.phases[b.phaseIndex++]);
    /* Biollante's nucleus is only soft right after she has grabbed */
    if (b.def.id === 'biollante' && b.coreExposed > 0) b.coreExposed -= 1;
  }

  /* ---------------- saved run ----------------
     Progress is the level about to be fought plus the upgrades already
     taken, so closing the tab costs the fight in progress and nothing
     else. localStorage can throw (private mode, quota), so every access
     is guarded and a bad record is simply ignored. */
  const SAVE_KEY = 'godzilla-webgame.save.v1';

  function storeGet() { try { return localStorage.getItem(SAVE_KEY); } catch (e) { return null; } }
  function storeSet(v) { try { localStorage.setItem(SAVE_KEY, v); } catch (e) {} }
  function storeClear() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

  function readSave() {
    const raw = storeGet();
    if (!raw) return null;
    let s = null;
    try { s = JSON.parse(raw); } catch (e) { return null; }
    if (!s || s.v !== 1) return null;
    s.levelIndex = clamp(s.levelIndex | 0, 0, MONSTERS.length - 1);
    s.upgrades = Array.isArray(s.upgrades) ? s.upgrades : [];
    return s;
  }

  function rememberRun() {
    g.save = {
      v: 1,
      diffKey: g.diffKey,
      levelIndex: g.levelIndex,
      upgrades: g.upgradeIds.slice(),
    };
    storeSet(JSON.stringify(g.save));
  }

  function forgetRun() { g.save = null; storeClear(); }

  /* ---------------- level flow ---------------- */
  function bossAttack(f, atk) {
    const scaled = Object.assign({}, atk, {
      windup: atk.windup * g.diff.telegraph,
      dmg: atk.dmg * (f.dmgMul || 1) * g.diff.dmg,
    });
    Fighter.startAttack(f, scaled);
    if (atk.id === 'tendrils') f.coreExpose = true;
  }

  function startLevel(i) {
    const def = MONSTERS[i];
    g.levelIndex = i;
    g.boss = Fighter.create(def, W - 300, { facing: -1 });
    g.boss.hp = g.boss.maxHp = Math.round(def.hp * g.diff.hp);
    g.boss.phaseIndex = 0;
    g.boss.coreExposed = 0;
    g.minions = [];
    g.player.x = 240; g.player.y = GROUND; g.player.vx = 0; g.player.vy = 0;
    g.player.facing = 1;
    Fighter.setState(g.player, 'idle');
    g.player.st.burning = i === 9;
    g.player.energy = g.player.maxEnergy;
    g.levelTime = 0;
    g.haze = 0;
    g.result = null;
    g.introT = 0;
    g.paused = false;
    g.mode = 'intro';
    FX.reset();
    resetCity(def);
    if (i > 0) rememberRun();
    Audio.SFX.roarOf(def.id);
  }

  function newRun() {
    forgetRun();
    g.upgradeIds = [];
    g.st = Player.stats();
    g.st.cleared = 0;
    g.hitsTaken = 0;
    g.runSummary = [];
    g.player = Player.create(g.st);
    startLevel(0);
  }

  /* resume the run left in localStorage: same level, same upgrades */
  function continueRun() {
    const s = g.save;
    if (!s) { newRun(); return; }
    if (DIFFICULTY[s.diffKey]) { g.diffKey = s.diffKey; g.diff = DIFFICULTY[g.diffKey]; }
    g.st = Player.stats();
    g.st.cleared = s.levelIndex;
    g.hitsTaken = 0;
    g.runSummary = [];
    g.player = Player.create(g.st);
    g.upgradeIds = [];
    s.upgrades.forEach(id => {
      const u = UPGRADES.find(u2 => u2.id === id);
      if (!u) return;
      Player.upgrade(g.player, u);
      g.upgradeIds.push(id);
    });
    startLevel(s.levelIndex);
  }

  function finishLevel(win) {
    g.result = win ? 'win' : 'lose';
    g.resultT = 0;
    g.mode = 'result';
    if (win) {
      g.st.cleared = g.levelIndex + 1;
      g.runSummary.push('STAGE ' + (g.levelIndex + 1) + '  ' + g.boss.def.ja +
        '  ' + Math.floor(g.levelTime) + '秒  被弾 ' + g.hitsTaken);
      Audio.SFX.win();
      FX.addFlash(0.5, '#ffe89a');
      damageCity(g.boss.x, 1.4);
    } else {
      Audio.SFX.lose();
    }
  }

  function offerUpgrades() {
    const pool = UPGRADES.slice();
    g.upgrades = [];
    for (let i = 0; i < 3 && pool.length; i++)
      g.upgrades.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    g.upgradeIndex = 0;
    g.mode = 'upgrade';
  }

  /* ---------------- per-mode input ---------------- */
  function menuInput() {
    if (g.mode === 'title') {
      const keys = ['easy', 'normal', 'hard'];
      if (Input.pressed('left') || Input.pressed('right')) {
        let i = keys.indexOf(g.diffKey);
        i = (i + (Input.pressed('right') ? 1 : keys.length - 1)) % keys.length;
        g.diffKey = keys[i];
        g.diff = DIFFICULTY[g.diffKey];
        Audio.SFX.select();
      }
      if (Input.pressed('start')) { Audio.SFX.select(); g.save ? continueRun() : newRun(); }
      if (Input.pressed('restart')) { Audio.SFX.select(); newRun(); }
      return;
    }
    if (g.mode === 'intro') {
      g.introT += 1 / 60;
      if (Input.pressed('start') || g.introT > 3.4) { g.mode = 'fight'; Audio.SFX.select(); }
      return;
    }
    if (g.mode === 'fight') {
      if (Input.pressed('back')) { g.paused = !g.paused; Audio.SFX.select(); }
      if (Input.pressed('restart')) { Audio.SFX.select(); startLevel(g.levelIndex); }
      return;
    }
    if (g.mode === 'result') {
      if (g.result === 'win' && (Input.pressed('start') || Input.pressed('punch'))) {
        Audio.SFX.select();
        if (g.levelIndex >= 9) { forgetRun(); g.mode = 'ending'; }
        else offerUpgrades();
      }
      if (g.result === 'lose') {
        if (Input.pressed('restart')) {
          g.player.dead = false;
          g.player.hp = g.player.maxHp;
          g.player.st.burning = g.levelIndex === 9;
          Audio.SFX.select();
          startLevel(g.levelIndex);
        }
        if (Input.pressed('back')) g.mode = 'title';
      }
      return;
    }
    if (g.mode === 'upgrade') {
      if (Input.pressed('left')) { g.upgradeIndex = (g.upgradeIndex + 2) % g.upgrades.length; Audio.SFX.move(); }
      if (Input.pressed('right')) { g.upgradeIndex = (g.upgradeIndex + 1) % g.upgrades.length; Audio.SFX.move(); }
      if (Input.pressed('start') || Input.pressed('punch')) {
        const u = g.upgrades[g.upgradeIndex];
        const healed = Player.upgrade(g.player, u);
        if (healed) FX.damageText(g.player.x, g.player.y - g.player.h, -healed, 'heal');
        g.upgradeIds.push(u.id);
        Audio.SFX.select();
        startLevel(g.levelIndex + 1);
      }
      return;
    }
    if (g.mode === 'ending' && (Input.pressed('start') || Input.pressed('back')))
      g.mode = 'title';
  }

  /* ---------------- simulation ---------------- */
  function tick(dt) {
    if (g.mode === 'fight' && !g.paused) {
      g.levelTime += dt;
      Player.update(g.player, Input, dt, { target: g.boss });
      AI.update(g.boss, g.player, dt, { attack: bossAttack, jump: () => {} });
      Fighter.update(g.boss, dt, g.boss.ai.move);
      if (Fighter.stageOf(g.boss) === 'active') onActiveStart(g.boss);
      if (Fighter.stageOf(g.boss) === 'windup') g.boss.activeStarted = null;
      if (g.boss.state.name !== 'attack') g.boss.shield = false;
      if (g.player.state.name !== 'attack') g.player.shield = false;

      resolveHits(g.player, g.boss);
      resolveHits(g.boss, g.player);
      resolveProjectiles(dt);
      resolveHazards(dt);
      resolveMinions(dt);
      if (g.player.state.name === 'grabbed') updateGrab(g.player, dt);
      if (g.boss.state.name === 'grabbed') updateGrab(g.boss, dt);
      checkPhases();

      if (g.haze > 0) g.haze -= dt;
      if (g.bannerT > 0) g.bannerT -= dt;
      if (g.boss.dead) finishLevel(true);
      else if (g.player.dead) finishLevel(false);
    } else {
      if (g.bannerT > 0) g.bannerT -= dt;
      if (g.player && g.mode !== 'title') Fighter.update(g.player, dt, 0);
    }
  }

  /* ---------------- render ---------------- */
  function render() {
    const def = g.boss ? g.boss.def : MONSTERS[0];
    const sh = FX.shakeOffset();
    ctx.save();
    ctx.translate(sh[0], sh[1]);
    drawStage(def, g.time);
    FX.drawTelegraphs();
    FX.drawHazards();
    if (g.mode !== 'title' && g.boss) {
      for (const m of g.minions) if (!m.dead) drawFighter(m, g.time);
      drawFighter(g.boss, g.time);
      drawBeam(g.boss, g.time);
      drawFighter(g.player, g.time);
      drawBeam(g.player, g.time);
    }
    FX.drawWaves();
    FX.drawProjectiles();
    FX.drawParticles();
    ctx.restore();

    /* the whole world gets one grade/bloom/vignette pass before any HUD
       is drawn on top, which is what keeps the frame looking rendered
       rather than assembled */
    Shade.post(canvas, ctx, gPost);

    if (g.haze > 0) {
      ctx.fillStyle = 'rgba(150,180,90,' + clamp(g.haze * 0.12, 0, 0.42) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    FX.drawTexts();
    FX.drawFlash();

    if (g.mode === 'title') UI.drawTitle(g);
    else {
      UI.drawHud(g);
      UI.drawPhaseBanner(g);
      if (g.mode === 'intro') UI.drawIntro(g);
      if (g.mode === 'upgrade') UI.drawUpgrade(g);
      if (g.mode === 'result') UI.drawResult(g);
      if (g.mode === 'ending') UI.drawEnding(g);
      if (g.paused) UI.drawPause();
      UI.drawTouchHint();
    }
  }

  /* ---------------- main loop ---------------- */
  let last = 0;
  function frame(ts) {
    const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
    last = ts;
    g.time += dt;
    menuInput();
    if (FX.hitStop <= 0) tick(dt);
    FX.update(dt);
    render();
    Input.endFrame();
    requestAnimationFrame(frame);
  }

  function start() {
    g.st = Player.stats();
    g.player = Player.create(g.st);
    g.minions = [];
    g.save = readSave();
    Input.bindPad();
    requestAnimationFrame(frame);
  }

  return { g, start, startLevel, newRun };
})();

if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', () => Game.start());
else Game.start();
