/* =========================================================
   art.js — 怪獣の描画
   One function per silhouette, composed from rig.js primitives.
   Local space: feet at (0,0), body grows toward -y, forward is +x.
   Shapes are fractions of f.h, so the same code serves a 40 m
   aggregate form and a 120 m perfect form. Silhouette notes are
   in docs/research.md.
   ========================================================= */
'use strict';

const Art = (() => {
  const R = Rig;

  /* ---------------- shared pose ---------------- */
  function pose(f, time) {
    const g = R.gait(f, time);
    const a = f.state.atk;
    const hurt = f.state.name === 'hurt' ? Math.min(1, f.state.t / 0.3) : 0;
    const wind = f.state.name === 'attack' && a && f.state.t < a.windup;
    const act = f.state.name === 'attack' && a &&
                f.state.t >= a.windup && f.state.t < a.windup + a.active;
    const ko = f.state.name === 'ko';
    let lean = wind ? -0.10 : act ? 0.16 : 0;
    lean += Math.sin(time * 1.6) * 0.012 - hurt * 0.12;
    if (ko) lean = -0.30;
    const bob = Math.sin(time * 2.1) * 0.012 * f.h + (ko ? 0 : Math.abs(g.p) * 2);
    return { g, hurt, wind, act, ko, lean, bob, time };
  }

  /* charge glow during a windup, shared by every breath user */
  function chargeGlow(f, h, x, y, color) {
    const a = f.state.atk;
    if (f.state.name !== 'attack' || !a || f.state.t >= a.windup) return;
    const k = f.state.t / a.windup;
    R.glow(x, y, h * (0.10 + 0.16 * k), color, 0.35 + 0.4 * k);
  }

  /* jaw that opens with the attack state */
  function jawOpen(f, idle) {
    if (f.state.name === 'attack') {
      const a = f.state.atk;
      if (f.state.t >= a.windup) return 0.9;
      return 0.15 + 0.7 * (f.state.t / a.windup);
    }
    return idle;
  }

  /* ---------------- ゴジラ ---------------- */
  function godzilla(f, time, opt) {
    opt = opt || {};
    const h = f.h, P = f.pal, p = pose(f, time);
    const skin = opt.skin || P.skin, belly = opt.belly || P.belly, fin = opt.fin || P.fin;
    const hipY = -0.40 * h + p.bob, shY = -0.74 * h + p.bob;
    const L = p.lean;
    let headX = 0.2 * h, headY = -0.9 * h;

    R.shadow(0, 2, h * 0.42);

    /* tail: heavy counterweight, wavy tapered chain */
    const ta = [];
    for (let i = 0; i < 8; i++)
      ta.push(Math.PI - 0.16 + Math.sin(time * 2.2 - i * 0.55) * 0.07 - i * 0.035 + L * 0.4);
    R.taperChain(-0.05 * h, hipY, h * 0.115, ta, 0.20 * h, 0.02 * h,
                 R.shade(skin, -0.05), { taper: 0.93 });

    /* maple-leaf dorsal fins along the back */
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      R.dorsal(-0.10 * h - t * h * 0.62,
               hipY - 0.06 * h - t * 0.10 * h + Math.sin(time * 2.2 - i * 0.55) * 2,
               h * (0.16 - t * 0.07), h * (0.075 - t * 0.03), fin, -0.22 - t * 0.18);
    }

    /* digitigrade legs */
    const st = p.g.amt;
    [[-0.02, p.g.p], [0.10, p.g.p2]].forEach(([ox, ph2]) => {
      const fx = ox * h + ph2 * 0.10 * h * st;
      R.limb(ox * h, hipY, [ox * h + ph2 * 0.06 * h * st, -0.20 * h + p.bob * 0.4],
             fx, 0, 0.085 * h, 0.055 * h, R.shade(skin, -0.10), 0.05 * h);
      R.poly([[fx - 0.05 * h, -0.012 * h], [fx + 0.11 * h, -0.012 * h],
              [fx + 0.13 * h, 0], [fx - 0.06 * h, 0]], R.shade(skin, -0.18));
    });

    ctx.save();
    ctx.translate(0, p.bob);
    ctx.rotate(L * 0.35);
    R.smooth([[-0.16 * h, hipY - p.bob], [0.14 * h, hipY - p.bob], [0.19 * h, -0.60 * h],
              [0.12 * h, shY], [-0.13 * h, shY], [-0.20 * h, -0.60 * h]],
             R.bodyGradient(-0.2 * h, shY, 0.2 * h, hipY, skin));
    R.smooth([[0.02 * h, hipY - p.bob], [0.13 * h, -0.58 * h], [0.09 * h, shY + 0.02 * h],
              [-0.01 * h, shY + 0.02 * h]], R.rgba(belly, 0.55));
    for (let i = 0; i < 4; i++) {
      const y = -0.48 * h - i * 0.055 * h;
      R.poly([[0, y], [0.12 * h, y - 0.001 * h], [0.12 * h, y + 0.02 * h], [0, y + 0.01 * h]],
             R.rgba(R.shade(belly, -0.10), 0.35));
    }
    /* small arms */
    const armS = p.wind ? -0.5 : p.act ? 0.9 : 0.1;
    R.limb(0.10 * h, shY + 0.02 * h, [0.17 * h, -0.63 * h],
           0.19 * h + armS * 0.06 * h, -0.60 * h, 0.045 * h, 0.03 * h,
           R.shade(skin, -0.06), 0.032 * h);
    /* neck */
    const [hx, hy] = R.taperChain(0.06 * h, shY, h * 0.11, [-0.30 + L, -0.10 + L * 0.6],
                                  0.14 * h, 0.10 * h, skin);
    headX = hx + 0.06 * h; headY = hy - 0.03 * h;
    const jaw = jawOpen(f, 0.12 + Math.sin(time * 1.3) * 0.05);
    R.smooth([[headX - 0.09 * h, headY - 0.05 * h], [headX + 0.13 * h, headY - 0.04 * h],
              [headX + 0.17 * h, headY + 0.01 * h], [headX - 0.06 * h, headY + 0.03 * h]],
             R.bodyGradient(headX - 0.08 * h, headY, headX + 0.16 * h, headY, skin));
    ctx.save();
    ctx.translate(headX - 0.05 * h, headY + 0.02 * h);
    ctx.rotate(jaw * 0.30);
    R.poly([[0, 0], [0.19 * h, 0.005 * h], [0.18 * h, 0.03 * h], [0, 0.04 * h]],
           R.shade(skin, -0.12));
    ctx.restore();
    R.mouth(headX + 0.06 * h, headY + 0.015 * h, 0.16 * h, 0.05 * h, jaw, '#f2ecdc', 5);
    R.eye(headX - 0.02 * h, headY - 0.025 * h, 0.022 * h, '#f0e8d0', P.eye || '#d8b020');
    R.poly([[headX - 0.05 * h, headY - 0.045 * h], [headX + 0.02 * h, headY - 0.05 * h],
            [headX + 0.02 * h, headY - 0.03 * h], [headX - 0.05 * h, headY - 0.025 * h]],
           R.shade(skin, -0.16));
    ctx.restore();

    /* atomic charge: mouth glow, and the whole body when burning */
    const col = opt.burning ? '#ff8a3c' : (P.glow || '#7fd8ff');
    chargeGlow(f, h, headX + 0.10 * h, headY, col);
    if (opt.burning) R.glow(0, -0.55 * h, 0.45 * h, '#ff6a2a', 0.30 + Math.sin(time * 9) * 0.06);
    return { headX, headY };
  }

  function burningGodzilla(f, time) {
    godzilla(f, time, { skin: R.mix(f.pal.skin, '#8a3a2a', 0.35), fin: '#ffb04a', burning: true });
  }

  /* ---------------- 1. アンギラス ---------------- */
  function anguirus(f, time) {
    const h = f.h, P = f.pal, p = pose(f, time);
    const bodyY = -0.52 * h + p.bob;
    R.shadow(0, 2, h * 0.55);

    /* tail about as long as the body, spiky */
    const ta = [];
    for (let i = 0; i < 9; i++) ta.push(Math.PI - 0.05 + Math.sin(time * 2.6 - i * 0.5) * 0.08 + i * 0.02);
    R.taperChain(-0.12 * h, bodyY + 0.04 * h, h * 0.10, ta, 0.16 * h, 0.015 * h,
                 R.shade(P.skin, -0.06), { taper: 0.94 });
    for (let i = 0; i < 7; i++)
      R.spike(-0.12 * h - i * 0.09 * h, bodyY + 0.02 * h - i * 0.008 * h,
              h * (0.075 - i * 0.006), -Math.PI / 2 - 0.2 + Math.sin(time * 2.6 - i * 0.5) * 0.06,
              h * 0.03, P.spike);

    /* four legs — hind limbs longer, so he can rear up */
    const st = p.g.amt;
    [[-0.10, p.g.p2], [-0.02, p.g.p], [0.10, p.g.p2 * 0.8], [0.17, p.g.p * 0.8]].forEach(([ox, ph2], i) => {
      R.limb(ox * h, bodyY + 0.10 * h, [ox * h + ph2 * 0.03 * h * st, -0.14 * h],
             ox * h + ph2 * 0.07 * h * st, i < 2 ? -0.02 * h : 0, 0.055 * h, 0.04 * h,
             R.shade(P.skin, -0.12), 0.038 * h);
    });

    ctx.save(); ctx.translate(0, p.bob * 0.6); ctx.rotate(p.lean * 0.2);
    /* armoured dome */
    R.smooth([[-0.24 * h, bodyY + 0.10 * h], [-0.20 * h, bodyY - 0.10 * h], [0.02 * h, bodyY - 0.16 * h],
              [0.20 * h, bodyY - 0.08 * h], [0.24 * h, bodyY + 0.08 * h], [0, bodyY + 0.14 * h]],
             R.bodyGradient(-0.2 * h, bodyY - 0.16 * h, 0.2 * h, bodyY + 0.12 * h, P.skin));
    /* "a plethora of long, sharp, prickly spikes" */
    for (let i = 0; i < 13; i++) {
      const a = Math.PI * (1.02 - (i / 12) * 0.98);
      R.spike(Math.cos(a) * 0.22 * h, bodyY - 0.02 * h + Math.sin(a) * 0.15 * h,
              h * (0.055 + 0.03 * Math.sin(i * 2.1)), a - Math.PI / 2, h * 0.022, P.spike);
    }
    /* head: long puffy crocodile snout, snout horn, curled head horns, lower tusks */
    R.taperChain(0.18 * h, bodyY - 0.04 * h, h * 0.09, [-0.05, 0.02], 0.14 * h, 0.09 * h, P.skin);
    const hx = 0.30 * h, hy = bodyY - 0.02 * h;
    R.smooth([[hx - 0.10 * h, hy - 0.06 * h], [hx + 0.16 * h, hy - 0.04 * h],
              [hx + 0.20 * h, hy + 0.01 * h], [hx - 0.08 * h, hy + 0.05 * h]],
             R.bodyGradient(hx - 0.08 * h, hy, hx + 0.18 * h, hy, P.skin));
    const jaw = jawOpen(f, 0.1);
    ctx.save(); ctx.translate(hx - 0.06 * h, hy + 0.02 * h); ctx.rotate(jaw * 0.26);
    R.poly([[0, 0], [0.24 * h, 0], [0.23 * h, 0.028 * h], [0, 0.036 * h]], R.shade(P.skin, -0.14));
    R.spike(0.02 * h, 0, 0.05 * h, -Math.PI / 2, 0.02 * h, '#f2ecdc');
    ctx.restore();
    R.spike(hx + 0.19 * h, hy - 0.015 * h, 0.055 * h, 0.1, 0.026 * h, P.spike);
    for (let i = 0; i < 3; i++)
      R.spike(hx - 0.06 * h + i * 0.04 * h, hy - 0.055 * h, 0.06 * h,
              -Math.PI / 2 - 0.5 + i * 0.22, 0.022 * h, P.spike);
    R.eye(hx - 0.02 * h, hy - 0.03 * h, 0.02 * h, '#f0e8d0', P.eye);
    ctx.restore();
    chargeGlow(f, h, 0.3 * h, bodyY, P.accent);
  }

  /* ---------------- 2. エビラ ---------------- */
  function ebirah(f, time) {
    const h = f.h, P = f.pal, p = pose(f, time);
    const bodyY = -0.50 * h + p.bob;
    R.shadow(0, 2, h * 0.6);

    /* segmented abdomen and fan tail */
    const ta = [];
    for (let i = 0; i < 6; i++) ta.push(Math.PI - 0.30 + i * 0.10 + Math.sin(time * 1.8 - i * 0.4) * 0.05);
    R.taperChain(-0.10 * h, bodyY + 0.02 * h, h * 0.11, ta, 0.20 * h, 0.06 * h, P.skin, { taper: 0.95 });
    R.poly([[-0.62 * h, bodyY - 0.10 * h], [-0.72 * h, bodyY - 0.22 * h], [-0.76 * h, bodyY - 0.02 * h],
            [-0.70 * h, bodyY + 0.14 * h], [-0.60 * h, bodyY + 0.04 * h]], P.skin2);

    /* six walking legs */
    const st = p.g.amt;
    for (let i = 0; i < 6; i++) {
      const ox = -0.16 * h + i * 0.07 * h;
      const ph2 = Math.sin(time * 7.2 + i * 1.05) * st;
      R.limb(ox, bodyY + 0.12 * h, [ox - 0.04 * h + ph2 * 0.04 * h, -0.18 * h],
             ox - 0.08 * h + ph2 * 0.09 * h, 0, 0.028 * h, 0.016 * h, R.shade(P.skin2, -0.05));
    }

    ctx.save(); ctx.translate(0, p.bob * 0.5); ctx.rotate(p.lean * 0.2);
    /* cephalothorax */
    R.smooth([[-0.18 * h, bodyY + 0.10 * h], [-0.14 * h, bodyY - 0.14 * h], [0.08 * h, bodyY - 0.18 * h],
              [0.22 * h, bodyY - 0.06 * h], [0.20 * h, bodyY + 0.10 * h], [-0.02 * h, bodyY + 0.14 * h]],
             R.bodyGradient(-0.18 * h, bodyY - 0.18 * h, 0.22 * h, bodyY + 0.12 * h, P.skin));
    /* two rows of back spikes, red at the base ending in white */
    for (let i = 0; i < 5; i++) {
      R.spike(-0.12 * h + i * 0.07 * h, bodyY - 0.14 * h, 0.07 * h, -Math.PI / 2 - 0.15, 0.03 * h,
              i % 2 ? P.spike : P.skin);
      R.spike(-0.10 * h + i * 0.07 * h, bodyY - 0.09 * h, 0.045 * h, -Math.PI / 2 + 0.1, 0.022 * h, P.spike);
    }
    /* long down-curved scythe rostrum */
    R.taperChain(0.18 * h, bodyY - 0.08 * h, h * 0.10, [0.30, 0.75], 0.06 * h, 0.008 * h, P.spike);
    /* antennae curving back, whiskers forward */
    ctx.strokeStyle = P.skin2; ctx.lineWidth = h * 0.012;
    for (let s = 0; s < 2; s++) {
      ctx.beginPath();
      ctx.moveTo(0.16 * h, bodyY - 0.10 * h);
      ctx.quadraticCurveTo(-0.10 * h, bodyY - 0.34 * h - s * 0.03 * h,
                           -0.46 * h + Math.sin(time * 2 + s) * 0.02 * h, bodyY - 0.20 * h - s * 0.05 * h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0.20 * h, bodyY - 0.04 * h);
      ctx.quadraticCurveTo(0.34 * h, bodyY + 0.02 * h, 0.44 * h, bodyY + 0.10 * h + s * 0.03 * h);
      ctx.stroke();
    }
    /* stalked pale eyes */
    R.eye(0.14 * h, bodyY - 0.13 * h, 0.026 * h, P.eye, '#3a1a1a');
    R.eye(0.19 * h, bodyY - 0.15 * h, 0.022 * h, P.eye, '#3a1a1a');
    ctx.restore();

    /* pincers: right massive (grasp, bludgeon), left slim (stab, skewer) */
    const open = p.wind ? 0.9 : p.act ? 0.05 : 0.35 + Math.sin(time * 1.7) * 0.12;
    const armY = bodyY + 0.02 * h;
    R.limb(0.10 * h, armY, [0.26 * h, armY - 0.06 * h], 0.36 * h, armY + 0.02 * h,
           0.045 * h, 0.035 * h, P.skin2);
    R.pincer(0.36 * h, armY + 0.02 * h, 0.30 * h, 0.05 + open * 0.1, open, P.skin, P.skin2);
    R.limb(0.08 * h, armY + 0.05 * h, [0.24 * h, armY + 0.02 * h], 0.34 * h, armY + 0.10 * h,
           0.032 * h, 0.022 * h, P.skin2);
    R.pincer(0.34 * h, armY + 0.10 * h, 0.22 * h, 0.22, open * 0.7, P.skin, P.skin2);
    chargeGlow(f, h, 0.22 * h, bodyY, P.accent);
  }

  /* ---------------- 3. ラドン ---------------- */
  function rodan(f, time, fire) {
    const h = f.h, P = f.pal, p = pose(f, time);
    const skin = fire ? R.mix(P.skin, '#c04a1a', 0.55) : P.skin;
    const hipY = -0.42 * h + p.bob, shY = -0.72 * h + p.bob;
    const fly = f.airborne || f.state.name === 'attack';
    R.shadow(0, 2, h * 0.40);

    /* broad membranous wings, two segments */
    const flap = fly ? Math.sin(time * 6.5) * 0.45 : Math.sin(time * 1.6) * 0.08;
    R.wing(-0.02 * h, shY, h * 0.86, h * 0.44, Math.PI - 0.30 - flap, R.shade(skin, -0.10), 4, 'rgba(0,0,0,.22)');
    R.wing(0.02 * h, shY, h * 0.86, h * 0.44, 0.30 + flap, R.shade(skin, 0.04), 4, 'rgba(0,0,0,.22)');

    R.taperChain(-0.06 * h, hipY, h * 0.08, [Math.PI - 0.2, Math.PI - 0.1], 0.09 * h, 0.02 * h, skin);

    /* thin legs with forward-pointing talons */
    const st = p.g.amt;
    [[-0.03, p.g.p], [0.05, p.g.p2]].forEach(([ox, ph2]) => {
      const fx = ox * h + ph2 * 0.07 * h * st;
      R.limb(ox * h, hipY, [ox * h + ph2 * 0.04 * h * st, -0.20 * h], fx, 0,
             0.045 * h, 0.026 * h, R.shade(skin, -0.12));
      for (let i = 0; i < 3; i++)
        R.spike(fx, -0.01 * h, 0.05 * h, -0.3 + i * 0.35, 0.014 * h, P.spike);
    });

    ctx.save(); ctx.translate(0, p.bob * 0.5); ctx.rotate(p.lean * 0.4);
    R.smooth([[-0.10 * h, hipY], [0.10 * h, hipY], [0.13 * h, -0.60 * h], [0.05 * h, shY],
              [-0.09 * h, shY], [-0.13 * h, -0.60 * h]],
             R.bodyGradient(-0.12 * h, shY, 0.12 * h, hipY, skin));
    for (let i = 0; i < 5; i++)
      R.spike(0.06 * h + (i % 2) * 0.04 * h, -0.50 * h - i * 0.04 * h, 0.05 * h,
              -0.5 + (i % 2) * 0.4, 0.016 * h, P.spike);
    /* head: pointed beak and swept-back horns */
    R.taperChain(0.02 * h, shY, h * 0.08, [-0.5, -0.2], 0.10 * h, 0.07 * h, skin);
    const hx = 0.10 * h, hy = shY - 0.08 * h;
    R.smooth([[hx - 0.06 * h, hy - 0.05 * h], [hx + 0.10 * h, hy - 0.03 * h],
              [hx + 0.22 * h, hy + 0.01 * h], [hx - 0.05 * h, hy + 0.04 * h]], skin);
    R.poly([[hx + 0.10 * h, hy - 0.02 * h], [hx + 0.30 * h, hy + 0.01 * h], [hx + 0.10 * h, hy + 0.04 * h]],
           fire ? '#ffd070' : P.belly);
    for (let i = 0; i < 3; i++)
      R.spike(hx - 0.02 * h - i * 0.03 * h, hy - 0.05 * h, 0.09 * h,
              -Math.PI / 2 - 0.5 - i * 0.25, 0.016 * h, P.spike);
    R.eye(hx + 0.03 * h, hy - 0.015 * h, 0.022 * h, '#f4ecd0', P.eye, fire ? '#ff8a3c' : null);
    ctx.restore();

    if (fire) R.glow(0.14 * h, shY - 0.06 * h, 0.22 * h, '#ff8a3c', 0.35 + Math.sin(time * 7) * 0.08);
    chargeGlow(f, h, 0.28 * h, shY - 0.06 * h, fire ? '#ff8a3c' : P.accent);
  }
  function rodanFire(f, time) { rodan(f, time, true); }

  /* ---------------- 4. モスラ ---------------- */
  function mothra(f, time) {
    const h = f.h, P = f.pal, p = pose(f, time);
    const shY = -0.66 * h + p.bob;
    R.shadow(0, 2, h * 0.40);
    const flap = Math.sin(time * 4.2) * 0.35;

    /* pale downy wings with eyespots */
    for (let s = -1; s <= 1; s += 2) {
      const rot = s < 0 ? Math.PI - 0.25 - flap : 0.25 + flap;
      const x = s * 0.02 * h;
      R.wing(x, shY, h * 0.92, h * 0.50, rot, R.rgba(P.wing, 0.92), 5, 'rgba(90,80,40,.35)');
      const cx = x + Math.cos(rot) * h * 0.62, cy = shY + Math.sin(rot) * h * 0.62;
      R.circle(cx, cy, h * 0.055, 'rgba(120,90,40,.55)');
      R.circle(cx, cy, h * 0.026, 'rgba(60,40,20,.6)');
    }
    ctx.save(); ctx.translate(0, p.bob * 0.5);
    /* furry thorax, segmented abdomen */
    R.smooth([[-0.09 * h, shY + 0.10 * h], [0.09 * h, shY + 0.10 * h], [0.11 * h, shY - 0.04 * h],
              [-0.11 * h, shY - 0.04 * h]],
             R.bodyGradient(-0.1 * h, shY, 0.1 * h, shY + 0.1 * h, P.skin));
    R.taperChain(-0.06 * h, shY + 0.08 * h, h * 0.10,
                 [Math.PI - 0.25, Math.PI - 0.2, Math.PI - 0.15], 0.11 * h, 0.05 * h, P.skin2);
    for (let i = 0; i < 3; i++)
      R.circle(-0.10 * h - i * 0.09 * h, shY + 0.11 * h + i * 0.02 * h, h * 0.05, P.skin2);
    /* head: large dark eyes, antennae, curled proboscis */
    const hx = 0.06 * h, hy = shY - 0.12 * h;
    R.circle(hx, hy, h * 0.085, P.skin);
    R.eye(hx + 0.03 * h, hy - 0.01 * h, h * 0.045, '#2a2a3a', '#4a4a6a');
    R.eye(hx - 0.04 * h, hy - 0.02 * h, h * 0.036, '#2a2a3a', '#4a4a6a');
    ctx.strokeStyle = P.skin2; ctx.lineWidth = h * 0.012;
    for (let s = 0; s < 2; s++) {
      ctx.beginPath();
      ctx.moveTo(hx + (s ? 0.02 : -0.04) * h, hy - 0.07 * h);
      ctx.quadraticCurveTo(hx + (s ? 0.14 : -0.12) * h, hy - 0.20 * h,
                           hx + (s ? 0.20 : -0.16) * h, hy - 0.14 * h);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(hx + 0.06 * h, hy + 0.05 * h);
    ctx.quadraticCurveTo(hx + 0.16 * h, hy + 0.12 * h, hx + 0.10 * h, hy + 0.18 * h);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const ox = -0.04 * h + i * 0.05 * h;
      R.limb(ox, shY + 0.06 * h, [ox - 0.03 * h, -0.30 * h], ox - 0.05 * h, 0, 0.02 * h, 0.012 * h, P.skin2);
    }
    ctx.restore();
    if (f.state.atk && f.state.atk.id === 'scales') R.glow(0, shY, h * 0.7, P.accent, 0.30);
    chargeGlow(f, h, hx + 0.05 * h, hy - 0.05 * h, P.accent);
  }

  function mothraLarva(f, time) {
    const h = f.h, P = f.pal, p = pose(f, time);
    R.shadow(0, 2, h * 0.60);
    const segs = 6, baseY = -0.42 * h + p.bob;
    for (let i = 0; i < segs; i++) {
      const t = i / (segs - 1);
      const x = -0.34 * h + i * h * 0.13;
      const y = baseY + Math.sin(time * 3.4 - i * 0.8) * h * 0.03;
      const r = h * (0.16 - 0.05 * Math.abs(t - 0.45));
      R.circle(x, y, r, i % 2 ? P.skin : R.shade(P.skin, -0.06));
      R.circle(x, y - r * 0.35, r * 0.55, R.rgba(R.shade(P.skin, 0.08), 0.5));
    }
    /* head with glowing blue eyes and mandibles */
    const hx = 0.22 * h, hy = baseY + Math.sin(time * 3.4 - 5 * 0.8) * h * 0.03;
    R.circle(hx, hy, h * 0.15, P.skin);
    R.eye(hx + 0.04 * h, hy - 0.05 * h, h * 0.045, '#cfefff', P.eye, '#6fd8ff');
    R.eye(hx - 0.03 * h, hy - 0.07 * h, h * 0.032, '#cfefff', P.eye, null);
    const jaw = jawOpen(f, 0.15);
    for (let s = 0; s < 2; s++) {
      ctx.save();
      ctx.translate(hx + 0.06 * h, hy + 0.04 * h + s * 0.03 * h);
      ctx.rotate(0.25 + jaw * 0.35 + s * 0.25);
      R.poly([[0, 0], [0.12 * h, 0.01 * h], [0.10 * h, 0.035 * h], [0, 0.03 * h]], P.skin2);
      ctx.restore();
    }
    /* silk spinneret at the front */
    R.circle(hx + 0.11 * h, hy + 0.09 * h, h * 0.03, '#f5f0e0');
    chargeGlow(f, h, hx + 0.08 * h, hy, P.accent);
  }

  /* ---------------- 5. ガイガン ---------------- */
  function gigan(f, time) {
    const h = f.h, P = f.pal, p = pose(f, time);
    const hipY = -0.40 * h + p.bob, shY = -0.72 * h + p.bob;
    R.shadow(0, 2, h * 0.42);

    R.taperChain(-0.04 * h, hipY, h * 0.07, [Math.PI - 0.25, Math.PI - 0.05], 0.08 * h, 0.02 * h, P.skin2);

    /* beetle wing cases + atomic jets */
    const jet = f.state.name === 'attack' && f.state.atk && f.state.atk.id === 'flydash';
    for (let s = -1; s <= 1; s += 2) {
      const rot = s < 0 ? Math.PI - 0.55 : 0.55;
      R.wing(0, shY + 0.02 * h, h * 0.52, h * 0.26, rot + (jet ? Math.sin(time * 30) * 0.06 : 0),
             R.shade(P.plate, -0.15), 3, 'rgba(0,0,0,.3)');
      if (jet) R.glow(Math.cos(rot) * h * 0.45, shY + 0.10 * h, h * 0.16, '#8fd8ff', 0.55);
    }

    /* digitigrade legs with heavy boots */
    const st = p.g.amt;
    [[-0.04, p.g.p], [0.08, p.g.p2]].forEach(([ox, ph2]) => {
      const fx = ox * h + ph2 * 0.09 * h * st;
      R.limb(ox * h, hipY, [ox * h + ph2 * 0.05 * h * st, -0.20 * h], fx, 0,
             0.07 * h, 0.05 * h, R.shade(P.skin, -0.10), 0.055 * h);
      R.poly([[fx - 0.06 * h, -0.02 * h], [fx + 0.12 * h, -0.02 * h],
              [fx + 0.14 * h, 0], [fx - 0.07 * h, 0]], R.shade(P.plate, -0.25));
    });

    ctx.save(); ctx.translate(0, p.bob * 0.6); ctx.rotate(p.lean * 0.25);
    /* green body with a golden carapace */
    R.smooth([[-0.15 * h, hipY], [0.13 * h, hipY], [0.18 * h, -0.58 * h], [0.10 * h, shY],
              [-0.12 * h, shY], [-0.18 * h, -0.58 * h]],
             R.bodyGradient(-0.16 * h, shY, 0.16 * h, hipY, P.skin));
    R.smooth([[-0.17 * h, shY + 0.02 * h], [0.17 * h, shY + 0.02 * h], [0.14 * h, -0.52 * h],
              [-0.14 * h, -0.52 * h]], R.bodyGradient(-0.16 * h, -0.52 * h, 0.16 * h, shY, P.plate));
    /* crescent chest spikes */
    for (let i = 0; i < 5; i++)
      R.spike(-0.12 * h + i * 0.06 * h, shY - 0.01 * h, 0.055 * h, -Math.PI / 2 + (i - 2) * 0.30,
              0.02 * h, R.shade(P.plate, 0.12));
    /* abdominal rotating cutter */
    const cutY = -0.48 * h;
    const spin = (f.state.name === 'attack' && f.state.atk && f.state.atk.id === 'saw')
      ? time * 26 : time * 2.2;
    R.circle(0.02 * h, cutY, h * 0.10, R.shade(P.skin2, -0.10));
    for (let i = 0; i < 6; i++)
      R.spike(0.02 * h, cutY, h * 0.13, spin + i * Math.PI / 3, h * 0.028, P.saw);
    R.circle(0.02 * h, cutY, h * 0.035, R.shade(P.saw, -0.25));

    /* hammer hands: metal hooks */
    const armS = p.wind ? -0.6 : p.act ? 1.0 : 0.15;
    for (let s = 0; s < 2; s++) {
      const sx = 0.10 * h - s * 0.02 * h, sy = shY + 0.03 * h + s * 0.05 * h;
      R.limb(sx, sy, [sx + 0.10 * h, sy - 0.02 * h], sx + (0.16 + armS * 0.10) * h, sy + 0.02 * h,
             0.045 * h, 0.035 * h, R.shade(P.skin, -0.05), 0.04 * h);
      const hx2 = sx + (0.16 + armS * 0.10) * h, hy2 = sy + 0.02 * h;
      R.poly([[hx2, hy2 - 0.03 * h], [hx2 + 0.09 * h, hy2 - 0.02 * h],
              [hx2 + 0.11 * h, hy2 + 0.03 * h], [hx2 + 0.05 * h, hy2 + 0.04 * h]], P.plate);
      R.spike(hx2 + 0.08 * h, hy2 + 0.03 * h, 0.06 * h, 1.1, 0.018 * h, P.saw);
    }

    /* head: crimson visor, forehead laser aperture, crest horns */
    R.taperChain(0.04 * h, shY, h * 0.08, [-0.35, -0.15], 0.10 * h, 0.08 * h, P.skin);
    const hx = 0.12 * h, hy = shY - 0.09 * h;
    R.smooth([[hx - 0.07 * h, hy - 0.06 * h], [hx + 0.11 * h, hy - 0.05 * h],
              [hx + 0.15 * h, hy + 0.02 * h], [hx - 0.06 * h, hy + 0.05 * h]], P.plate);
    R.poly([[hx - 0.02 * h, hy - 0.01 * h], [hx + 0.14 * h, hy - 0.005 * h],
            [hx + 0.13 * h, hy + 0.025 * h], [hx - 0.02 * h, hy + 0.03 * h]], P.visor);
    R.glow(hx + 0.06 * h, hy + 0.01 * h, h * 0.09, P.visor, 0.45 + Math.sin(time * 5) * 0.10);
    R.spike(hx - 0.03 * h, hy - 0.06 * h, 0.10 * h, -Math.PI / 2 - 0.35, 0.022 * h, P.plate);
    R.spike(hx + 0.02 * h, hy - 0.06 * h, 0.075 * h, -Math.PI / 2 + 0.15, 0.018 * h, P.plate);
    /* aperture above the visor opens for the laser */
    if (f.state.name === 'attack' && f.state.atk && f.state.atk.id === 'laser')
      R.glow(hx + 0.04 * h, hy - 0.045 * h, h * 0.10, P.accent, 0.6);
    ctx.restore();
    chargeGlow(f, h, hx + 0.06 * h, hy, P.accent);
  }

  /* ---------------- 6. ヘドラ ---------------- */
  function hedorah(f, time) {
    const h = f.h, P = f.pal, p = pose(f, time);
    const bodyY = -0.52 * h + p.bob;
    R.shadow(0, 2, h * 0.55);

    /* amorphous, constantly shifting sludge mass */
    const pts = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const wob = 1 + Math.sin(time * 3.1 + i * 1.7) * 0.10 + Math.sin(time * 1.3 + i) * 0.06;
      const rx = 0.26 * h * (1 + 0.16 * Math.cos(a)) * wob;
      const ry = 0.30 * h * (1 + 0.10 * Math.abs(Math.sin(a))) * wob;
      pts.push([Math.cos(a) * rx, bodyY + Math.sin(a) * ry]);
    }
    R.smooth(pts, R.bodyGradient(-0.28 * h, bodyY - 0.30 * h, 0.28 * h, bodyY + 0.30 * h, P.skin));
    /* slick highlights and dripping blobs */
    for (let i = 0; i < 7; i++) {
      const a = time * 0.8 + i * 0.9;
      R.circle(Math.sin(a) * 0.20 * h, bodyY - 0.10 * h + Math.cos(a * 1.3) * 0.16 * h,
               h * (0.03 + 0.02 * Math.sin(a * 2)), R.rgba(P.belly, 0.35));
      const dy = ((time * 60 + i * 40) % 190) / 190;
      R.circle(-0.24 * h + i * 0.08 * h, bodyY + 0.10 * h + dy * 0.30 * h,
               h * 0.02 * (1 - dy), R.rgba(P.accent, 0.5 * (1 - dy)));
    }
    /* stubby crab arms that split at the tip */
    const armS = p.act ? 1.0 : p.wind ? -0.4 : 0;
    for (let s = 0; s < 2; s++) {
      const bx = 0.16 * h, by = bodyY - 0.02 * h + s * 0.10 * h;
      R.limb(bx, by, [bx + 0.14 * h, by - 0.06 * h + armS * 0.04 * h],
             bx + (0.26 + armS * 0.12) * h, by - 0.02 * h, 0.055 * h, 0.04 * h, P.skin2);
      const tx = bx + (0.26 + armS * 0.12) * h, ty = by - 0.02 * h;
      for (let k = 0; k < 2; k++)
        R.spike(tx, ty, 0.10 * h, -0.35 + k * 0.7, 0.026 * h, P.skin2);
    }
    /* jagged mouth and two eyes on irregular mounds */
    const jaw = jawOpen(f, 0.25 + Math.sin(time * 2.2) * 0.10);
    R.poly([[0.10 * h, bodyY - 0.14 * h], [0.30 * h, bodyY - 0.10 * h],
            [0.28 * h, bodyY - 0.05 * h], [0.11 * h, bodyY - 0.09 * h]], '#2a2420');
    for (let i = 0; i < 5; i++)
      R.spike(0.12 * h + i * 0.04 * h, bodyY - 0.13 * h + i * 0.008 * h, 0.04 * h,
              1.3, 0.012 * h, '#e8e0cc');
    R.eye(0.06 * h, bodyY - 0.22 * h, 0.032 * h, P.sclera, P.eye);
    R.eye(0.19 * h, bodyY - 0.25 * h, 0.026 * h, P.sclera, P.eye);
    /* the body never quite holds still */
    R.glow(0, bodyY, 0.42 * h, P.accent, 0.14 + Math.sin(time * 2.6) * 0.05);
    chargeGlow(f, h, 0.16 * h, bodyY - 0.22 * h, '#e04a4a');
  }

  function hedorahSaucer(f, time) {
    const h = f.h, P = f.pal;
    const y = -0.62 * h + Math.sin(time * 2.4) * h * 0.03;
    R.shadow(0, 2, h * 0.45);
    /* translucent green saucer with a red core */
    R.ellipse(0, y, h * 0.52, h * 0.16, 0, R.rgba(P.skin, 0.85));
    R.ellipse(0, y - h * 0.05, h * 0.34, h * 0.14, 0, R.rgba(P.belly, 0.7));
    R.ellipse(0, y + h * 0.04, h * 0.52, h * 0.07, 0, R.rgba(P.skin2, 0.8));
    for (let i = 0; i < 8; i++) {
      const a = time * 2.4 + i * Math.PI / 4;
      R.circle(Math.cos(a) * h * 0.42, y + Math.sin(a) * h * 0.09, h * 0.028,
               R.rgba(P.accent, 0.5 + 0.4 * Math.sin(a)));
    }
    R.glow(0, y, h * 0.30, P.accent, 0.45 + Math.sin(time * 8) * 0.10);
    R.eye(0, y - h * 0.02, h * 0.055, P.sclera, P.eye, '#ff4a3a');
    /* slime trail */
    for (let i = 0; i < 5; i++)
      R.circle(-h * 0.30 - i * h * 0.09, y + h * 0.10 + Math.sin(time * 3 + i) * h * 0.03,
               h * 0.03 * (1 - i / 6), R.rgba(P.accent, 0.35 - i * 0.05));
  }

  /* ---------------- 7. キングギドラ ---------------- */
  function ghidorah(f, time) {
    const h = f.h, P = f.pal, p = pose(f, time);
    const hipY = -0.42 * h + p.bob, shY = -0.66 * h + p.bob;
    R.shadow(0, 2, h * 0.45);

    /* two long necks whipping behind */
    for (let n = 0; n < 2; n++) {
      const segs = [];
      for (let i = 0; i < 6; i++)
        segs.push(Math.PI - 0.35 + Math.sin(time * 1.9 - i * 0.5 + n * 1.4) * 0.10 - n * 0.12 + i * 0.06);
      R.taperChain(-0.06 * h, shY + 0.04 * h, h * 0.075, segs, 0.10 * h, 0.02 * h,
                   n ? R.shade(P.skin, -0.08) : P.skin, { taper: 0.95 });
      const ex = -0.06 * h - 0.44 * h, ey = shY + 0.10 * h;
      R.smooth([[ex - 0.06 * h, ey - 0.04 * h], [ex - 0.16 * h, ey - 0.02 * h],
                [ex - 0.18 * h, ey + 0.02 * h], [ex - 0.05 * h, ey + 0.04 * h]],
               n ? R.shade(P.skin, -0.08) : P.skin);
    }
    /* wings */
    const flap = Math.sin(time * 3.4) * 0.30;
    R.wing(-0.02 * h, shY, h * 0.92, h * 0.52, Math.PI - 0.35 - flap, P.wing, 5, 'rgba(0,0,0,.28)');
    R.wing(0.02 * h, shY, h * 0.92, h * 0.52, 0.35 + flap, R.shade(P.wing, 0.06), 5, 'rgba(0,0,0,.28)');

    /* two legs, bird-like */
    const st = p.g.amt;
    [[-0.05, p.g.p], [0.07, p.g.p2]].forEach(([ox, ph2]) => {
      const fx = ox * h + ph2 * 0.08 * h * st;
      R.limb(ox * h, hipY, [ox * h + ph2 * 0.05 * h * st, -0.20 * h], fx, 0,
             0.075 * h, 0.045 * h, R.shade(P.skin, -0.12), 0.05 * h);
      for (let i = 0; i < 3; i++)
        R.spike(fx, -0.012 * h, 0.07 * h, -0.35 + i * 0.35, 0.018 * h, P.skin2);
    });

    ctx.save(); ctx.translate(0, p.bob * 0.5); ctx.rotate(p.lean * 0.25);
    R.smooth([[-0.16 * h, hipY], [0.16 * h, hipY], [0.20 * h, -0.58 * h], [0.12 * h, shY],
              [-0.14 * h, shY], [-0.20 * h, -0.58 * h]],
             R.bodyGradient(-0.18 * h, shY, 0.18 * h, hipY, P.skin));
    R.smooth([[0.02 * h, hipY], [0.14 * h, -0.56 * h], [0.08 * h, shY], [-0.02 * h, shY]],
             R.rgba(P.belly, 0.5));
    /* three necks, the middle one raised highest */
    const necks = [[0.02, -0.62, 1.0], [0.10, -0.50, 0.85], [-0.06, -0.48, 0.85]];
    const storm = f.state.name === 'attack' && f.state.atk && f.state.atk.id === 'beams';
    necks.forEach(([nx, ny, sc], i) => {
      const sway = Math.sin(time * 1.7 + i * 1.3) * 0.05 + (storm ? 0.12 : 0);
      const [hx, hy] = R.taperChain(nx * h, shY + 0.02 * h, h * 0.085,
                                    [-0.9 + sway + i * 0.25, -0.5 + sway], 0.13 * h * sc, 0.09 * h * sc, P.skin);
      const jaw = storm ? 0.85 : 0.2 + Math.sin(time * 1.4 + i) * 0.08;
      R.smooth([[hx - 0.07 * h, hy - 0.05 * h], [hx + 0.12 * h, hy - 0.04 * h],
                [hx + 0.17 * h, hy + 0.01 * h], [hx - 0.06 * h, hy + 0.03 * h]],
               R.bodyGradient(hx - 0.06 * h, hy, hx + 0.16 * h, hy, P.skin));
      ctx.save(); ctx.translate(hx - 0.04 * h, hy + 0.015 * h); ctx.rotate(jaw * 0.28);
      R.poly([[0, 0], [0.18 * h, 0.004 * h], [0.17 * h, 0.026 * h], [0, 0.034 * h]],
             R.shade(P.skin, -0.12));
      ctx.restore();
      R.mouth(hx + 0.07 * h, hy + 0.01 * h, 0.14 * h, 0.045 * h, jaw, '#f0e6cc', 4);
      /* two horns sweeping back on each head */
      for (let k = 0; k < 2; k++)
        R.spike(hx - 0.03 * h - k * 0.03 * h, hy - 0.05 * h, 0.10 * h,
                -Math.PI / 2 - 0.6 - k * 0.3, 0.02 * h, P.skin2);
      R.eye(hx + 0.02 * h, hy - 0.02 * h, 0.024 * h, P.eye, '#3a2a1a',
            storm ? '#ffe060' : null);
      if (storm) R.glow(hx + 0.10 * h, hy, h * 0.16, P.accent, 0.5);
    });
    ctx.restore();
    chargeGlow(f, h, 0.14 * h, shY - 0.10 * h, P.accent);
  }

  /* ---------------- 8. ビオランテ ---------------- */
  function biollante(f, time) {
    const h = f.h, P = f.pal, p = pose(f, time);
    const baseY = -0.02 * h;
    R.shadow(0, 2, h * 0.55);

    /* rose petals around the mouth */
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * 0.95 + (i / 8) * Math.PI * 1.05;
      const sw = Math.sin(time * 1.5 + i * 0.7) * 0.05;
      const px = Math.cos(a + sw) * h * 0.30, py = -0.62 * h + Math.sin(a + sw) * h * 0.28;
      R.leafShape(px, py, h * 0.30, h * 0.13, a + Math.PI / 2 + sw,
                  i % 2 ? P.petal : R.shade(P.petal, -0.10));
    }
    /* the mouth / core, exposed when the vines have just attacked */
    const open = f.state.name === 'attack' && f.state.atk && f.state.atk.id === 'tendrils';
    R.circle(0, -0.62 * h, h * 0.20, P.skin2);
    R.circle(0, -0.62 * h, h * 0.13, open ? P.core : R.shade(P.skin, -0.15));
    if (open) R.glow(0, -0.62 * h, h * 0.26, P.core, 0.55 + Math.sin(time * 10) * 0.10);
    /* white fang-like teeth ring */
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 0.85 + i * 0.42;
      R.spike(Math.cos(a) * h * 0.16, -0.62 * h + Math.sin(a) * h * 0.16,
              0.06 * h, a + Math.PI / 2, 0.02 * h, '#f0eadc');
    }
    /* thorny vines, some with mouths at the tip */
    for (let v = 0; v < 6; v++) {
      const side = v % 2 ? 1 : -1;
      const segs = [];
      for (let i = 0; i < 6; i++)
        segs.push(side * (0.5 + 0.35 * Math.sin(time * 1.6 + v * 1.1 + i * 0.4)) - side * 0.1);
      const [tx, ty] = R.taperChain(side * 0.10 * h, -0.35 * h, h * 0.035, segs, 0.09 * h, 0.012 * h, P.vine);
      for (let i = 0; i < 3; i++)
        R.spike(side * 0.10 * h + i * side * 0.06 * h, -0.35 * h - i * 0.05 * h,
                0.05 * h, side * (0.8 + i * 0.2), 0.012 * h, P.leaf);
      if (v < 3) {
        R.circle(tx, ty, h * 0.045, P.skin);
        R.mouth(tx, ty, h * 0.09, h * 0.035, 0.4 + 0.4 * Math.sin(time * 3 + v), '#f0e6cc', 3);
      }
    }
    /* bulbous stem base in the lake */
    R.smooth([[-0.30 * h, baseY], [-0.26 * h, -0.34 * h], [0.26 * h, -0.34 * h], [0.30 * h, baseY]],
             R.bodyGradient(-0.28 * h, -0.34 * h, 0.28 * h, baseY, P.leaf));
    for (let i = 0; i < 5; i++)
      R.spike(-0.20 * h + i * 0.10 * h, -0.30 * h, 0.09 * h, -Math.PI / 2 + (i - 2) * 0.25,
              0.022 * h, P.vine);
    /* water line */
    R.poly([[-0.62 * h, baseY], [0.62 * h, baseY], [0.62 * h, baseY + 0.06 * h], [-0.62 * h, baseY + 0.06 * h]],
           'rgba(90,150,170,.35)');
    chargeGlow(f, h, 0, -0.62 * h, P.core);
  }

  function biollanteBeast(f, time) {
    const h = f.h, P = f.pal, p = pose(f, time);
    const hipY = -0.34 * h + p.bob, shY = -0.62 * h + p.bob;
    R.shadow(0, 2, h * 0.5);
    const ta = [];
    for (let i = 0; i < 6; i++) ta.push(Math.PI - 0.1 + Math.sin(time * 2.4 - i * 0.5) * 0.09);
    R.taperChain(-0.06 * h, hipY, h * 0.09, ta, 0.14 * h, 0.02 * h, P.skin2, { taper: 0.93 });

    const st = p.g.amt;
    [[-0.04, p.g.p], [0.08, p.g.p2]].forEach(([ox, ph2]) => {
      const fx = ox * h + ph2 * 0.09 * h * st;
      R.limb(ox * h, hipY, [ox * h + ph2 * 0.05 * h * st, -0.17 * h], fx, 0,
             0.075 * h, 0.05 * h, R.shade(P.skin2, -0.08), 0.045 * h);
    });
    ctx.save(); ctx.translate(0, p.bob * 0.6); ctx.rotate(p.lean * 0.3);
    /* muscular rose-red body with a green husk on the back */
    R.smooth([[-0.18 * h, hipY], [0.16 * h, hipY], [0.20 * h, -0.50 * h], [0.10 * h, shY],
              [-0.16 * h, shY], [-0.22 * h, -0.50 * h]],
             R.bodyGradient(-0.2 * h, shY, 0.18 * h, hipY, P.skin));
    R.smooth([[-0.20 * h, shY + 0.02 * h], [-0.02 * h, shY - 0.02 * h], [0.14 * h, -0.46 * h],
              [-0.18 * h, -0.46 * h]], R.rgba(P.leaf, 0.55));
    /* vine arms */
    for (let v = 0; v < 2; v++) {
      const segs = [];
      for (let i = 0; i < 4; i++)
        segs.push((p.act ? 0.1 : 0.6) + Math.sin(time * 2.2 + v + i * 0.5) * 0.25 + v * 0.3);
      const [tx, ty] = R.taperChain(0.12 * h, shY + v * 0.06 * h, h * 0.04, segs, 0.10 * h, 0.015 * h, P.vine);
      R.circle(tx, ty, h * 0.05, P.skin);
      R.mouth(tx, ty, h * 0.10, h * 0.04, 0.5, '#f0e6cc', 3);
    }
    /* head with a jaw lined by petals */
    R.taperChain(0.06 * h, shY, h * 0.09, [-0.4, -0.2], 0.12 * h, 0.09 * h, P.skin);
    const hx = 0.16 * h, hy = shY - 0.08 * h;
    R.smooth([[hx - 0.08 * h, hy - 0.05 * h], [hx + 0.12 * h, hy - 0.04 * h],
              [hx + 0.18 * h, hy + 0.01 * h], [hx - 0.07 * h, hy + 0.04 * h]], P.skin);
    const jaw = jawOpen(f, 0.2);
    ctx.save(); ctx.translate(hx - 0.04 * h, hy + 0.02 * h); ctx.rotate(jaw * 0.3);
    R.poly([[0, 0], [0.20 * h, 0], [0.19 * h, 0.03 * h], [0, 0.036 * h]], R.shade(P.skin2, -0.1));
    ctx.restore();
    R.mouth(hx + 0.08 * h, hy + 0.01 * h, 0.17 * h, 0.05 * h, jaw, '#f0e6cc', 6);
    for (let i = 0; i < 4; i++)
      R.leafShape(hx - 0.06 * h + i * 0.05 * h, hy - 0.07 * h, 0.12 * h, 0.05 * h,
                  -Math.PI / 2 + (i - 1.5) * 0.3, P.petal);
    R.eye(hx - 0.01 * h, hy - 0.025 * h, 0.024 * h, P.eye, '#3a2a1a');
    ctx.restore();
    chargeGlow(f, h, hx + 0.08 * h, hy, P.core);
  }

  /* ---------------- 9. スペースゴジラ ---------------- */
  function spacegodzilla(f, time, fly) {
    const h = f.h, P = f.pal, p = pose(f, time);
    const hipY = -0.40 * h + p.bob, shY = -0.74 * h + p.bob;
    const L = p.lean;
    R.shadow(0, 2, h * 0.40);

    /* tail with crystal edges */
    const ta = [];
    for (let i = 0; i < 8; i++)
      ta.push(Math.PI - 0.16 + Math.sin(time * 2.0 - i * 0.5) * 0.06 - i * 0.03 + L * 0.4);
    R.taperChain(-0.05 * h, hipY, h * 0.11, ta, 0.19 * h, 0.02 * h, P.skin2, { taper: 0.93 });
    for (let i = 0; i < 4; i++)
      R.crystal(-0.14 * h - i * 0.11 * h, hipY - 0.02 * h, h * (0.10 - i * 0.015), h * 0.05,
                R.rgba(P.crystal, 0.75), null);

    /* dorsal fins become octagonal crystals */
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      R.crystal(-0.10 * h - t * h * 0.60, hipY - 0.05 * h - t * 0.10 * h,
                h * (0.19 - t * 0.07), h * (0.09 - t * 0.03),
                R.rgba(P.crystal, 0.85), R.rgba('#ffffff', 0.35));
    }

    const st = fly ? 0 : p.g.amt;
    [[-0.03, p.g.p], [0.09, p.g.p2]].forEach(([ox, ph2]) => {
      const fx = ox * h + ph2 * 0.09 * h * st;
      R.limb(ox * h, hipY, [ox * h + ph2 * 0.05 * h * st, -0.20 * h], fx, fly ? -0.14 * h : 0,
             0.08 * h, 0.05 * h, R.shade(P.skin, -0.10), 0.045 * h);
    });

    ctx.save(); ctx.translate(0, p.bob); ctx.rotate(L * 0.3);
    R.smooth([[-0.17 * h, hipY - p.bob], [0.15 * h, hipY - p.bob], [0.20 * h, -0.60 * h],
              [0.12 * h, shY], [-0.14 * h, shY], [-0.21 * h, -0.60 * h]],
             R.bodyGradient(-0.2 * h, shY, 0.2 * h, hipY, P.skin));
    /* magenta belly plates */
    R.smooth([[0.01 * h, hipY - p.bob], [0.14 * h, -0.58 * h], [0.09 * h, shY], [-0.02 * h, shY]],
             R.rgba(P.belly, 0.75));
    /* four shoulder crystals, the signature silhouette */
    for (let i = 0; i < 4; i++) {
      const sx = -0.14 * h + i * 0.10 * h, sy = shY - 0.01 * h;
      R.crystal(sx, sy, h * (0.20 + 0.05 * Math.sin(time * 2 + i)), h * 0.075,
                R.rgba(P.crystal, 0.9), 'rgba(255,255,255,.4)');
      if (f.state.name === 'attack' && f.state.atk && f.state.atk.id === 'corona')
        R.glow(sx, sy - h * 0.16, h * 0.14, P.accent, 0.5);
    }
    /* arms */
    const armS = p.wind ? -0.5 : p.act ? 0.9 : 0.1;
    R.limb(0.10 * h, shY + 0.03 * h, [0.18 * h, -0.63 * h],
           0.20 * h + armS * 0.07 * h, -0.60 * h, 0.05 * h, 0.032 * h,
           R.shade(P.skin, -0.06), 0.035 * h);
    /* neck + head, Godzilla-shaped but with a forehead crystal */
    const [hx, hy] = R.taperChain(0.06 * h, shY, h * 0.11, [-0.30 + L, -0.10 + L * 0.6],
                                  0.14 * h, 0.10 * h, P.skin);
    const headX = hx + 0.06 * h, headY = hy - 0.03 * h;
    const jaw = jawOpen(f, 0.12 + Math.sin(time * 1.2) * 0.05);
    R.smooth([[headX - 0.09 * h, headY - 0.05 * h], [headX + 0.13 * h, headY - 0.04 * h],
              [headX + 0.17 * h, headY + 0.01 * h], [headX - 0.06 * h, headY + 0.03 * h]],
             R.bodyGradient(headX - 0.08 * h, headY, headX + 0.16 * h, headY, P.skin));
    ctx.save();
    ctx.translate(headX - 0.05 * h, headY + 0.02 * h); ctx.rotate(jaw * 0.3);
    R.poly([[0, 0], [0.19 * h, 0.005 * h], [0.18 * h, 0.03 * h], [0, 0.04 * h]],
           R.shade(P.skin, -0.12));
    ctx.restore();
    R.mouth(headX + 0.06 * h, headY + 0.015 * h, 0.16 * h, 0.05 * h, jaw, '#f2ecdc', 5);
    R.eye(headX - 0.02 * h, headY - 0.025 * h, 0.022 * h, P.eye, '#c8d8f0', P.accent);
    R.crystal(headX - 0.01 * h, headY - 0.045 * h, h * 0.11, h * 0.05,
              R.rgba(P.crystal, 0.95), 'rgba(255,255,255,.5)');
    ctx.restore();

    /* the photon-reactive shield: a hexagonal crystal shell */
    if (f.shield) {
      ctx.save();
      ctx.strokeStyle = R.rgba(P.accent, 0.55); ctx.lineWidth = 2;
      ctx.fillStyle = R.rgba(P.accent, 0.10);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + time * 0.6;
        const px = Math.cos(a) * h * 0.52, py = -0.55 * h + Math.sin(a) * h * 0.58;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      R.glow(0, -0.55 * h, h * 0.60, P.accent, 0.22);
    }
    if (fly) {
      /* cold blue jets under the body while hovering */
      for (let i = 0; i < 4; i++)
        R.glow(-0.18 * h + i * 0.12 * h, -0.06 * h, h * 0.11, '#8fc8ff',
               0.45 + 0.2 * Math.sin(time * 14 + i));
    }
    chargeGlow(f, h, headX + 0.10 * h, headY, P.accent);
  }
  function spacegodzillaFly(f, time) { spacegodzilla(f, time, true); }

  /* ---------------- 10. デストロイア ---------------- */
  function destoroyah(f, time) {
    const h = f.h, P = f.pal, p = pose(f, time);
    const hipY = -0.38 * h + p.bob, shY = -0.68 * h + p.bob;
    R.shadow(0, 2, h * 0.48);

    /* insectoid abdomen and folded wings */
    const ta = [];
    for (let i = 0; i < 5; i++) ta.push(Math.PI - 0.28 + i * 0.09 + Math.sin(time * 2.2 - i * 0.4) * 0.05);
    R.taperChain(-0.10 * h, hipY + 0.04 * h, h * 0.12, ta, 0.16 * h, 0.05 * h, P.skin2, { taper: 0.94 });
    const flap = f.airborne ? Math.sin(time * 9) * 0.4 : Math.sin(time * 1.8) * 0.06;
    R.wing(-0.04 * h, shY, h * 0.66, h * 0.30, Math.PI - 0.45 - flap,
           R.rgba(R.mix(P.plate, '#ffffff', 0.35), 0.55), 4, 'rgba(0,0,0,.25)');
    R.wing(0.02 * h, shY, h * 0.60, h * 0.26, 0.42 + flap,
           R.rgba(R.mix(P.plate, '#ffffff', 0.25), 0.45), 4, 'rgba(0,0,0,.25)');

    /* two thick legs, horseshoe-crab stance */
    const st = p.g.amt;
    [[-0.05, p.g.p], [0.07, p.g.p2]].forEach(([ox, ph2]) => {
      const fx = ox * h + ph2 * 0.10 * h * st;
      R.limb(ox * h, hipY, [ox * h + ph2 * 0.06 * h * st, -0.19 * h], fx, 0,
             0.085 * h, 0.055 * h, R.shade(P.skin2, -0.06), 0.05 * h);
      R.poly([[fx - 0.06 * h, -0.02 * h], [fx + 0.13 * h, -0.02 * h],
              [fx + 0.15 * h, 0], [fx - 0.07 * h, 0]], R.shade(P.plate, -0.2));
    });

    ctx.save(); ctx.translate(0, p.bob * 0.6); ctx.rotate(p.lean * 0.3);
    /* layered carapace */
    R.smooth([[-0.18 * h, hipY], [0.16 * h, hipY], [0.22 * h, -0.55 * h], [0.12 * h, shY],
              [-0.16 * h, shY], [-0.22 * h, -0.55 * h]],
             R.bodyGradient(-0.2 * h, shY, 0.2 * h, hipY, P.skin));
    for (let i = 0; i < 4; i++)
      R.smooth([[-0.20 * h + i * 0.02 * h, -0.44 * h - i * 0.06 * h],
                [0.20 * h - i * 0.02 * h, -0.44 * h - i * 0.06 * h],
                [0.16 * h - i * 0.02 * h, -0.50 * h - i * 0.06 * h],
                [-0.16 * h + i * 0.02 * h, -0.50 * h - i * 0.06 * h]],
               R.rgba(P.plate, 0.55));
    R.smooth([[0.02 * h, hipY], [0.15 * h, -0.52 * h], [0.09 * h, shY], [-0.02 * h, shY]],
             R.rgba(P.belly, 0.55));

    /* arms ending in variable slicer blades */
    const armS = p.wind ? -0.5 : p.act ? 1.1 : 0.2;
    for (let s = 0; s < 2; s++) {
      const sx = 0.10 * h - s * 0.03 * h, sy = shY + 0.02 * h + s * 0.06 * h;
      R.limb(sx, sy, [sx + 0.12 * h, sy - 0.04 * h], sx + (0.20 + armS * 0.12) * h, sy,
             0.055 * h, 0.038 * h, R.shade(P.skin2, -0.05), 0.042 * h);
      const tx = sx + (0.20 + armS * 0.12) * h, ty = sy;
      for (let k = 0; k < 3; k++)
        R.spike(tx, ty, 0.13 * h, -0.6 + k * 0.6, 0.02 * h, P.horn);
    }

    /* head with the forehead horn blade and orange eyes */
    R.taperChain(0.06 * h, shY, h * 0.09, [-0.45, -0.2], 0.12 * h, 0.09 * h, P.skin);
    const hx = 0.14 * h, hy = shY - 0.09 * h;
    R.smooth([[hx - 0.08 * h, hy - 0.06 * h], [hx + 0.12 * h, hy - 0.05 * h],
              [hx + 0.17 * h, hy + 0.01 * h], [hx - 0.07 * h, hy + 0.05 * h]],
             R.bodyGradient(hx - 0.07 * h, hy, hx + 0.16 * h, hy, P.plate));
    const jaw = jawOpen(f, 0.18 + Math.sin(time * 2) * 0.06);
    ctx.save(); ctx.translate(hx - 0.04 * h, hy + 0.02 * h); ctx.rotate(jaw * 0.3);
    R.poly([[0, 0], [0.20 * h, 0.004 * h], [0.19 * h, 0.03 * h], [0, 0.038 * h]],
           R.shade(P.skin2, -0.1));
    ctx.restore();
    R.mouth(hx + 0.08 * h, hy + 0.012 * h, 0.17 * h, 0.05 * h, jaw, '#f2ecdc', 6);
    /* the variable slicer horn */
    R.spike(hx + 0.02 * h, hy - 0.05 * h, 0.26 * h, -0.15, 0.045 * h, P.horn);
    for (let k = 0; k < 3; k++)
      R.spike(hx - 0.05 * h - k * 0.03 * h, hy - 0.05 * h, 0.11 * h,
              -Math.PI / 2 - 0.5 - k * 0.28, 0.02 * h, P.horn);
    R.eye(hx - 0.01 * h, hy - 0.02 * h, 0.026 * h, P.eye, '#8a3a1a',
          p.act || p.wind ? P.accent : null);
    ctx.restore();
    chargeGlow(f, h, hx + 0.10 * h, hy, P.accent);
  }

  /* デストロイア幼体 — small, ant-like, single horn */
  function destoroyahJuv(f, time) {
    const h = f.h, P = f.pal, p = pose(f, time);
    const bodyY = -0.46 * h + p.bob;
    R.shadow(0, 2, h * 0.42);
    const ta = [];
    for (let i = 0; i < 4; i++) ta.push(Math.PI - 0.2 + i * 0.1 + Math.sin(time * 4 - i * 0.5) * 0.08);
    R.taperChain(-0.08 * h, bodyY, h * 0.08, ta, 0.10 * h, 0.03 * h, P.skin2, { taper: 0.94 });
    const st = p.g.amt;
    for (let i = 0; i < 4; i++) {
      const ox = -0.12 * h + i * 0.08 * h;
      const ph2 = Math.sin(time * 11 + i * 1.6) * st;
      R.limb(ox, bodyY + 0.06 * h, [ox - 0.03 * h + ph2 * 0.03 * h, -0.14 * h],
             ox - 0.06 * h + ph2 * 0.07 * h, 0, 0.03 * h, 0.018 * h, R.shade(P.skin2, -0.08));
    }
    ctx.save(); ctx.translate(0, p.bob * 0.5); ctx.rotate(p.lean * 0.3);
    R.smooth([[-0.16 * h, bodyY + 0.06 * h], [-0.12 * h, bodyY - 0.10 * h], [0.08 * h, bodyY - 0.13 * h],
              [0.18 * h, bodyY - 0.03 * h], [0.16 * h, bodyY + 0.07 * h], [-0.02 * h, bodyY + 0.10 * h]],
             R.bodyGradient(-0.16 * h, bodyY - 0.13 * h, 0.18 * h, bodyY + 0.08 * h, P.skin));
    /* short arms with pincers */
    const open = p.act ? 0.05 : 0.4;
    R.pincer(0.18 * h, bodyY - 0.01 * h, 0.16 * h, 0.1, open, P.plate, P.skin2);
    /* single hollow horn, shorter than the perfect form's */
    const hx = 0.16 * h, hy = bodyY - 0.07 * h;
    R.smooth([[hx - 0.06 * h, hy - 0.04 * h], [hx + 0.10 * h, hy - 0.03 * h],
              [hx + 0.14 * h, hy + 0.01 * h], [hx - 0.05 * h, hy + 0.03 * h]], P.plate);
    R.spike(hx + 0.01 * h, hy - 0.03 * h, 0.17 * h, -0.2, 0.03 * h, P.horn);
    const jaw = jawOpen(f, 0.2);
    R.mouth(hx + 0.06 * h, hy + 0.01 * h, 0.12 * h, 0.04 * h, jaw, '#f2ecdc', 4);
    R.eye(hx - 0.01 * h, hy - 0.015 * h, 0.022 * h, P.eye, '#8a3a1a');
    ctx.restore();
    chargeGlow(f, h, hx + 0.06 * h, hy, P.accent);
  }

  /* ---------------- registry ---------------- */
  const DRAWERS = {
    godzilla, burningGodzilla,
    anguirus, ebirah,
    rodan, rodan_fire: rodanFire,
    mothra, mothra_larva: mothraLarva,
    gigan, hedorah, hedorah_saucer: hedorahSaucer,
    ghidorah, biollante, biollante_beast: biollanteBeast,
    spacegodzilla, spacegodzilla_fly: spacegodzillaFly,
    destoroyah, destoroyah_juv: destoroyahJuv,
  };

  /* Draw a fighter. The caller has already translated to the
     fighter's feet and flipped the context for the facing. */
  function draw(f, time) {
    const art = f.art || f.def.art;
    const fn = DRAWERS[art] || DRAWERS[art.replace(/-/g, '_')] || godzilla;
    fn(f, time);
  }

  return { draw, DRAWERS, godzilla, burningGodzilla };
})();
