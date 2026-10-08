/* =========================================================
   art.js — 怪獣の描画
   One function per silhouette, composed from rig.js shapes and
   the Shade.js material/lighting layer.
   Local space: feet at (0,0), body grows toward -y, forward is +x.
   Shapes are fractions of f.h, so the same code serves a 40 m
   aggregate form and a 120 m perfect form. Anatomy notes are in
   docs/research.md; the light rig and textures live in shade.js.
   ========================================================= */
'use strict';

const Art = (() => {
  const R = Rig;
  const S = Shade;
  const PI = Math.PI;

  /* Deterministic per-part texture seeds. A drawer always builds its
     parts in the same order, so each part keeps one stable texture and
     the detail never crawls between frames. */
  let _sc = 0;
  function seed(n) { return _sc + (n === undefined ? (++_sc) : n * 131); }

  /* ---------------- shaded primitives ---------------- */

  /* two-segment limb drawn as one shaded mass instead of flat capsules */
  function limb(x1, y1, mid, x3, y3, w1, w3, base, o) {
    o = o || {};
    const [mx, my] = mid;
    const a1 = Math.atan2(my - y1, mx - x1), a2 = Math.atan2(y3 - my, x3 - mx);
    const n1 = a1 + PI / 2, n2 = a2 + PI / 2;
    const q1 = w1 / 2, q2 = w3 / 2, k = 1.08;
    const pts = [
      [x1 + Math.cos(n1) * q1, y1 + Math.sin(n1) * q1],
      [mx + Math.cos(n1) * q1 * k, my + Math.sin(n1) * q1 * k],
      [mx + Math.cos(n2) * q2 * k, my + Math.sin(n2) * q2 * k],
      [x3 + Math.cos(n2) * q2, y3 + Math.sin(n2) * q2],
      [x3 - Math.cos(n2) * q2, y3 - Math.sin(n2) * q2],
      [mx - Math.cos(n2) * q2 * k, my - Math.sin(n2) * q2 * k],
      [mx - Math.cos(n1) * q1 * k, my - Math.sin(n1) * q1 * k],
      [x1 - Math.cos(n1) * q1, y1 - Math.sin(n1) * q1],
    ];
    S.body(pts, base, {
      rounded: true, tex: o.tex || 'scales', seed: seed(o.seed),
      gloss: o.gloss, rimOn: o.rimOn, texSize: o.texSize, anchor: o.anchor,
    });
    if (o.capR) S.flat([[x3 + o.capR, y3], [x3, y3 + o.capR], [x3 - o.capR, y3], [x3, y3 - o.capR]], base, true);
    return [x3, y3];
  }

  /* joint positions of a chain, so callers can hang things off them */
  function chainJoints(x, y, len, angles, taper) {
    const J = [[x, y]];
    let px = x, py = y;
    for (let i = 0; i < angles.length; i++) {
      const a = angles[i];
      const L = len * (taper ? Math.pow(taper, i) : 1);
      px += Math.cos(a) * L; py += Math.sin(a) * L;
      J.push([px, py]);
    }
    return J;
  }

  /* joint chain (tail, neck, tentacle) built as a tapered tube: one
     outline around the joints, each joint offset along the averaged
     normal so the silhouette stays smooth and solid */
  function chain(x, y, len, angles, w0, w1, base, o) {
    o = o || {};
    const n = angles.length, J = chainJoints(x, y, len, angles, o.taper);
    const left = [], right = [];
    for (let i = 0; i <= n; i++) {
      const w = R.lerp(w0, w1, i / n) / 2;
      const a = i === 0 ? angles[0] : i === n ? angles[n - 1] : (angles[i - 1] + angles[i]) / 2;
      const na = a + PI / 2;
      left.push([J[i][0] + Math.cos(na) * w, J[i][1] + Math.sin(na) * w]);
      right.push([J[i][0] - Math.cos(na) * w, J[i][1] - Math.sin(na) * w]);
    }
    S.body(left.concat(right.reverse()), base, {
      rounded: o.rounded === undefined ? true : o.rounded,
      tex: o.tex || 'scales', seed: seed(o.seed), gloss: o.gloss,
      rimOn: o.rimOn, texSize: o.texSize, ao: o.ao,
    });
    return J[J.length - 1];
  }

  /* half-width of a chain tapering from w0 to w1 at parameter t */
  function chainW(w0, w1, t) { return R.lerp(w0, w1, t) / 2; }

  /* horn, claw, tooth or spine */
  function spike(x, y, len, ang, w, base, o) {
    o = o || {};
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    S.body([[0, -w / 2], [len * 0.72, -w * 0.22], [len, 0], [len * 0.72, w * 0.22], [0, w / 2]],
      base, { rounded: false, flat: true, gloss: o.gloss, seed: seed(o.seed) });
    if (o.tip) S.flat([[len * 0.55, -w * 0.20], [len, 0], [len * 0.55, w * 0.20]], o.tip, false);
    ctx.restore();
  }

  /* wing from a shoulder: lobed membrane, backlit because it is thin */
  function wing(x, y, span, chord, rot, base, o) {
    o = o || {};
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    S.body([[0, 0], [span * 0.30, -chord * 0.88], [span * 0.72, -chord * 0.62], [span, -chord * 0.42],
            [span * 0.88, chord * 0.06], [span * 0.55, chord * 0.18], [span * 0.24, chord * 0.30]],
      base, {
        rounded: true, tex: o.tex || 'membrane', texSize: o.texSize || 9,
        trans: o.trans === undefined ? 0.45 : o.trans, gloss: o.gloss,
        seed: seed(o.seed), rimOn: true, rimW: o.rimW,
      });
    const nv = o.veins === undefined ? 4 : o.veins;
    if (nv > 0) {
      ctx.strokeStyle = R.rgba(R.shade(base, -0.35), 0.45);
      ctx.lineWidth = Math.max(1, span * 0.008);
      for (let i = 1; i <= nv; i++) {
        const t = i / (nv + 1);
        ctx.beginPath();
        ctx.moveTo(span * 0.04, 0);
        ctx.quadraticCurveTo(span * 0.4, -chord * 0.6 * t, span * t, -chord * 0.42 * t + chord * 0.04);
        ctx.stroke();
      }
    }
    if (o.fold) {
      ctx.strokeStyle = R.rgba(R.shade(base, -0.4), 0.35);
      ctx.lineWidth = Math.max(1, span * 0.012);
      ctx.beginPath();
      ctx.moveTo(span * 0.12, chord * 0.10);
      ctx.quadraticCurveTo(span * 0.5, chord * 0.02, span * 0.9, -chord * 0.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* classic maple-leaf dorsal plate, shaded */
  function dorsal(x, y, hh, w, ang, base, o) {
    o = o || {};
    ctx.save();
    ctx.translate(x, y); if (ang) ctx.rotate(ang);
    S.body([[-w, 0], [-w * 0.62, -hh * 0.34], [-w * 0.22, -hh * 0.62], [0, -hh],
            [w * 0.34, -hh * 0.66], [w * 0.62, -hh * 0.34], [w * 0.9, 0]],
      base, { rounded: true, tex: o.tex || 'plates', seed: seed(o.seed), gloss: o.gloss, rimOn: true });
    ctx.restore();
  }

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
    S.glow(x, y, h * (0.10 + 0.16 * k), color, 0.35 + 0.4 * k);
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

  /* contact shadow plus a little bounce light where a limb lands */
  function plant(x, w, base) {
    S.contact([[x - w, 0], [x + w, 0]], { w: w * 1.7, lift: 0.10 });
    S.wash(x, -w * 0.35, w * 1.3, base, 0.10);
  }

  /* ---------------- ゴジラ ----------------
     Bipedal, thick tail, maple-leaf dorsals, keloid hide (the
     atomic-burn scar read), heavy brow ridge, tiny arms. */
  function godzilla(f, time, opt) {
    opt = opt || {};
    const h = f.h, P = f.pal, p = pose(f, time);
    const skin = opt.skin || P.skin, belly = opt.belly || P.belly, fin = opt.fin || P.fin;
    const hipY = -0.40 * h + p.bob, shY = -0.74 * h + p.bob;
    const L = p.lean;
    let headX = 0.2 * h, headY = -0.9 * h;

    R.shadow(0, 2, h * 0.42);
    S.contact([[-0.42 * h, 0], [0.34 * h, 0]], { w: h * 0.16 });

    /* tail: heavy counterweight that sweeps down behind him */
    const ta = [];
    for (let i = 0; i < 8; i++)
      ta.push(PI - 0.30 - i * 0.03 + Math.sin(time * 2.2 - i * 0.55) * 0.06 + L * 0.4);
    const TJ = chainJoints(-0.05 * h, hipY, h * 0.105, ta, 0.95);
    chain(-0.05 * h, hipY, h * 0.105, ta, 0.22 * h, 0.05 * h,
      R.shade(skin, -0.05), { taper: 0.95, tex: 'keloid', texSize: 15, seed: 3 });

    /* maple-leaf dorsals: two on the back, three riding the tail's
       upper edge so none of them float free of the body */
    [[-0.13 * h, shY + 0.05 * h, 0.17 * h, -0.22],
     [-0.20 * h, shY + 0.21 * h, 0.15 * h, -0.30]].forEach(([bx, by, hh, rot], k) =>
      dorsal(bx, by, hh, h * 0.085, rot, R.shade(fin, -0.10 - k * 0.06), { seed: 10 + k }));
    [1, 3, 5].forEach((j, k) => {
      const a = (ta[j - 1] + ta[Math.min(j, ta.length - 1)]) / 2;
      const w = chainW(0.22 * h, 0.05 * h, j / 8);
      dorsal(TJ[j][0] + Math.cos(a + PI / 2) * w * 0.85,
        TJ[j][1] + Math.sin(a + PI / 2) * w * 0.85,
        h * (0.135 - k * 0.028), h * (0.075 - k * 0.018), a + PI,
        R.shade(fin, -0.22 - k * 0.06), { seed: 13 + k });
    });

    /* digitigrade legs — the far leg is hazier and set back */
    const st = p.g.amt;
    [[-0.02, p.g.p, true], [0.10, p.g.p2, false]].forEach(([ox, ph2, far]) => {
      const fx = ox * h + ph2 * 0.10 * h * st;
      const base = far ? S.far(R.shade(skin, -0.16), 0.35) : R.shade(skin, -0.10);
      if (far) plant(fx, 0.09 * h, base);
      /* thigh mass, so the leg is a column with weight, not a stilt */
      S.body([[ox * h - 0.10 * h, hipY - p.bob - 0.05 * h], [ox * h + 0.11 * h, hipY - p.bob - 0.03 * h],
              [ox * h + 0.09 * h, hipY - p.bob + 0.12 * h], [ox * h - 0.09 * h, hipY - p.bob + 0.12 * h]],
        base, { rounded: true, tex: 'keloid', texSize: 14, seed: seed(19) });
      limb(ox * h, hipY, [ox * h + ph2 * 0.06 * h * st, -0.20 * h + p.bob * 0.4],
        fx, far ? -0.006 * h : 0, 0.115 * h, 0.062 * h, base,
        { tex: 'keloid', texSize: 13, seed: 20 + (far ? 0 : 1) });
      S.body([[fx - 0.06 * h, -0.016 * h], [fx + 0.13 * h, -0.016 * h],
              [fx + 0.15 * h, far ? -0.004 * h : 0], [fx - 0.07 * h, far ? -0.004 * h : 0]],
        R.shade(skin, far ? -0.26 : -0.18), { flat: true, seed: seed(22) });
      if (!far) plant(fx, 0.10 * h, base);
    });

    ctx.save();
    ctx.translate(0, p.bob);
    ctx.rotate(L * 0.35);
    /* torso: the big mass takes key light, hemi, core shadow and rim */
    S.body([[-0.18 * h, hipY - p.bob], [0.16 * h, hipY - p.bob], [0.22 * h, -0.60 * h],
            [0.14 * h, shY], [-0.15 * h, shY], [-0.23 * h, -0.60 * h]],
      skin, { rounded: true, tex: 'keloid', texSize: 16, seed: 30, ao: 0.35, gloss: 0.10 });
    /* pale ventral plates */
    S.body([[0.03 * h, hipY - p.bob], [0.12 * h, -0.58 * h], [0.08 * h, shY + 0.04 * h],
            [0.00 * h, shY + 0.04 * h]],
      R.shade(belly, -0.22), { rounded: true, tex: 'scales', texSize: 11, seed: 31, gloss: 0.16 });
    for (let i = 0; i < 4; i++) {
      const y = -0.48 * h - i * 0.055 * h;
      S.flat([[0, y], [0.12 * h, y - 0.001 * h], [0.12 * h, y + 0.02 * h], [0, y + 0.01 * h]],
        R.rgba(R.shade(belly, -0.10), 0.35));
    }
    /* small arms */
    const armS = p.wind ? -0.5 : p.act ? 0.9 : 0.1;
    limb(0.10 * h, shY + 0.02 * h, [0.17 * h, -0.63 * h],
      0.19 * h + armS * 0.06 * h, -0.60 * h, 0.060 * h, 0.038 * h,
      R.shade(skin, -0.06), { tex: 'keloid', texSize: 10, seed: 33 });
    for (let k = 0; k < 3; k++)
      spike(0.19 * h + armS * 0.06 * h, -0.60 * h, 0.030 * h, 0.9 + k * 0.30,
        0.009 * h, belly, { seed: 38 + k, flat: true });
    /* neck: short, thick, weight-bearing */
    const [hx, hy] = chain(0.03 * h, shY, h * 0.055, [-1.15 + L, -0.75 + L * 0.6],
      0.22 * h, 0.19 * h, skin, { tex: 'keloid', texSize: 13, seed: 34 });
    headX = hx + 0.06 * h; headY = hy - 0.03 * h;
    const jaw = jawOpen(f, 0.12 + Math.sin(time * 1.3) * 0.05);
    S.body([[headX - 0.13 * h, headY - 0.085 * h], [headX + 0.15 * h, headY - 0.060 * h],
            [headX + 0.20 * h, headY + 0.015 * h], [headX - 0.08 * h, headY + 0.065 * h]],
      skin, { rounded: true, tex: 'keloid', texSize: 12, seed: 35, gloss: 0.12 });
    ctx.save();
    ctx.translate(headX - 0.05 * h, headY + 0.02 * h);
    ctx.rotate(jaw * 0.30);
    S.body([[0, 0], [0.19 * h, 0.005 * h], [0.18 * h, 0.03 * h], [0, 0.04 * h]],
      R.shade(skin, -0.12), { rounded: true, tex: 'keloid', texSize: 10, seed: 36 });
    ctx.restore();
    R.mouth(headX + 0.07 * h, headY + 0.020 * h, 0.19 * h, 0.062 * h, jaw, '#f2ecdc', 5);
    /* heavy brow ridge shading the eye */
    S.body([[headX - 0.05 * h, headY - 0.045 * h], [headX + 0.02 * h, headY - 0.05 * h],
            [headX + 0.02 * h, headY - 0.03 * h], [headX - 0.05 * h, headY - 0.025 * h]],
      R.shade(skin, -0.16), { flat: true, seed: 37 });
    R.eye(headX - 0.02 * h, headY - 0.025 * h, 0.022 * h, '#f0e8d0', P.eye || '#d8b020');
    S.sparkle(headX + 0.10 * h, headY - 0.03 * h, 0.02 * h, '#ffffff', 0.5);
    ctx.restore();

    /* atomic charge: mouth glow, and the whole body when burning */
    const col = opt.burning ? '#ff8a3c' : (P.glow || '#7fd8ff');
    chargeGlow(f, h, headX + 0.10 * h, headY, col);
    if (opt.burning) {
      S.wash(0, -0.55 * h, 0.45 * h, '#ff6a2a', 0.30 + Math.sin(time * 9) * 0.06);
      S.sparkle(-0.06 * h, -0.62 * h, 0.05 * h, '#ffd08a', 0.6);
      S.sparkle(0.08 * h, -0.44 * h, 0.04 * h, '#ffb04a', 0.5);
    }
    return { headX, headY };
  }

  function burningGodzilla(f, time) {
    godzilla(f, time, { skin: R.mix(f.pal.skin, '#8a3a2a', 0.35), fin: '#ffb04a', burning: true });
  }

  /* ---------------- 1. アンギラス ----------------
     Stout armoured quadruped: ankylosaurus, armadillo, hedgehog.
     Carapace studded with long prickly spikes, six inward-curving
     horns on the head, one horn on the snout tip, puffy crocodile face. */
  function anguirus(f, time) {
    const h = f.h, P = f.pal, p = pose(f, time);
    const bodyY = -0.52 * h + p.bob;
    R.shadow(0, 2, h * 0.55);
    S.contact([[-0.34 * h, 0], [0.30 * h, 0]], { w: h * 0.13 });

    /* tail about as long as the body, spiky */
    const ta = [];
    for (let i = 0; i < 9; i++) ta.push(PI - 0.05 + Math.sin(time * 2.6 - i * 0.5) * 0.08 + i * 0.02);
    chain(-0.12 * h, bodyY + 0.04 * h, h * 0.10, ta, 0.16 * h, 0.015 * h,
      R.shade(P.skin, -0.06), { taper: 0.94, tex: 'chitin', texSize: 12, seed: 3 });
    for (let i = 0; i < 7; i++)
      spike(-0.12 * h - i * 0.09 * h, bodyY + 0.02 * h - i * 0.008 * h,
        h * (0.075 - i * 0.006), -PI / 2 - 0.2 + Math.sin(time * 2.6 - i * 0.5) * 0.06,
        h * 0.03, P.spike, { seed: 4 + i, tip: R.rgba('#ffffff', 0.35) });

    /* four legs — hind limbs longer, so he can rear up */
    const st = p.g.amt;
    [[-0.10, p.g.p2, true], [-0.02, p.g.p, false], [0.14, p.g.p2 * 0.8, true], [0.23, p.g.p * 0.8, false]]
      .forEach(([ox, ph2, far], i) => {
        const base = far ? S.far(R.shade(P.skin, -0.12), 0.30) : R.shade(P.skin, -0.12);
        limb(ox * h, bodyY + 0.10 * h, [ox * h + ph2 * 0.03 * h * st, -0.14 * h],
          ox * h + ph2 * 0.07 * h * st, i < 2 ? -0.02 * h : (far ? -0.005 * h : 0),
          0.085 * h, 0.055 * h, base, { tex: 'chitin', texSize: 10, seed: 10 + i });
        if (!far) plant(ox * h + ph2 * 0.07 * h * st, 0.06 * h, base);
      });

    ctx.save(); ctx.translate(0, p.bob * 0.6); ctx.rotate(p.lean * 0.2);
    /* armoured dome */
    S.body([[-0.24 * h, bodyY + 0.10 * h], [-0.20 * h, bodyY - 0.10 * h], [0.02 * h, bodyY - 0.16 * h],
            [0.20 * h, bodyY - 0.08 * h], [0.24 * h, bodyY + 0.08 * h], [0, bodyY + 0.14 * h]],
      P.skin, { rounded: true, tex: 'chitin', texSize: 15, seed: 20, ao: 0.30, gloss: 0.14 });
    /* "a plethora of long, sharp, prickly spikes" */
    for (let i = 0; i < 13; i++) {
      const a = PI * (1.02 - (i / 12) * 0.98);
      spike(Math.cos(a) * 0.22 * h, bodyY - 0.02 * h + Math.sin(a) * 0.15 * h,
        h * (0.055 + 0.03 * Math.sin(i * 2.1)), a - PI / 2, h * 0.022,
        P.spike, { seed: 21 + i, tip: R.rgba('#ffffff', 0.30) });
    }
    /* head: long puffy snout, snout horn, curled head horns, lower tusks */
    chain(0.18 * h, bodyY - 0.04 * h, h * 0.09, [-0.05, 0.02], 0.14 * h, 0.09 * h, P.skin,
      { tex: 'chitin', texSize: 12, seed: 30 });
    const hx = 0.30 * h, hy = bodyY - 0.02 * h;
    S.body([[hx - 0.10 * h, hy - 0.06 * h], [hx + 0.16 * h, hy - 0.04 * h],
            [hx + 0.20 * h, hy + 0.01 * h], [hx - 0.08 * h, hy + 0.05 * h]],
      P.skin, { rounded: true, tex: 'chitin', texSize: 12, seed: 31, gloss: 0.12 });
    const jaw = jawOpen(f, 0.1);
    ctx.save(); ctx.translate(hx - 0.06 * h, hy + 0.02 * h); ctx.rotate(jaw * 0.26);
    S.body([[0, 0], [0.24 * h, 0], [0.23 * h, 0.028 * h], [0, 0.036 * h]],
      R.shade(P.skin, -0.14), { rounded: true, tex: 'chitin', texSize: 10, seed: 32 });
    /* two large tusks and rows of small serrated teeth */
    spike(0.02 * h, 0, 0.05 * h, -PI / 2, 0.02 * h, '#f2ecdc', { seed: 33 });
    spike(0.16 * h, 0, 0.042 * h, -PI / 2 + 0.2, 0.017 * h, '#f2ecdc', { seed: 34 });
    for (let i = 0; i < 5; i++)
      spike(0.06 * h + i * 0.035 * h, 0.002 * h, 0.02 * h, -PI / 2, 0.009 * h, '#e8e0cc', { seed: 35 + i });
    ctx.restore();
    /* single short horn on the snout tip */
    spike(hx + 0.19 * h, hy - 0.015 * h, 0.055 * h, 0.1, 0.026 * h, P.spike, { seed: 36, tip: R.rgba('#fff', 0.3) });
    /* six horns curling back over the top of the head */
    for (let i = 0; i < 6; i++)
      spike(hx - 0.07 * h + i * 0.032 * h, hy - 0.055 * h, 0.06 * h,
        -PI / 2 - 0.62 + i * 0.20, 0.022 * h, P.spike, { seed: 40 + i });
    R.eye(hx - 0.02 * h, hy - 0.03 * h, 0.02 * h, '#f0e8d0', P.eye);
    ctx.restore();
    chargeGlow(f, h, 0.3 * h, bodyY, P.accent);
  }

  /* ---------------- 2. エビラ ----------------
     Giant lobster: red chitin, one pincer larger than the other,
     two antennae and two whiskers, a long curved rostrum, six
     walking legs, a fan-tailed abdomen, stalked eyes under brow ridges. */
  function ebirah(f, time) {
    const h = f.h, P = f.pal, p = pose(f, time);
    const bodyY = -0.50 * h + p.bob;
    R.shadow(0, 2, h * 0.6);
    S.contact([[-0.44 * h, 0], [0.34 * h, 0]], { w: h * 0.13 });

    /* segmented abdomen and tail fan */
    const ta = [];
    for (let i = 0; i < 6; i++) ta.push(PI - 0.30 + i * 0.10 + Math.sin(time * 1.8 - i * 0.4) * 0.05);
    chain(-0.10 * h, bodyY + 0.02 * h, h * 0.11, ta, 0.20 * h, 0.06 * h, P.skin,
      { taper: 0.95, tex: 'chitin', texSize: 13, seed: 3 });
    for (let i = 0; i < 5; i++)
      S.body([[-0.60 * h, bodyY - 0.02 * h], [-0.72 * h - i * 0.01 * h, bodyY - 0.20 * h + i * 0.09 * h],
              [-0.66 * h, bodyY - 0.02 * h + i * 0.02 * h]],
        i % 2 ? P.skin2 : R.shade(P.skin2, -0.08),
        { rounded: true, tex: 'membrane', texSize: 9, seed: 5 + i, trans: 0.25 });

    /* six walking legs, alternating near and far */
    const st = p.g.amt;
    for (let i = 0; i < 6; i++) {
      const ox = -0.16 * h + i * 0.07 * h;
      const ph2 = Math.sin(time * 7.2 + i * 1.05) * st;
      const far = i % 2 === 0;
      const base = far ? S.far(R.shade(P.skin2, -0.05), 0.32) : R.shade(P.skin2, -0.05);
      limb(ox, bodyY + 0.12 * h, [ox - 0.04 * h + ph2 * 0.04 * h, -0.18 * h],
        ox - 0.08 * h + ph2 * 0.09 * h, far ? -0.005 * h : 0, 0.028 * h, 0.016 * h, base,
        { tex: 'chitin', texSize: 9, seed: 12 + i });
      if (!far) plant(ox - 0.08 * h + ph2 * 0.09 * h, 0.03 * h, base);
    }

    ctx.save(); ctx.translate(0, p.bob * 0.5); ctx.rotate(p.lean * 0.2);
    /* cephalothorax */
    S.body([[-0.18 * h, bodyY + 0.10 * h], [-0.14 * h, bodyY - 0.14 * h], [0.08 * h, bodyY - 0.18 * h],
            [0.22 * h, bodyY - 0.06 * h], [0.20 * h, bodyY + 0.10 * h], [-0.02 * h, bodyY + 0.14 * h]],
      P.skin, { rounded: true, tex: 'chitin', texSize: 15, seed: 20, ao: 0.28, gloss: 0.20 });
    /* two rows of back spikes, red at the base ending in white */
    for (let i = 0; i < 5; i++) {
      spike(-0.12 * h + i * 0.07 * h, bodyY - 0.14 * h, 0.07 * h, -PI / 2 - 0.15, 0.03 * h,
        i % 2 ? P.spike : P.skin, { seed: 22 + i, tip: R.rgba('#ffffff', 0.5) });
      spike(-0.10 * h + i * 0.07 * h, bodyY - 0.09 * h, 0.045 * h, -PI / 2 + 0.1, 0.022 * h,
        P.spike, { seed: 27 + i });
    }
    /* long down-curved scythe rostrum */
    chain(0.18 * h, bodyY - 0.08 * h, h * 0.10, [0.30, 0.75], 0.06 * h, 0.008 * h, P.spike,
      { tex: 'none', seed: 30, gloss: 0.4 });
    /* large brow ridges over the eyes */
    S.body([[0.10 * h, bodyY - 0.16 * h], [0.24 * h, bodyY - 0.18 * h], [0.24 * h, bodyY - 0.13 * h],
            [0.10 * h, bodyY - 0.11 * h]], R.shade(P.skin, -0.20), { flat: true, seed: 31 });
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
    /* stalked pale-red eyes */
    R.eye(0.14 * h, bodyY - 0.13 * h, 0.026 * h, P.eye, '#3a1a1a');
    R.eye(0.19 * h, bodyY - 0.15 * h, 0.022 * h, P.eye, '#3a1a1a');
    ctx.restore();

    /* pincers: right massive (grasp, bludgeon), left slim (stab, skewer) */
    const open = p.wind ? 0.9 : p.act ? 0.05 : 0.35 + Math.sin(time * 1.7) * 0.12;
    const armY = bodyY + 0.02 * h;
    limb(0.10 * h, armY, [0.26 * h, armY - 0.06 * h], 0.36 * h, armY + 0.02 * h,
      0.045 * h, 0.035 * h, P.skin2, { tex: 'chitin', texSize: 10, seed: 40 });
    S.pincer(0.36 * h, armY + 0.02 * h, 0.30 * h, 0.05 + open * 0.1, open, P.skin, P.skin2);
    limb(0.08 * h, armY + 0.05 * h, [0.24 * h, armY + 0.02 * h], 0.34 * h, armY + 0.10 * h,
      0.032 * h, 0.022 * h, P.skin2, { tex: 'chitin', texSize: 9, seed: 41 });
    S.pincer(0.34 * h, armY + 0.10 * h, 0.22 * h, 0.22, open * 0.7, P.skin, P.skin2);
    chargeGlow(f, h, 0.22 * h, bodyY, P.accent);
  }

  /* ---------------- 3. ラドン ----------------
     Upright pterosaur: two legs, pointed beak, spiky chest, two
     horns at the back of the head, mahogany skin with two dark
     stripes and a dull gold ridge down the back. */
  function rodan(f, time, fire) {
    const h = f.h, P = f.pal, p = pose(f, time);
    const skin = fire ? R.mix(P.skin, '#c04a1a', 0.55) : P.skin;
    const hipY = -0.42 * h + p.bob, shY = -0.72 * h + p.bob;
    const fly = f.airborne || f.state.name === 'attack';
    R.shadow(0, 2, h * 0.40);
    S.contact([[-0.26 * h, 0], [0.24 * h, 0]], { w: h * 0.11 });

    /* broad membranous wings; the far one sits behind the body */
    const flap = fly ? Math.sin(time * 6.5) * 0.45 : Math.sin(time * 1.6) * 0.08;
    wing(-0.02 * h, shY, h * 0.86, h * 0.44, PI - 0.30 - flap,
      S.far(R.shade(skin, -0.14), 0.35), { trans: 0.50, veins: 4, seed: 4, fold: true });
    wing(0.02 * h, shY, h * 0.86, h * 0.44, 0.30 + flap, R.shade(skin, 0.04),
      { trans: 0.55, veins: 4, seed: 5, fold: true });

    chain(-0.06 * h, hipY, h * 0.08, [PI - 0.2, PI - 0.1], 0.09 * h, 0.02 * h, skin,
      { tex: 'muscle', texSize: 12, seed: 6 });

    /* thin legs with forward-pointing talons */
    const st = p.g.amt;
    [[-0.03, p.g.p, true], [0.05, p.g.p2, false]].forEach(([ox, ph2, far], i) => {
      const fx = ox * h + ph2 * 0.07 * h * st;
      const base = far ? S.far(R.shade(skin, -0.12), 0.30) : R.shade(skin, -0.12);
      limb(ox * h, hipY, [ox * h + ph2 * 0.04 * h * st, -0.20 * h], fx, far ? -0.004 * h : 0,
        0.045 * h, 0.026 * h, base, { tex: 'scales', texSize: 9, seed: 8 + i });
      for (let k = 0; k < 3; k++)
        spike(fx, far ? -0.014 * h : -0.01 * h, 0.05 * h, -0.3 + k * 0.35, 0.014 * h, P.spike, { seed: 9 + k });
      if (!far) plant(fx, 0.045 * h, base);
    });

    ctx.save(); ctx.translate(0, p.bob * 0.5); ctx.rotate(p.lean * 0.4);
    S.body([[-0.10 * h, hipY], [0.10 * h, hipY], [0.13 * h, -0.60 * h], [0.05 * h, shY],
            [-0.09 * h, shY], [-0.13 * h, -0.60 * h]],
      skin, { rounded: true, tex: 'muscle', texSize: 14, seed: 14, ao: 0.30, gloss: 0.12 });
    /* two blue-black stripes and a dull gold ridge running down the back */
    for (let i = 0; i < 2; i++)
      S.flat([[-0.065 * h - i * 0.035 * h, hipY - 0.02 * h], [-0.035 * h - i * 0.035 * h, hipY - 0.02 * h],
              [-0.012 * h - i * 0.030 * h, shY + 0.02 * h], [-0.042 * h - i * 0.030 * h, shY + 0.02 * h]],
        R.rgba('#2a2438', 0.55));
    S.flat([[-0.128 * h, hipY - 0.01 * h], [-0.098 * h, hipY - 0.01 * h],
            [-0.066 * h, shY], [-0.096 * h, shY]], R.rgba('#b89a52', 0.50));
    /* spiky chest */
    for (let i = 0; i < 5; i++)
      spike(0.06 * h + (i % 2) * 0.04 * h, -0.50 * h - i * 0.04 * h, 0.05 * h,
        -0.5 + (i % 2) * 0.4, 0.016 * h, P.spike, { seed: 16 + i });
    /* head: pointed beak and swept-back horns */
    chain(0.02 * h, shY, h * 0.08, [-0.5, -0.2], 0.10 * h, 0.07 * h, skin,
      { tex: 'scales', texSize: 10, seed: 22 });
    const hx = 0.10 * h, hy = shY - 0.08 * h;
    S.body([[hx - 0.06 * h, hy - 0.05 * h], [hx + 0.10 * h, hy - 0.03 * h],
            [hx + 0.22 * h, hy + 0.01 * h], [hx - 0.05 * h, hy + 0.04 * h]],
      skin, { rounded: true, tex: 'scales', texSize: 11, seed: 23, gloss: 0.14 });
    S.body([[hx + 0.10 * h, hy - 0.02 * h], [hx + 0.30 * h, hy + 0.01 * h], [hx + 0.10 * h, hy + 0.04 * h]],
      fire ? '#ffd070' : P.belly, { rounded: true, flat: true, seed: 24, gloss: 0.30 });
    /* two horns at the back of the head plus a small crest */
    for (let i = 0; i < 3; i++)
      spike(hx - 0.02 * h - i * 0.03 * h, hy - 0.05 * h, 0.09 * h,
        -PI / 2 - 0.5 - i * 0.25, 0.016 * h, P.spike, { seed: 25 + i });
    R.eye(hx + 0.03 * h, hy - 0.015 * h, 0.022 * h, '#f4ecd0', P.eye, fire ? '#ff8a3c' : null);
    ctx.restore();

    if (fire) S.glow(0.14 * h, shY - 0.06 * h, 0.22 * h, '#ff8a3c', 0.35 + Math.sin(time * 7) * 0.08);
    chargeGlow(f, h, 0.28 * h, shY - 0.06 * h, fire ? '#ff8a3c' : P.accent);
  }
  function rodanFire(f, time) { rodan(f, time, true); }

  /* ---------------- 4. モスラ ----------------
     Silkmoth: downy furry thorax, two pairs of pale wings with
     eyespots and red markings, large dark eyes, curled proboscis. */
  function mothra(f, time) {
    const h = f.h, P = f.pal, p = pose(f, time);
    const shY = -0.66 * h + p.bob;
    R.shadow(0, 2, h * 0.40);
    S.contact([[-0.20 * h, 0], [0.20 * h, 0]], { w: h * 0.09 });
    const flap = Math.sin(time * 4.2) * 0.35;

    /* wings: pale membrane, eyespots, red band near the root */
    for (let s = -1; s <= 1; s += 2) {
      const rot = s < 0 ? PI - 0.62 - flap : 0.62 + flap;
      const x = s * 0.02 * h, far = s < 0;
      wing(x, shY, h * 0.78, h * 0.42, rot, far ? S.far(P.wing, 0.42) : P.wing,
        { trans: 0.60, veins: 5, seed: 4 + (far ? 0 : 1), texSize: 10 });
      const cx = x + Math.cos(rot) * h * 0.62, cy = shY + Math.sin(rot) * h * 0.62;
      S.flat([[cx - h * 0.055, cy], [cx, cy - h * 0.055], [cx + h * 0.055, cy], [cx, cy + h * 0.055]],
        R.rgba('#7a5c2c', far ? 0.35 : 0.55));
      S.flat([[cx - h * 0.026, cy], [cx, cy - h * 0.026], [cx + h * 0.026, cy], [cx, cy + h * 0.026]],
        R.rgba('#3a2a14', far ? 0.40 : 0.60));
      S.sparkle(cx - h * 0.02, cy - h * 0.02, h * 0.014, '#ffffff', 0.45);
      S.flat([[x + Math.cos(rot) * h * 0.22, shY + Math.sin(rot) * h * 0.22],
              [x + Math.cos(rot + 0.16) * h * 0.36, shY + Math.sin(rot + 0.16) * h * 0.36],
              [x + Math.cos(rot - 0.10) * h * 0.34, shY + Math.sin(rot - 0.10) * h * 0.34]],
        R.rgba(P.skin2, far ? 0.30 : 0.50));
    }
    ctx.save(); ctx.translate(0, p.bob * 0.5);
    /* furry thorax, segmented abdomen */
    S.body([[-0.09 * h, shY + 0.10 * h], [0.09 * h, shY + 0.10 * h], [0.11 * h, shY - 0.04 * h],
            [-0.11 * h, shY - 0.04 * h]],
      P.skin, { rounded: true, tex: 'fur', texSize: 13, seed: 12, gloss: 0.05 });
    chain(-0.06 * h, shY + 0.08 * h, h * 0.10, [PI - 0.25, PI - 0.2, PI - 0.15],
      0.11 * h, 0.05 * h, P.skin2, { tex: 'fur', texSize: 12, seed: 13 });
    for (let i = 0; i < 3; i++)
      S.body([[-0.10 * h - i * 0.09 * h + h * 0.05, shY + 0.11 * h + i * 0.02 * h],
              [-0.10 * h - i * 0.09 * h, shY + 0.11 * h + i * 0.02 * h + h * 0.05],
              [-0.10 * h - i * 0.09 * h - h * 0.05, shY + 0.11 * h + i * 0.02 * h],
              [-0.10 * h - i * 0.09 * h, shY + 0.11 * h + i * 0.02 * h - h * 0.05]],
        i % 2 ? P.skin2 : R.shade(P.skin2, -0.06), { rounded: true, tex: 'fur', texSize: 11, seed: 14 + i });
    /* head: large dark eyes, plumose antennae, curled proboscis */
    const hx = 0.06 * h, hy = shY - 0.12 * h;
    S.body([[hx + h * 0.085, hy], [hx, hy + h * 0.085], [hx - h * 0.085, hy], [hx, hy - h * 0.085]],
      P.skin, { rounded: true, tex: 'fur', texSize: 11, seed: 20, gloss: 0.06 });
    R.eye(hx + 0.03 * h, hy - 0.01 * h, h * 0.045, '#2a2a3a', '#4a4a6a');
    R.eye(hx - 0.04 * h, hy - 0.02 * h, h * 0.036, '#2a2a3a', '#4a4a6a');
    S.sparkle(hx + 0.045 * h, hy - 0.025 * h, h * 0.014, '#ffffff', 0.5);
    ctx.strokeStyle = P.skin2; ctx.lineWidth = h * 0.012;
    for (let s = 0; s < 2; s++) {
      ctx.beginPath();
      ctx.moveTo(hx + (s ? 0.02 : -0.04) * h, hy - 0.07 * h);
      ctx.quadraticCurveTo(hx + (s ? 0.14 : -0.12) * h, hy - 0.20 * h,
        hx + (s ? 0.20 : -0.16) * h, hy - 0.14 * h);
      ctx.stroke();
      for (let k = 1; k <= 4; k++) {
        const t = k / 5;
        const bx = hx + (s ? 0.02 : -0.04) * h + (s ? 0.18 : -0.12) * h * t;
        const by = hy - 0.07 * h + (-0.13 * h) * t + 0.06 * h * t * t;
        ctx.beginPath(); ctx.moveTo(bx, by);
        ctx.lineTo(bx + (s ? 0.012 : -0.012) * h, by - 0.022 * h);
        ctx.stroke();
      }
    }
    ctx.beginPath();
    ctx.moveTo(hx + 0.06 * h, hy + 0.05 * h);
    ctx.quadraticCurveTo(hx + 0.16 * h, hy + 0.12 * h, hx + 0.10 * h, hy + 0.18 * h);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const ox = -0.04 * h + i * 0.05 * h;
      limb(ox, shY + 0.06 * h, [ox - 0.03 * h, -0.30 * h], ox - 0.05 * h, 0,
        0.02 * h, 0.012 * h, P.skin2, { tex: 'chitin', texSize: 7, seed: 24 + i });
    }
    ctx.restore();
    if (f.state.atk && f.state.atk.id === 'scales') S.wash(0, shY, h * 0.7, P.accent, 0.30);
    chargeGlow(f, h, hx + 0.05 * h, hy - 0.05 * h, P.accent);
  }

  function mothraLarva(f, time) {
    const h = f.h, P = f.pal, p = pose(f, time);
    R.shadow(0, 2, h * 0.60);
    S.contact([[-0.40 * h, 0], [0.30 * h, 0]], { w: h * 0.14 });
    const segs = 6, baseY = -0.42 * h + p.bob;
    for (let i = 0; i < segs; i++) {
      const t = i / (segs - 1);
      const x = -0.34 * h + i * h * 0.13;
      const y = baseY + Math.sin(time * 3.4 - i * 0.8) * h * 0.03;
      const r = h * (0.16 - 0.05 * Math.abs(t - 0.45));
      /* fuzzy caterpillar segment with a paler band */
      S.body([[x + r, y], [x, y + r], [x - r, y], [x, y - r]],
        i % 2 ? P.skin : R.shade(P.skin, -0.06),
        { rounded: true, tex: 'fur', texSize: 13, seed: 6 + i, gloss: 0.05 });
      S.flat([[x, y - r * 0.75], [x + r * 0.5, y - r * 0.35], [x, y - r * 0.05], [x - r * 0.5, y - r * 0.35]],
        R.rgba(R.shade(P.skin, 0.10), 0.55));
    }
    /* head with glowing blue eyes and mandibles */
    const hx = 0.22 * h, hy = baseY + Math.sin(time * 3.4 - 5 * 0.8) * h * 0.03;
    S.body([[hx + h * 0.15, hy], [hx, hy + h * 0.15], [hx - h * 0.15, hy], [hx, hy - h * 0.15]],
      P.skin, { rounded: true, tex: 'fur', texSize: 12, seed: 14, gloss: 0.06 });
    R.eye(hx + 0.04 * h, hy - 0.05 * h, h * 0.045, '#cfefff', P.eye, '#6fd8ff');
    R.eye(hx - 0.03 * h, hy - 0.07 * h, h * 0.032, '#cfefff', P.eye, null);
    const jaw = jawOpen(f, 0.15);
    for (let s = 0; s < 2; s++) {
      ctx.save();
      ctx.translate(hx + 0.06 * h, hy + 0.04 * h + s * 0.03 * h);
      ctx.rotate(0.25 + jaw * 0.35 + s * 0.25);
      S.body([[0, 0], [0.12 * h, 0.01 * h], [0.10 * h, 0.035 * h], [0, 0.03 * h]],
        P.skin2, { rounded: true, tex: 'chitin', texSize: 8, seed: 16 + s, gloss: 0.25 });
      ctx.restore();
    }
    /* silk spinneret at the front */
    S.flat([[hx + 0.11 * h + h * 0.03, hy + 0.09 * h], [hx + 0.11 * h, hy + 0.09 * h + h * 0.03],
            [hx + 0.11 * h - h * 0.03, hy + 0.09 * h], [hx + 0.11 * h, hy + 0.09 * h - h * 0.03]], '#f5f0e0', true);
    S.sparkle(hx + 0.11 * h, hy + 0.09 * h, h * 0.03, '#ffffff', 0.5);
    chargeGlow(f, h, hx + 0.08 * h, hy, P.accent);
  }

  function gigan(f, time) {
    const h = f.h, P = f.pal, p = pose(f, time);
    const hipY = -0.40 * h + p.bob, shY = -0.72 * h + p.bob;
    R.shadow(0, 2, h * 0.42);
    S.contact([[-0.24 * h, 0], [0.28 * h, 0]], { w: h * 0.12 });

    chain(-0.04 * h, hipY, h * 0.07, [PI - 0.25, PI - 0.05], 0.08 * h, 0.02 * h, P.skin2,
      { tex: 'plates', texSize: 10, seed: 3 });

    /* beetle wing cases with atomic jets */
    const jet = f.state.name === 'attack' && f.state.atk && f.state.atk.id === 'flydash';
    for (let s = -1; s <= 1; s += 2) {
      const rot = s < 0 ? PI - 0.55 : 0.55;
      wing(s * 0.01 * h, shY + 0.02 * h, h * 0.52, h * 0.26,
        rot + (jet ? Math.sin(time * 30) * 0.06 : 0),
        s < 0 ? S.far(R.shade(P.plate, -0.15), 0.30) : R.shade(P.plate, -0.15),
        { trans: 0.15, veins: 2, tex: 'plates', texSize: 9, seed: 5 + (s < 0 ? 0 : 1) });
      if (jet) S.glow(Math.cos(rot) * h * 0.45, shY + 0.10 * h, h * 0.16, '#8fd8ff', 0.55);
    }

    /* digitigrade legs with heavy metal boots */
    const st = p.g.amt;
    [[-0.04, p.g.p, true], [0.08, p.g.p2, false]].forEach(([ox, ph2, far], i) => {
      const fx = ox * h + ph2 * 0.09 * h * st;
      const base = far ? S.far(R.shade(P.skin, -0.10), 0.32) : R.shade(P.skin, -0.10);
      limb(ox * h, hipY, [ox * h + ph2 * 0.05 * h * st, -0.20 * h], fx, far ? -0.006 * h : 0,
        0.07 * h, 0.05 * h, base, { tex: 'muscle', texSize: 11, seed: 8 + i });
      S.body([[fx - 0.06 * h, -0.02 * h], [fx + 0.12 * h, -0.02 * h],
              [fx + 0.14 * h, far ? -0.005 * h : 0], [fx - 0.07 * h, far ? -0.005 * h : 0]],
        far ? S.far(R.shade(P.plate, -0.25), 0.30) : R.shade(P.plate, -0.25),
        { rounded: true, tex: 'metal', texSize: 9, seed: 10 + i, gloss: 0.5 });
      if (!far) plant(fx, 0.09 * h, base);
    });

    ctx.save(); ctx.translate(0, p.bob * 0.6); ctx.rotate(p.lean * 0.25);
    /* green body plated in gold */
    S.body([[-0.15 * h, hipY], [0.13 * h, hipY], [0.18 * h, -0.58 * h], [0.10 * h, shY],
            [-0.12 * h, shY], [-0.18 * h, -0.58 * h]],
      P.skin, { rounded: true, tex: 'muscle', texSize: 13, seed: 16, ao: 0.30, gloss: 0.12 });
    S.body([[-0.17 * h, shY + 0.02 * h], [0.17 * h, shY + 0.02 * h], [0.14 * h, -0.52 * h],
            [-0.14 * h, -0.52 * h]],
      P.plate, { rounded: true, tex: 'plates', texSize: 14, seed: 17, gloss: 0.42 });
    /* blue stripes down the carapace */
    for (let i = 0; i < 2; i++)
      S.flat([[-0.05 * h - i * 0.05 * h, shY], [-0.02 * h - i * 0.05 * h, shY],
              [-0.03 * h - i * 0.05 * h, -0.50 * h], [-0.06 * h - i * 0.05 * h, -0.50 * h]],
        R.rgba('#2a4a8a', 0.45));
    /* crescent chest spikes */
    for (let i = 0; i < 5; i++)
      spike(-0.12 * h + i * 0.06 * h, shY - 0.01 * h, 0.055 * h, -PI / 2 + (i - 2) * 0.30,
        0.02 * h, R.shade(P.plate, 0.12), { seed: 18 + i, tip: R.rgba('#fff', 0.35) });
    /* three sails on the back */
    for (let i = 0; i < 3; i++)
      S.body([[-0.14 * h - i * 0.05 * h, shY + 0.02 * h], [-0.16 * h - i * 0.06 * h, shY - 0.14 * h - i * 0.02 * h],
              [-0.08 * h - i * 0.03 * h, shY - 0.04 * h]],
        R.shade(P.plate, -0.10 - i * 0.04), { rounded: true, tex: 'plates', texSize: 9, seed: 24 + i, rimOn: true });
    /* abdominal rotating cutter */
    const cutY = -0.48 * h;
    const spin = (f.state.name === 'attack' && f.state.atk && f.state.atk.id === 'saw')
      ? time * 26 : time * 2.2;
    S.body([[0.02 * h + h * 0.10, cutY], [0.02 * h, cutY + h * 0.10], [0.02 * h - h * 0.10, cutY],
            [0.02 * h, cutY - h * 0.10]],
      R.shade(P.skin2, -0.10), { rounded: true, tex: 'metal', texSize: 8, seed: 30, gloss: 0.55 });
    for (let i = 0; i < 6; i++)
      spike(0.02 * h, cutY, h * 0.13, spin + i * PI / 3, h * 0.028, P.saw, { seed: 31 + i, gloss: 0.6 });
    S.flat([[0.02 * h + h * 0.035, cutY], [0.02 * h, cutY + h * 0.035], [0.02 * h - h * 0.035, cutY],
            [0.02 * h, cutY - h * 0.035]], R.shade(P.saw, -0.25), true);
    S.sparkle(0.02 * h + h * 0.06, cutY - h * 0.06, h * 0.03, '#ffffff', 0.55);

    /* hammer hands: metal hooks */
    const armS = p.wind ? -0.6 : p.act ? 1.0 : 0.15;
    for (let s = 0; s < 2; s++) {
      const sx = 0.10 * h - s * 0.02 * h, sy = shY + 0.03 * h + s * 0.05 * h;
      limb(sx, sy, [sx + 0.10 * h, sy - 0.02 * h], sx + (0.16 + armS * 0.10) * h, sy + 0.02 * h,
        0.045 * h, 0.035 * h, s ? R.shade(P.skin, -0.05) : S.far(R.shade(P.skin, -0.05), 0.28),
        { tex: 'metal', texSize: 9, seed: 40 + s, gloss: 0.45 });
      const hx2 = sx + (0.16 + armS * 0.10) * h, hy2 = sy + 0.02 * h;
      S.body([[hx2, hy2 - 0.03 * h], [hx2 + 0.09 * h, hy2 - 0.02 * h],
              [hx2 + 0.11 * h, hy2 + 0.03 * h], [hx2 + 0.05 * h, hy2 + 0.04 * h]],
        P.plate, { rounded: true, tex: 'metal', texSize: 8, seed: 42 + s, gloss: 0.6 });
      spike(hx2 + 0.08 * h, hy2 + 0.03 * h, 0.06 * h, 1.1, 0.018 * h, P.saw, { seed: 44 + s, gloss: 0.6 });
    }

    /* head: crimson visor, forehead laser aperture, crest horns */
    chain(0.04 * h, shY, h * 0.08, [-0.35, -0.15], 0.10 * h, 0.08 * h, P.skin,
      { tex: 'plates', texSize: 10, seed: 46 });
    const hx = 0.12 * h, hy = shY - 0.09 * h;
    S.body([[hx - 0.07 * h, hy - 0.06 * h], [hx + 0.11 * h, hy - 0.05 * h],
            [hx + 0.15 * h, hy + 0.02 * h], [hx - 0.06 * h, hy + 0.05 * h]],
      P.plate, { rounded: true, tex: 'metal', texSize: 10, seed: 47, gloss: 0.5 });
    S.body([[hx - 0.02 * h, hy - 0.01 * h], [hx + 0.14 * h, hy - 0.005 * h],
            [hx + 0.13 * h, hy + 0.025 * h], [hx - 0.02 * h, hy + 0.03 * h]],
      P.visor, { rounded: true, flat: true, seed: 48, gloss: 0.7 });
    S.glow(hx + 0.06 * h, hy + 0.01 * h, h * 0.09, P.visor, 0.45 + Math.sin(time * 5) * 0.10);
    S.sparkle(hx + 0.11 * h, hy - 0.005 * h, h * 0.02, '#ffd0d0', 0.5);
    spike(hx - 0.03 * h, hy - 0.06 * h, 0.10 * h, -PI / 2 - 0.35, 0.022 * h, P.plate, { seed: 49, gloss: 0.5 });
    spike(hx + 0.02 * h, hy - 0.06 * h, 0.075 * h, -PI / 2 + 0.15, 0.018 * h, P.plate, { seed: 50, gloss: 0.5 });
    /* aperture above the visor opens for the laser */
    if (f.state.name === 'attack' && f.state.atk && f.state.atk.id === 'laser')
      S.glow(hx + 0.04 * h, hy - 0.045 * h, h * 0.10, P.accent, 0.6);
    ctx.restore();
    chargeGlow(f, h, hx + 0.06 * h, hy, P.accent);
  }

  /* ---------------- 6. ヘドラ ----------------
     Pollution kaiju: a shifting sludge mass with kelp-like grey
     surfaces, gold-and-black irises on red sclera, stubby crab
     arms that split at the tip. */
  function hedorah(f, time) {
    const h = f.h, P = f.pal, p = pose(f, time);
    const bodyY = -0.52 * h + p.bob;
    R.shadow(0, 2, h * 0.55);
    S.contact([[-0.34 * h, 0], [0.30 * h, 0]], { w: h * 0.15 });

    /* amorphous, constantly shifting sludge mass */
    const pts = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * PI * 2;
      const wob = 1 + Math.sin(time * 3.1 + i * 1.7) * 0.10 + Math.sin(time * 1.3 + i) * 0.06;
      const rx = 0.26 * h * (1 + 0.16 * Math.cos(a)) * wob;
      const ry = 0.30 * h * (1 + 0.10 * Math.abs(Math.sin(a))) * wob;
      pts.push([Math.cos(a) * rx, bodyY + Math.sin(a) * ry]);
    }
    S.body(pts, P.skin, { rounded: true, tex: 'sludge', texSize: 18, seed: 3, ao: 0.35, gloss: 0.30 });
    /* kelp-like ridges hanging over the surface */
    for (let i = 0; i < 6; i++) {
      const a = PI * (1.10 - (i / 5) * 0.95);
      const x = Math.cos(a) * 0.22 * h, y = bodyY + Math.sin(a) * 0.24 * h;
      chain(x, y, h * 0.07, [a - PI / 2 + Math.sin(time * 1.6 + i) * 0.15,
                              a - PI / 2 + Math.sin(time * 1.9 + i) * 0.2],
        0.05 * h, 0.012 * h, R.shade(P.skin2, -0.05), { tex: 'kelp', texSize: 11, seed: 6 + i });
    }
    /* slick highlights and dripping blobs */
    for (let i = 0; i < 7; i++) {
      const a = time * 0.8 + i * 0.9;
      S.sparkle(Math.sin(a) * 0.20 * h, bodyY - 0.10 * h + Math.cos(a * 1.3) * 0.16 * h,
        h * (0.02 + 0.01 * Math.sin(a * 2)), '#eaf6ff', 0.35);
      const dy = ((time * 60 + i * 40) % 190) / 190;
      S.flat([[-0.24 * h + i * 0.08 * h, bodyY + 0.10 * h + dy * 0.30 * h],
              [-0.24 * h + i * 0.08 * h + h * 0.02 * (1 - dy), bodyY + 0.10 * h + dy * 0.30 * h + h * 0.03],
              [-0.24 * h + i * 0.08 * h - h * 0.02 * (1 - dy), bodyY + 0.10 * h + dy * 0.30 * h + h * 0.03]],
        R.rgba(P.accent, 0.5 * (1 - dy)), true);
    }
    /* stubby crab arms that split at the tip */
    const armS = p.act ? 1.0 : p.wind ? -0.4 : 0;
    for (let s = 0; s < 2; s++) {
      const bx = 0.16 * h, by = bodyY - 0.02 * h + s * 0.10 * h;
      limb(bx, by, [bx + 0.14 * h, by - 0.06 * h + armS * 0.04 * h],
        bx + (0.26 + armS * 0.12) * h, by - 0.02 * h, 0.055 * h, 0.04 * h,
        s ? P.skin2 : S.far(P.skin2, 0.28), { tex: 'sludge', texSize: 11, seed: 20 + s });
      const tx = bx + (0.26 + armS * 0.12) * h, ty = by - 0.02 * h;
      for (let k = 0; k < 2; k++)
        spike(tx, ty, 0.10 * h, -0.35 + k * 0.7, 0.026 * h, P.skin2, { seed: 22 + k });
    }
    /* jagged mouth and two eyes on irregular mounds */
    const jaw = jawOpen(f, 0.25 + Math.sin(time * 2.2) * 0.10);
    S.body([[0.10 * h, bodyY - 0.14 * h], [0.30 * h, bodyY - 0.10 * h],
            [0.28 * h, bodyY - 0.05 * h], [0.11 * h, bodyY - 0.09 * h]],
      '#2a2420', { rounded: true, flat: true, seed: 26 });
    for (let i = 0; i < 5; i++)
      spike(0.12 * h + i * 0.04 * h, bodyY - 0.13 * h + i * 0.008 * h, 0.04 * h,
        1.3, 0.012 * h, '#e8e0cc', { seed: 27 + i });
    /* the eyes blink sideways; gold iris, black pupil ring, red sclera */
    for (let i = 0; i < 2; i++) {
      const ex = (i ? 0.19 : 0.06) * h, ey = bodyY - (i ? 0.25 : 0.22) * h;
      const r = i ? 0.026 * h : 0.032 * h;
      const blink = Math.abs(Math.sin(time * 0.7 + i * 1.1)) < 0.12 ? 0.25 : 1;
      S.body([[ex + r, ey], [ex, ey + r * blink], [ex - r, ey], [ex, ey - r * blink]],
        P.sclera, { rounded: true, flat: true, seed: 30 + i, gloss: 0.5 });
      R.circle(ex, ey, r * 0.62, P.eye);
      R.circle(ex - r * 0.12, ey, r * 0.26, '#1a1410');
      R.circle(ex - r * 0.26, ey - r * 0.24, r * 0.18, 'rgba(255,255,255,.85)');
    }
    /* the body never quite holds still */
    S.wash(0, bodyY, 0.42 * h, P.accent, 0.14 + Math.sin(time * 2.6) * 0.05);
    chargeGlow(f, h, 0.16 * h, bodyY - 0.22 * h, '#e04a4a');
  }

  function hedorahSaucer(f, time) {
    const h = f.h, P = f.pal;
    const y = -0.62 * h + Math.sin(time * 2.4) * h * 0.03;
    R.shadow(0, 2, h * 0.45);
    /* translucent green saucer with a red core */
    S.body([[-0.52 * h, y], [0, y + 0.16 * h], [0.52 * h, y], [0, y - 0.16 * h]],
      P.skin, { rounded: true, tex: 'sludge', texSize: 16, seed: 3, trans: 0.55, gloss: 0.35 });
    S.body([[-0.34 * h, y - 0.05 * h], [0, y + 0.09 * h], [0.34 * h, y - 0.05 * h], [0, y - 0.19 * h]],
      P.belly, { rounded: true, tex: 'kelp', texSize: 12, seed: 4, trans: 0.3 });
    S.body([[-0.52 * h, y + 0.04 * h], [0, y + 0.11 * h], [0.52 * h, y + 0.04 * h], [0, y - 0.03 * h]],
      P.skin2, { rounded: true, tex: 'sludge', texSize: 13, seed: 5 });
    for (let i = 0; i < 8; i++) {
      const a = time * 2.4 + i * PI / 4;
      S.flat([[Math.cos(a) * h * 0.42 + h * 0.028, y + Math.sin(a) * h * 0.09],
              [Math.cos(a) * h * 0.42, y + Math.sin(a) * h * 0.09 + h * 0.028],
              [Math.cos(a) * h * 0.42 - h * 0.028, y + Math.sin(a) * h * 0.09],
              [Math.cos(a) * h * 0.42, y + Math.sin(a) * h * 0.09 - h * 0.028]],
        R.rgba(P.accent, 0.5 + 0.4 * Math.sin(a)), true);
    }
    S.glow(0, y, h * 0.30, P.accent, 0.45 + Math.sin(time * 8) * 0.10);
    R.eye(0, y - h * 0.02, h * 0.055, P.sclera, P.eye, '#ff4a3a');
    /* slime trail */
    for (let i = 0; i < 5; i++)
      S.flat([[-h * 0.30 - i * h * 0.09 + h * 0.03 * (1 - i / 6), y + h * 0.10 + Math.sin(time * 3 + i) * h * 0.03],
              [-h * 0.30 - i * h * 0.09, y + h * 0.10 + Math.sin(time * 3 + i) * h * 0.03 + h * 0.03 * (1 - i / 6)],
              [-h * 0.30 - i * h * 0.09 - h * 0.03 * (1 - i / 6), y + h * 0.10 + Math.sin(time * 3 + i) * h * 0.03]],
        R.rgba(P.accent, 0.35 - i * 0.05), true);
  }

  /* ---------------- 7. キングギドラ ----------------
     Golden three-headed dragon, armless and bipedal. Each head
     carries two horns, a crescent and a mane; two long tails end
     in feather-like projections; he stands with a forward hunch. */
  function ghidorah(f, time) {
    const h = f.h, P = f.pal, p = pose(f, time);
    const hipY = -0.42 * h + p.bob, shY = -0.66 * h + p.bob;
    R.shadow(0, 2, h * 0.45);
    S.contact([[-0.28 * h, 0], [0.26 * h, 0]], { w: h * 0.13 });

    /* two long necks whipping behind */
    for (let n = 0; n < 2; n++) {
      const segs = [];
      for (let i = 0; i < 6; i++)
        segs.push(PI - 0.35 + Math.sin(time * 1.9 - i * 0.5 + n * 1.4) * 0.10 - n * 0.12 + i * 0.06);
      chain(-0.06 * h, shY + 0.04 * h, h * 0.075, segs, 0.10 * h, 0.02 * h,
        n ? S.far(R.shade(P.skin, -0.08), 0.30) : P.skin, { taper: 0.95, tex: 'scales', texSize: 11, seed: 3 + n });
      const ex = -0.06 * h - 0.44 * h, ey = shY + 0.10 * h;
      S.body([[ex - 0.06 * h, ey - 0.04 * h], [ex - 0.16 * h, ey - 0.02 * h],
              [ex - 0.18 * h, ey + 0.02 * h], [ex - 0.05 * h, ey + 0.04 * h]],
        n ? S.far(R.shade(P.skin, -0.08), 0.30) : P.skin,
        { rounded: true, tex: 'scales', texSize: 10, seed: 5 + n });
      /* mane on the back of each head */
      for (let k = 0; k < 4; k++)
        spike(ex - 0.06 * h - k * 0.02 * h, ey - 0.03 * h + k * 0.02 * h, 0.09 * h,
          PI - 0.4 + k * 0.3, 0.016 * h, P.skin2, { seed: 7 + n * 4 + k });
    }
    /* wings: held high, membrane kept dark and hazed so the gold
       bodies and the three heads read against them */
    const flap = Math.sin(time * 3.4) * 0.22;
    wing(-0.03 * h, shY - 0.02 * h, h * 0.66, h * 0.36, PI - 0.95 - flap,
      S.far(R.shade(P.wing, -0.30), 0.50), { trans: 0.40, veins: 5, seed: 12, fold: true });
    wing(0.03 * h, shY - 0.02 * h, h * 0.66, h * 0.36, 0.95 + flap,
      S.far(R.shade(P.wing, -0.16), 0.25), { trans: 0.45, veins: 5, seed: 13, fold: true });

    /* two legs, bird-like, and the two long tails */
    const st = p.g.amt;
    [[-0.05, p.g.p, true], [0.07, p.g.p2, false]].forEach(([ox, ph2, far], i) => {
      const fx = ox * h + ph2 * 0.08 * h * st;
      const base = far ? S.far(R.shade(P.skin, -0.12), 0.32) : R.shade(P.skin, -0.12);
      limb(ox * h, hipY, [ox * h + ph2 * 0.05 * h * st, -0.20 * h], fx, far ? -0.006 * h : 0,
        0.075 * h, 0.045 * h, base, { tex: 'scales', texSize: 11, seed: 16 + i });
      for (let k = 0; k < 3; k++)
        spike(fx, far ? -0.016 * h : -0.012 * h, 0.07 * h, -0.35 + k * 0.35, 0.018 * h, P.skin2, { seed: 18 + k });
      if (!far) plant(fx, 0.08 * h, base);
    });
    for (let n = 0; n < 2; n++) {
      const ta = [];
      for (let i = 0; i < 7; i++)
        ta.push(PI - 0.10 + Math.sin(time * 2.0 - i * 0.45 + n * 1.1) * 0.07 + n * 0.07);
      const [tx, ty] = chain(-0.08 * h, hipY + 0.02 * h - n * 0.03 * h, h * 0.095, ta,
        0.11 * h, 0.018 * h, n ? S.far(R.shade(P.skin, -0.06), 0.30) : R.shade(P.skin, -0.06),
        { taper: 0.95, tex: 'scales', texSize: 12, seed: 24 + n });
      /* feather-like projections at the tail tip */
      for (let k = 0; k < 4; k++)
        spike(tx, ty, 0.11 * h, PI - 0.75 + k * 0.5, 0.02 * h, P.skin2, { seed: 26 + n * 4 + k });
    }

    ctx.save(); ctx.translate(0, p.bob * 0.5); ctx.rotate(p.lean * 0.25);
    S.body([[-0.16 * h, hipY], [0.16 * h, hipY], [0.20 * h, -0.58 * h], [0.12 * h, shY],
            [-0.14 * h, shY], [-0.20 * h, -0.58 * h]],
      P.skin, { rounded: true, tex: 'scales', texSize: 15, seed: 32, ao: 0.32, gloss: 0.20 });
    S.body([[0.02 * h, hipY], [0.14 * h, -0.56 * h], [0.08 * h, shY], [-0.02 * h, shY]],
      P.belly, { rounded: true, tex: 'plates', texSize: 11, seed: 33, gloss: 0.24 });
    /* three necks, the middle one raised highest */
    const necks = [[0.02, -0.62, 1.0], [0.10, -0.50, 0.85], [-0.06, -0.48, 0.85]];
    const storm = f.state.name === 'attack' && f.state.atk && f.state.atk.id === 'beams';
    necks.forEach(([nx, ny, sc], i) => {
      const sway = Math.sin(time * 1.7 + i * 1.3) * 0.05 + (storm ? 0.12 : 0);
      const [hx, hy] = chain(nx * h, shY + 0.02 * h, h * 0.11,
        [-1.15 + sway + i * 0.14, -0.72 + sway], 0.15 * h * sc, 0.10 * h * sc, P.skin,
        { tex: 'scales', texSize: 11, seed: 36 + i });
      /* mane of hair at the base of each neck */
      for (let k = 0; k < 5; k++)
        spike(hx - 0.05 * h - k * 0.012 * h, hy + 0.02 * h + k * 0.016 * h, 0.10 * h * sc,
          PI - 0.55 + k * 0.28, 0.018 * h, P.skin2, { seed: 40 + i * 5 + k });
      const jaw = storm ? 0.85 : 0.2 + Math.sin(time * 1.4 + i) * 0.08;
      ctx.save();
      ctx.translate(hx, hy); ctx.scale(1.28, 1.28); ctx.translate(-hx, -hy);
      S.body([[hx - 0.07 * h, hy - 0.05 * h], [hx + 0.12 * h, hy - 0.04 * h],
              [hx + 0.17 * h, hy + 0.01 * h], [hx - 0.06 * h, hy + 0.03 * h]],
        P.skin, { rounded: true, tex: 'scales', texSize: 10, seed: 46 + i, gloss: 0.22 });
      ctx.save(); ctx.translate(hx - 0.04 * h, hy + 0.015 * h); ctx.rotate(jaw * 0.28);
      S.body([[0, 0], [0.18 * h, 0.004 * h], [0.17 * h, 0.026 * h], [0, 0.034 * h]],
        R.shade(P.skin, -0.12), { rounded: true, tex: 'scales', texSize: 9, seed: 49 + i });
      ctx.restore();
      R.mouth(hx + 0.07 * h, hy + 0.01 * h, 0.14 * h, 0.045 * h, jaw, '#f0e6cc', 4);
      /* two horns sweeping back, then the crescent over the brow */
      for (let k = 0; k < 2; k++)
        spike(hx - 0.03 * h - k * 0.03 * h, hy - 0.05 * h, 0.10 * h,
          -PI / 2 - 0.6 - k * 0.3, 0.02 * h, P.skin2, { seed: 52 + i * 2 + k });
      S.body([[hx - 0.02 * h, hy - 0.055 * h], [hx + 0.06 * h, hy - 0.062 * h],
              [hx + 0.06 * h, hy - 0.048 * h], [hx - 0.02 * h, hy - 0.042 * h]],
        R.shade(P.skin2, 0.12), { flat: true, seed: 56 + i });
      R.eye(hx + 0.02 * h, hy - 0.02 * h, 0.024 * h, P.eye, '#3a2a1a',
        storm ? '#ffe060' : null);
      if (storm) S.glow(hx + 0.10 * h, hy, h * 0.16, P.accent, 0.5);
      ctx.restore();
    });
    ctx.restore();
    chargeGlow(f, h, 0.14 * h, shY - 0.10 * h, P.accent);
  }

  /* ---------------- 8. ビオランテ ----------------
     First form: a giant rose. Tiny jaws sit inside the red flower,
     prehensile vines whip out, leaves hang from the neck and a
     glowing nucleus sac pulses at the base. */
  function biollante(f, time) {
    const h = f.h, P = f.pal, p = pose(f, time);
    const baseY = -0.02 * h;
    R.shadow(0, 2, h * 0.55);
    S.contact([[-0.40 * h, 0], [0.40 * h, 0]], { w: h * 0.14 });

    /* rose petals around the mouth, shaded like leaves */
    for (let i = 0; i < 9; i++) {
      const a = -PI * 0.95 + (i / 8) * PI * 1.05;
      const sw = Math.sin(time * 1.5 + i * 0.7) * 0.05;
      const px = Math.cos(a + sw) * h * 0.30, py = -0.62 * h + Math.sin(a + sw) * h * 0.28;
      ctx.save();
      ctx.translate(px, py); ctx.rotate(a + PI / 2 + sw);
      S.body([[0, 0], [h * 0.13 * 0.5, -h * 0.30 * 0.35], [0, -h * 0.30],
              [-h * 0.13 * 0.5, -h * 0.30 * 0.35]],
        i % 2 ? P.petal : R.shade(P.petal, -0.10),
        { rounded: true, tex: 'leaf', texSize: 13, seed: 4 + i, trans: 0.30, gloss: 0.12 });
      ctx.restore();
    }
    /* the mouth / core, exposed when the vines have just attacked */
    const open = f.state.name === 'attack' && f.state.atk && f.state.atk.id === 'tendrils';
    S.body([[h * 0.20, -0.62 * h], [0, -0.62 * h + h * 0.20], [-h * 0.20, -0.62 * h],
            [0, -0.62 * h - h * 0.20]],
      P.skin2, { rounded: true, tex: 'leaf', texSize: 12, seed: 14 });
    S.body([[h * 0.13, -0.62 * h], [0, -0.62 * h + h * 0.13], [-h * 0.13, -0.62 * h],
            [0, -0.62 * h - h * 0.13]],
      open ? P.core : R.shade(P.skin, -0.15), { rounded: true, flat: true, seed: 15, gloss: 0.4 });
    if (open) S.glow(0, -0.62 * h, h * 0.26, P.core, 0.55 + Math.sin(time * 10) * 0.10);
    /* tiny jaws inside the flower */
    const jaw = open ? 0.8 : 0.2;
    ctx.save(); ctx.translate(0, -0.62 * h); ctx.rotate(jaw * 0.2);
    S.body([[-h * 0.07, 0], [h * 0.07, -h * 0.01], [h * 0.06, h * 0.02], [-h * 0.06, h * 0.03]],
      R.shade(P.skin, -0.20), { rounded: true, flat: true, seed: 16 });
    ctx.restore();
    /* white fang-like teeth ring */
    for (let i = 0; i < 7; i++) {
      const a = -PI * 0.85 + i * 0.42;
      spike(Math.cos(a) * h * 0.16, -0.62 * h + Math.sin(a) * h * 0.16,
        0.06 * h, a + PI / 2, 0.02 * h, '#f0eadc', { seed: 17 + i });
    }
    /* thorny vines, some with mouths at the tip */
    for (let v = 0; v < 6; v++) {
      const side = v % 2 ? 1 : -1;
      const segs = [];
      for (let i = 0; i < 6; i++)
        segs.push(side * (0.5 + 0.35 * Math.sin(time * 1.6 + v * 1.1 + i * 0.4)) - side * 0.1);
      const [tx, ty] = chain(side * 0.10 * h, -0.35 * h, h * 0.035, segs, 0.09 * h, 0.012 * h, P.vine,
        { tex: 'kelp', texSize: 11, seed: 30 + v });
      for (let i = 0; i < 3; i++)
        spike(side * 0.10 * h + i * side * 0.06 * h, -0.35 * h - i * 0.05 * h,
          0.05 * h, side * (0.8 + i * 0.2), 0.012 * h, P.leaf, { seed: 36 + v * 3 + i });
      if (v < 3) {
        S.body([[tx + h * 0.045, ty], [tx, ty + h * 0.045], [tx - h * 0.045, ty], [tx, ty - h * 0.045]],
          P.skin, { rounded: true, tex: 'leaf', texSize: 9, seed: 48 + v, gloss: 0.2 });
        R.mouth(tx, ty, h * 0.09, h * 0.035, 0.4 + 0.4 * Math.sin(time * 3 + v), '#f0e6cc', 3);
      }
    }
    /* bulbous stem base in the lake, leaves hanging from the neck */
    S.body([[-0.30 * h, baseY], [-0.26 * h, -0.34 * h], [0.26 * h, -0.34 * h], [0.30 * h, baseY]],
      P.leaf, { rounded: true, tex: 'leaf', texSize: 17, seed: 54, ao: 0.30 });
    for (let i = 0; i < 5; i++)
      spike(-0.20 * h + i * 0.10 * h, -0.30 * h, 0.09 * h, -PI / 2 + (i - 2) * 0.25,
        0.022 * h, P.vine, { seed: 55 + i });
    for (let i = 0; i < 4; i++) {
      const lx = -0.18 * h + i * 0.12 * h, ly = -0.36 * h;
      ctx.save();
      ctx.translate(lx, ly); ctx.rotate(PI / 2 + (i - 1.5) * 0.35 + Math.sin(time * 1.2 + i) * 0.08);
      S.body([[0, 0], [h * 0.09, -h * 0.20 * 0.35], [0, -h * 0.20], [-h * 0.09, -h * 0.20 * 0.35]],
        i % 2 ? P.leaf : R.shade(P.leaf, -0.08),
        { rounded: true, tex: 'leaf', texSize: 12, seed: 60 + i, trans: 0.25 });
      ctx.restore();
    }
    /* the nucleus sac, the one soft organ he will defend */
    S.body([[h * 0.10, -0.20 * h], [0, -0.10 * h], [-h * 0.10, -0.20 * h], [0, -0.30 * h]],
      P.core, { rounded: true, tex: 'muscle', texSize: 9, seed: 66, gloss: 0.45 });
    S.glow(0, -0.20 * h, h * 0.16, P.core, 0.30 + Math.sin(time * 2.6) * 0.08);
    /* water line */
    S.flat([[-0.62 * h, baseY], [0.62 * h, baseY], [0.62 * h, baseY + 0.06 * h], [-0.62 * h, baseY + 0.06 * h]],
      'rgba(90,150,170,.35)');
    chargeGlow(f, h, 0, -0.62 * h, P.core);
  }

  /* Second form: a mosasaur body carrying the rose. Tongueless maw
     lined with knife-like teeth, six large tusks, brain-like flesh
     over the chest, vines ending in spears and small toothed mouths. */
  function biollanteBeast(f, time) {
    const h = f.h, P = f.pal, p = pose(f, time);
    const hipY = -0.34 * h + p.bob, shY = -0.62 * h + p.bob;
    R.shadow(0, 2, h * 0.5);
    S.contact([[-0.26 * h, 0], [0.26 * h, 0]], { w: h * 0.12 });
    const ta = [];
    for (let i = 0; i < 6; i++) ta.push(PI - 0.1 + Math.sin(time * 2.4 - i * 0.5) * 0.09);
    chain(-0.06 * h, hipY, h * 0.09, ta, 0.14 * h, 0.02 * h, P.skin2,
      { taper: 0.93, tex: 'muscle', texSize: 13, seed: 3 });

    const st = p.g.amt;
    [[-0.04, p.g.p, true], [0.08, p.g.p2, false]].forEach(([ox, ph2, far], i) => {
      const fx = ox * h + ph2 * 0.09 * h * st;
      const base = far ? S.far(R.shade(P.skin2, -0.08), 0.32) : R.shade(P.skin2, -0.08);
      limb(ox * h, hipY, [ox * h + ph2 * 0.05 * h * st, -0.17 * h], fx, far ? -0.005 * h : 0,
        0.075 * h, 0.05 * h, base, { tex: 'muscle', texSize: 12, seed: 6 + i });
      if (!far) plant(fx, 0.08 * h, base);
    });
    ctx.save(); ctx.translate(0, p.bob * 0.6); ctx.rotate(p.lean * 0.3);
    /* muscular rose-red body with a green husk on the back */
    S.body([[-0.18 * h, hipY], [0.16 * h, hipY], [0.20 * h, -0.50 * h], [0.10 * h, shY],
            [-0.16 * h, shY], [-0.22 * h, -0.50 * h]],
      P.skin, { rounded: true, tex: 'muscle', texSize: 15, seed: 12, ao: 0.32, gloss: 0.14 });
    S.body([[-0.20 * h, shY + 0.02 * h], [-0.02 * h, shY - 0.02 * h], [0.14 * h, -0.46 * h],
            [-0.18 * h, -0.46 * h]],
      P.leaf, { rounded: true, tex: 'leaf', texSize: 13, seed: 13, trans: 0.20 });
    /* brain-like flesh over the chest */
    S.body([[0.14 * h, -0.40 * h], [0.16 * h, -0.50 * h], [0.06 * h, -0.56 * h], [0.02 * h, -0.44 * h]],
      R.mix(P.skin, '#e07a3a', 0.5), { rounded: true, tex: 'brain', texSize: 10, seed: 14, gloss: 0.30 });
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = R.rgba('#7a2836', 0.5);
      ctx.lineWidth = h * 0.006;
      ctx.beginPath();
      ctx.moveTo(0.04 * h + i * 0.03 * h, -0.42 * h - i * 0.03 * h);
      ctx.quadraticCurveTo(0.10 * h + i * 0.02 * h, -0.48 * h, 0.06 * h + i * 0.03 * h, -0.54 * h);
      ctx.stroke();
    }
    /* vine arms */
    for (let v = 0; v < 2; v++) {
      const segs = [];
      for (let i = 0; i < 4; i++)
        segs.push((p.act ? 0.1 : 0.6) + Math.sin(time * 2.2 + v + i * 0.5) * 0.25 + v * 0.3);
      const [tx, ty] = chain(0.12 * h, shY + v * 0.06 * h, h * 0.04, segs, 0.10 * h, 0.015 * h, P.vine,
        { tex: 'kelp', texSize: 10, seed: 18 + v });
      spike(tx, ty, 0.09 * h, segs[3] - 0.4, 0.02 * h, P.leaf, { seed: 22 + v });
      S.body([[tx + h * 0.05, ty], [tx, ty + h * 0.05], [tx - h * 0.05, ty], [tx, ty - h * 0.05]],
        P.skin, { rounded: true, tex: 'leaf', texSize: 9, seed: 24 + v, gloss: 0.2 });
      R.mouth(tx, ty, h * 0.10, h * 0.04, 0.5, '#f0e6cc', 3);
    }
    /* mosasaur head: long snout, tongueless maw, six large tusks */
    chain(0.06 * h, shY, h * 0.09, [-0.4, -0.2], 0.12 * h, 0.09 * h, P.skin,
      { tex: 'muscle', texSize: 11, seed: 28 });
    const hx = 0.16 * h, hy = shY - 0.08 * h;
    S.body([[hx - 0.08 * h, hy - 0.05 * h], [hx + 0.12 * h, hy - 0.04 * h],
            [hx + 0.18 * h, hy + 0.01 * h], [hx - 0.07 * h, hy + 0.04 * h]],
      P.skin, { rounded: true, tex: 'muscle', texSize: 11, seed: 29, gloss: 0.16 });
    const jaw = jawOpen(f, 0.2);
    ctx.save(); ctx.translate(hx - 0.04 * h, hy + 0.02 * h); ctx.rotate(jaw * 0.3);
    S.body([[0, 0], [0.20 * h, 0], [0.19 * h, 0.03 * h], [0, 0.036 * h]],
      R.shade(P.skin2, -0.1), { rounded: true, tex: 'muscle', texSize: 10, seed: 30 });
    ctx.restore();
    R.mouth(hx + 0.08 * h, hy + 0.01 * h, 0.17 * h, 0.05 * h, jaw, '#f0e6cc', 6);
    for (let i = 0; i < 6; i++)
      spike(hx + 0.01 * h + i * 0.032 * h, hy + 0.012 * h, 0.075 * h,
        -PI / 2 - 0.15 + i * 0.12, 0.016 * h, '#f2ecdc', { seed: 32 + i });
    /* petals still crown the head */
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(hx - 0.06 * h + i * 0.05 * h, hy - 0.07 * h);
      ctx.rotate(-PI / 2 + (i - 1.5) * 0.3);
      S.body([[0, 0], [0.05 * h, -0.12 * h * 0.35], [0, -0.12 * h], [-0.05 * h, -0.12 * h * 0.35]],
        P.petal, { rounded: true, tex: 'leaf', texSize: 9, seed: 40 + i, trans: 0.3 });
      ctx.restore();
    }
    R.eye(hx - 0.01 * h, hy - 0.025 * h, 0.024 * h, P.eye, '#3a2a1a');
    ctx.restore();
    chargeGlow(f, h, hx + 0.08 * h, hy, P.core);
  }

  /* ---------------- 9. スペースゴジラ ----------------
     Bulkier than Godzilla with navy skin, a dark reddish-purple
     abdominal patch, two massive shoulder crystals, white crystal
     dorsals, a much longer tail ending in crystal spikes, very
     short arms and an elongated head with side tusks. */
  function spacegodzilla(f, time, fly) {
    const h = f.h, P = f.pal, p = pose(f, time);
    const hipY = -0.40 * h + p.bob, shY = -0.74 * h + p.bob;
    const L = p.lean;
    R.shadow(0, 2, h * 0.40);
    S.contact([[-0.42 * h, 0], [0.34 * h, 0]], { w: h * 0.16 });

    /* tail with crystal edges */
    const ta = [];
    for (let i = 0; i < 8; i++)
      ta.push(PI - 0.30 - i * 0.03 + Math.sin(time * 2.0 - i * 0.5) * 0.05 + L * 0.4);
    const TJ = chainJoints(-0.05 * h, hipY, h * 0.105, ta, 0.95);
    chain(-0.05 * h, hipY, h * 0.105, ta, 0.21 * h, 0.05 * h, P.skin2,
      { taper: 0.95, tex: 'scales', texSize: 14, seed: 3 });

    /* octagonal crystals: two on the back, three riding the tail */
    [[-0.13 * h, shY + 0.05 * h, 0.20 * h, -0.22],
     [-0.20 * h, shY + 0.21 * h, 0.17 * h, -0.30]].forEach(([bx, by, hh, rot], k) =>
      S.crystal(bx, by, hh, h * 0.095, { seed: 10 + k, rot, glowColor: fly ? P.accent : null }));
    [1, 3, 5].forEach((j, k) => {
      const a = (ta[j - 1] + ta[Math.min(j, ta.length - 1)]) / 2;
      const w = chainW(0.21 * h, 0.05 * h, j / 8);
      S.crystal(TJ[j][0] + Math.cos(a + PI / 2) * w * 0.8,
        TJ[j][1] + Math.sin(a + PI / 2) * w * 0.8,
        h * (0.155 - k * 0.030), h * (0.080 - k * 0.018),
        { seed: 13 + k, rot: a + PI, glowColor: fly ? P.accent : null });
    });

    const st = fly ? 0 : p.g.amt;
    [[-0.03, p.g.p, true], [0.09, p.g.p2, false]].forEach(([ox, ph2, far], i) => {
      const fx = ox * h + ph2 * 0.09 * h * st;
      const base = far ? S.far(R.shade(P.skin, -0.10), 0.34) : R.shade(P.skin, -0.10);
      if (!fly) S.body([[ox * h - 0.10 * h, hipY - p.bob - 0.05 * h], [ox * h + 0.11 * h, hipY - p.bob - 0.03 * h],
                        [ox * h + 0.09 * h, hipY - p.bob + 0.12 * h], [ox * h - 0.09 * h, hipY - p.bob + 0.12 * h]],
        base, { rounded: true, tex: 'scales', texSize: 14, seed: seed(15) });
      limb(ox * h, hipY, [ox * h + ph2 * 0.05 * h * st, -0.20 * h], fx, fly ? -0.14 * h : (far ? -0.006 * h : 0),
        0.105 * h, 0.058 * h, base, { tex: 'scales', texSize: 13, seed: 16 + i });
      if (!far && !fly) plant(fx, 0.09 * h, base);
    });

    ctx.save(); ctx.translate(0, p.bob); ctx.rotate(L * 0.3);
    S.body([[-0.17 * h, hipY - p.bob], [0.15 * h, hipY - p.bob], [0.20 * h, -0.60 * h],
            [0.12 * h, shY], [-0.14 * h, shY], [-0.21 * h, -0.60 * h]],
      P.skin, { rounded: true, tex: 'scales', texSize: 16, seed: 22, ao: 0.34, gloss: 0.16 });
    /* smoother dark reddish-purple abdominal patch */
    S.body([[0.02 * h, hipY - p.bob], [0.13 * h, -0.58 * h], [0.08 * h, shY + 0.02 * h], [-0.01 * h, shY + 0.02 * h]],
      R.shade(P.belly, -0.10), { rounded: true, tex: 'plates', texSize: 12, seed: 23, gloss: 0.24 });
    /* four shoulder crystals, the signature silhouette */
    for (let i = 0; i < 4; i++) {
      const sx = -0.14 * h + i * 0.10 * h, sy = shY - 0.01 * h;
      S.crystal(sx, sy, h * (0.20 + 0.05 * Math.sin(time * 2 + i)), h * 0.075,
        { seed: 24 + i, glowColor: P.accent });
      if (f.state.name === 'attack' && f.state.atk && f.state.atk.id === 'corona')
        S.glow(sx, sy - h * 0.16, h * 0.14, P.accent, 0.5);
    }
    /* extremely thin, short arms */
    const armS = p.wind ? -0.5 : p.act ? 0.9 : 0.1;
    limb(0.10 * h, shY + 0.03 * h, [0.18 * h, -0.63 * h],
      0.20 * h + armS * 0.07 * h, -0.60 * h, 0.05 * h, 0.032 * h,
      R.shade(P.skin, -0.06), { tex: 'scales', texSize: 9, seed: 30 });
    /* neck */
    const [hx, hy] = chain(0.03 * h, shY, h * 0.055, [-1.15 + L, -0.75 + L * 0.6],
      0.22 * h, 0.19 * h, P.skin, { tex: 'scales', texSize: 12, seed: 31 });
    const headX = hx + 0.07 * h, headY = hy - 0.035 * h;
    const jaw = jawOpen(f, 0.12 + Math.sin(time * 1.2) * 0.05);
    S.body([[headX - 0.13 * h, headY - 0.080 * h], [headX + 0.16 * h, headY - 0.055 * h],
            [headX + 0.21 * h, headY + 0.015 * h], [headX - 0.09 * h, headY + 0.060 * h]],
      P.skin, { rounded: true, tex: 'scales', texSize: 11, seed: 32, gloss: 0.18 });
    ctx.save();
    ctx.translate(headX - 0.05 * h, headY + 0.02 * h); ctx.rotate(jaw * 0.3);
    S.body([[0, 0], [0.19 * h, 0.005 * h], [0.18 * h, 0.03 * h], [0, 0.04 * h]],
      R.shade(P.skin, -0.12), { rounded: true, tex: 'scales', texSize: 10, seed: 33 });
    /* fleshy mouth membranes hanging from the jaws */
    S.flat([[0.03 * h, 0.004 * h], [0.16 * h, 0.006 * h], [0.14 * h, 0.026 * h], [0.05 * h, 0.022 * h]],
      R.rgba('#8a3a4a', 0.55));
    ctx.restore();
    R.mouth(headX + 0.07 * h, headY + 0.020 * h, 0.19 * h, 0.062 * h, jaw, '#f2ecdc', 5);
    /* side tusks curving down from the cheeks */
    for (let s = 0; s < 2; s++)
      spike(headX - 0.04 * h + s * 0.10 * h, headY + 0.015 * h, 0.07 * h,
        PI / 2 + 0.35 - s * 0.5, 0.018 * h, P.crystal, { seed: 34 + s });
    /* five-pronged light orange crest and small pointed ears */
    for (let i = 0; i < 5; i++)
      spike(headX - 0.06 * h + i * 0.032 * h, headY - 0.045 * h, 0.075 * h,
        -PI / 2 - 0.55 + i * 0.28, 0.014 * h, '#f0a850', { seed: 36 + i });
    spike(headX - 0.075 * h, headY - 0.02 * h, 0.04 * h, PI - 0.6, 0.014 * h,
      R.shade(P.skin, -0.1), { seed: 41 });
    R.eye(headX - 0.02 * h, headY - 0.025 * h, 0.022 * h, P.eye, '#c8d8f0', P.accent);
    S.crystal(headX - 0.01 * h, headY - 0.045 * h, h * 0.11, h * 0.05, { seed: 42, glowColor: P.accent });
    ctx.restore();

    /* the photon-reactive shield: a hexagonal crystal shell */
    if (f.shield) {
      ctx.save();
      ctx.strokeStyle = R.rgba(P.accent, 0.55); ctx.lineWidth = 2;
      ctx.fillStyle = R.rgba(P.accent, 0.10);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = i * PI / 3 + time * 0.6;
        const px = Math.cos(a) * h * 0.52, py = -0.55 * h + Math.sin(a) * h * 0.58;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      S.wash(0, -0.55 * h, h * 0.60, P.accent, 0.22);
      for (let i = 0; i < 3; i++)
        S.sparkle(Math.cos(time * 1.4 + i * 2.1) * h * 0.45,
          -0.55 * h + Math.sin(time * 1.1 + i * 2.1) * h * 0.5, h * 0.03, '#ffffff', 0.5);
    }
    if (fly) {
      /* in flight the back crystals fan out around the tail */
      for (let i = 0; i < 4; i++)
        S.crystal(-0.18 * h - i * 0.10 * h, hipY - 0.06 * h - i * 0.03 * h,
          h * (0.16 - i * 0.02), h * 0.06, { seed: 50 + i, glowColor: P.accent });
      /* cold blue jets under the body while hovering */
      for (let i = 0; i < 4; i++)
        S.glow(-0.18 * h + i * 0.12 * h, -0.06 * h, h * 0.11, '#8fc8ff',
          0.45 + 0.2 * Math.sin(time * 14 + i));
    }
    chargeGlow(f, h, headX + 0.10 * h, headY, P.accent);
  }
  function spacegodzillaFly(f, time) { spacegodzilla(f, time, true); }

  /* ---------------- 10. デストロイア ----------------
     Perfect form: upright and bulky, dark red armour plates, two
     large bat-like wings plus two smaller side wings, a frilled
     head venting steam, a lighter forehead horn, three-clawed
     arms and a pincer tail. */
  function destoroyah(f, time) {
    const h = f.h, P = f.pal, p = pose(f, time);
    const hipY = -0.38 * h + p.bob, shY = -0.68 * h + p.bob;
    R.shadow(0, 2, h * 0.48);
    S.contact([[-0.30 * h, 0], [0.30 * h, 0]], { w: h * 0.14 });

    /* pincer-like segmented tail */
    const ta = [];
    for (let i = 0; i < 5; i++) ta.push(PI - 0.28 + i * 0.09 + Math.sin(time * 2.2 - i * 0.4) * 0.05);
    chain(-0.10 * h, hipY + 0.04 * h, h * 0.12, ta, 0.16 * h, 0.05 * h, P.skin2,
      { taper: 0.94, tex: 'plates', texSize: 13, seed: 3 });
    S.pincer(-0.60 * h, hipY - 0.02 * h, 0.22 * h, PI + 0.2, 0.35 + Math.sin(time * 1.6) * 0.1,
      P.plate, P.skin2);

    /* two large wings, then two smaller side wings behind them */
    const flap = f.airborne ? Math.sin(time * 9) * 0.4 : Math.sin(time * 1.8) * 0.06;
    wing(-0.04 * h, shY, h * 0.66, h * 0.30, PI - 0.45 - flap,
      S.far(R.mix(P.plate, '#ffffff', 0.35), 0.35), { trans: 0.55, veins: 4, seed: 6, fold: true });
    wing(0.02 * h, shY, h * 0.60, h * 0.26, 0.42 + flap,
      R.mix(P.plate, '#ffffff', 0.25), { trans: 0.60, veins: 4, seed: 7, fold: true });
    for (let s = -1; s <= 1; s += 2)
      wing(s * 0.03 * h, shY + 0.06 * h, h * 0.34, h * 0.16,
        s < 0 ? PI - 0.75 - flap * 0.6 : 0.75 + flap * 0.6,
        S.far(R.mix(P.plate, '#ffffff', 0.20), 0.40), { trans: 0.55, veins: 2, seed: 8 + (s < 0 ? 0 : 1) });

    /* two thick legs in a horseshoe-crab stance */
    const st = p.g.amt;
    [[-0.05, p.g.p, true], [0.07, p.g.p2, false]].forEach(([ox, ph2, far], i) => {
      const fx = ox * h + ph2 * 0.10 * h * st;
      const base = far ? S.far(R.shade(P.skin2, -0.06), 0.32) : R.shade(P.skin2, -0.06);
      limb(ox * h, hipY, [ox * h + ph2 * 0.06 * h * st, -0.19 * h], fx, far ? -0.006 * h : 0,
        0.085 * h, 0.055 * h, base, { tex: 'chitin', texSize: 12, seed: 12 + i });
      S.body([[fx - 0.06 * h, -0.02 * h], [fx + 0.13 * h, -0.02 * h],
              [fx + 0.15 * h, far ? -0.005 * h : 0], [fx - 0.07 * h, far ? -0.005 * h : 0]],
        far ? S.far(R.shade(P.plate, -0.20), 0.30) : R.shade(P.plate, -0.20),
        { rounded: true, tex: 'plates', texSize: 10, seed: 14 + i, gloss: 0.24 });
      if (!far) plant(fx, 0.09 * h, base);
    });

    ctx.save(); ctx.translate(0, p.bob * 0.6); ctx.rotate(p.lean * 0.3);
    /* layered carapace */
    S.body([[-0.18 * h, hipY], [0.16 * h, hipY], [0.22 * h, -0.55 * h], [0.12 * h, shY],
            [-0.16 * h, shY], [-0.22 * h, -0.55 * h]],
      P.skin, { rounded: true, tex: 'plates', texSize: 16, seed: 20, ao: 0.34, gloss: 0.22 });
    for (let i = 0; i < 4; i++)
      S.body([[-0.20 * h + i * 0.02 * h, -0.44 * h - i * 0.06 * h],
              [0.20 * h - i * 0.02 * h, -0.44 * h - i * 0.06 * h],
              [0.16 * h - i * 0.02 * h, -0.50 * h - i * 0.06 * h],
              [-0.16 * h + i * 0.02 * h, -0.50 * h - i * 0.06 * h]],
      R.shade(P.plate, 0.02 * i - 0.04), { rounded: true, tex: 'plates', texSize: 11, seed: 21 + i, gloss: 0.26 });
    S.body([[0.02 * h, hipY], [0.15 * h, -0.52 * h], [0.09 * h, shY], [-0.02 * h, shY]],
      P.belly, { rounded: true, tex: 'scales', texSize: 11, seed: 26, gloss: 0.20 });
    /* mounds of shoulder spikes and the circular chest opening */
    for (let i = 0; i < 4; i++)
      spike(-0.10 * h + i * 0.07 * h, shY - 0.02 * h, 0.09 * h, -PI / 2 + (i - 1.5) * 0.35,
        0.024 * h, P.horn, { seed: 27 + i, tip: R.rgba('#fff', 0.3) });
    S.body([[0.13 * h + h * 0.045, -0.56 * h], [0.13 * h, -0.56 * h + h * 0.045],
            [0.13 * h - h * 0.045, -0.56 * h], [0.13 * h, -0.56 * h - h * 0.045]],
      R.shade(P.skin2, -0.30), { rounded: true, flat: true, seed: 31 });
    S.glow(0.13 * h, -0.56 * h, h * 0.07, P.accent, 0.35 + Math.sin(time * 3.4) * 0.10);

    /* arms ending in three-clawed slicers */
    const armS = p.wind ? -0.5 : p.act ? 1.1 : 0.2;
    for (let s = 0; s < 2; s++) {
      const sx = 0.10 * h - s * 0.03 * h, sy = shY + 0.02 * h + s * 0.06 * h;
      limb(sx, sy, [sx + 0.12 * h, sy - 0.04 * h], sx + (0.20 + armS * 0.12) * h, sy,
        0.055 * h, 0.038 * h, s ? R.shade(P.skin2, -0.05) : S.far(R.shade(P.skin2, -0.05), 0.28),
        { tex: 'chitin', texSize: 10, seed: 34 + s });
      const tx = sx + (0.20 + armS * 0.12) * h, ty = sy;
      for (let k = 0; k < 3; k++)
        spike(tx, ty, 0.13 * h, -0.6 + k * 0.6, 0.02 * h, P.horn, { seed: 36 + s * 3 + k, gloss: 0.35 });
    }

    /* head: large frills venting steam, a long lighter horn, orange eyes */
    chain(0.06 * h, shY, h * 0.09, [-0.45, -0.2], 0.12 * h, 0.09 * h, P.skin,
      { tex: 'plates', texSize: 11, seed: 42 });
    const hx = 0.14 * h, hy = shY - 0.09 * h;
    S.body([[hx - 0.08 * h, hy - 0.06 * h], [hx + 0.12 * h, hy - 0.05 * h],
            [hx + 0.17 * h, hy + 0.01 * h], [hx - 0.07 * h, hy + 0.05 * h]],
      P.plate, { rounded: true, tex: 'plates', texSize: 11, seed: 43, gloss: 0.26 });
    const jaw = jawOpen(f, 0.18 + Math.sin(time * 2) * 0.06);
    ctx.save(); ctx.translate(hx - 0.04 * h, hy + 0.02 * h); ctx.rotate(jaw * 0.3);
    S.body([[0, 0], [0.20 * h, 0.004 * h], [0.19 * h, 0.03 * h], [0, 0.038 * h]],
      R.shade(P.skin2, -0.1), { rounded: true, tex: 'chitin', texSize: 10, seed: 44 });
    ctx.restore();
    R.mouth(hx + 0.08 * h, hy + 0.012 * h, 0.17 * h, 0.05 * h, jaw, '#f2ecdc', 6);
    /* the variable slicer horn, lighter than the rest of the armour */
    spike(hx + 0.02 * h, hy - 0.05 * h, 0.26 * h, -0.15, 0.045 * h, P.horn,
      { seed: 45, gloss: 0.4, tip: R.rgba('#ffffff', 0.45) });
    /* head frills */
    for (let k = 0; k < 3; k++) {
      const fx = hx - 0.05 * h - k * 0.03 * h, fy = hy - 0.05 * h;
      spike(fx, fy, 0.11 * h, -PI / 2 - 0.5 - k * 0.28, 0.02 * h, P.horn, { seed: 46 + k });
      /* steam vents off the frills */
      const puff = (time * 1.4 + k * 0.4) % 1;
      S.wash(fx - 0.02 * h - puff * 0.16 * h, fy - 0.10 * h - puff * 0.26 * h,
        h * (0.03 + puff * 0.05), '#e8f0f4', 0.16 * (1 - puff));
    }
    R.eye(hx - 0.01 * h, hy - 0.02 * h, 0.026 * h, P.eye, '#8a3a1a',
      p.act || p.wind ? P.accent : null);
    ctx.restore();
    chargeGlow(f, h, hx + 0.10 * h, hy, P.accent);
  }

  /* デストロイア幼体 — crab-like, segmented legs, a frilled head with
     a single hollow horn, a circular chest opening and a long
     fork-tipped tail. */
  function destoroyahJuv(f, time) {
    const h = f.h, P = f.pal, p = pose(f, time);
    const bodyY = -0.54 * h + p.bob;
    R.shadow(0, 2, h * 0.42);
    S.contact([[-0.24 * h, 0], [0.22 * h, 0]], { w: h * 0.10 });
    const ta = [];
    for (let i = 0; i < 4; i++) ta.push(PI - 0.2 + i * 0.1 + Math.sin(time * 4 - i * 0.5) * 0.08);
    const [ftx, fty] = chain(-0.08 * h, bodyY, h * 0.08, ta, 0.10 * h, 0.03 * h, P.skin2,
      { taper: 0.94, tex: 'plates', texSize: 9, seed: 3 });
    /* the tail forks at the tip */
    for (let k = 0; k < 2; k++)
      spike(ftx, fty, 0.10 * h, PI - 0.5 + k * 1.0, 0.016 * h, P.horn, { seed: 4 + k });
    const st = p.g.amt;
    for (let i = 0; i < 4; i++) {
      const ox = -0.12 * h + i * 0.08 * h;
      const ph2 = Math.sin(time * 11 + i * 1.6) * st;
      const far = i % 2 === 0;
      limb(ox, bodyY + 0.08 * h, [ox - 0.03 * h + ph2 * 0.03 * h, -0.18 * h],
        ox - 0.06 * h + ph2 * 0.07 * h, far ? -0.004 * h : 0, 0.042 * h, 0.024 * h,
        far ? S.far(R.shade(P.skin2, -0.08), 0.30) : R.shade(P.skin2, -0.08),
        { tex: 'chitin', texSize: 7, seed: 8 + i });
      if (!far) plant(ox - 0.06 * h + ph2 * 0.07 * h, 0.028 * h, R.shade(P.skin2, -0.08));
    }
    ctx.save(); ctx.translate(0, p.bob * 0.5); ctx.rotate(p.lean * 0.3);
    S.body([[-0.20 * h, bodyY + 0.08 * h], [-0.15 * h, bodyY - 0.13 * h], [0.10 * h, bodyY - 0.17 * h],
            [0.22 * h, bodyY - 0.04 * h], [0.20 * h, bodyY + 0.09 * h], [-0.02 * h, bodyY + 0.13 * h]],
      P.skin, { rounded: true, tex: 'plates', texSize: 13, seed: 16, ao: 0.30, gloss: 0.22 });
    /* shoulder spike mounds and the round chest opening */
    for (let i = 0; i < 3; i++)
      spike(-0.06 * h + i * 0.06 * h, bodyY - 0.11 * h, 0.07 * h, -PI / 2 + (i - 1) * 0.4,
        0.02 * h, P.horn, { seed: 17 + i });
    S.body([[0.10 * h + h * 0.032, bodyY - 0.02 * h], [0.10 * h, bodyY - 0.02 * h + h * 0.032],
            [0.10 * h - h * 0.032, bodyY - 0.02 * h], [0.10 * h, bodyY - 0.02 * h - h * 0.032]],
      R.shade(P.skin2, -0.32), { rounded: true, flat: true, seed: 20 });
    S.glow(0.10 * h, bodyY - 0.02 * h, h * 0.05, P.accent, 0.30 + Math.sin(time * 4.2) * 0.10);
    /* short arms with pincers */
    const open = p.act ? 0.05 : 0.4;
    S.pincer(0.18 * h, bodyY - 0.01 * h, 0.16 * h, 0.1, open, P.plate, P.skin2);
    /* single hollow horn, shorter than the perfect form's */
    const hx = 0.16 * h, hy = bodyY - 0.07 * h;
    S.body([[hx - 0.06 * h, hy - 0.04 * h], [hx + 0.10 * h, hy - 0.03 * h],
            [hx + 0.14 * h, hy + 0.01 * h], [hx - 0.05 * h, hy + 0.03 * h]],
      P.plate, { rounded: true, tex: 'plates', texSize: 9, seed: 22, gloss: 0.26 });
    /* frill around the head */
    for (let k = 0; k < 3; k++)
      spike(hx - 0.05 * h - k * 0.02 * h, hy - 0.03 * h, 0.08 * h, -PI / 2 - 0.5 - k * 0.3,
        0.016 * h, P.horn, { seed: 23 + k });
    spike(hx + 0.01 * h, hy - 0.03 * h, 0.17 * h, -0.2, 0.03 * h, P.horn,
      { seed: 26, gloss: 0.35, tip: R.rgba('#ffffff', 0.4) });
    /* extendable jaw pushes out when it strikes */
    const jaw = jawOpen(f, 0.2);
    ctx.save(); ctx.translate(hx + 0.02 * h + jaw * 0.05 * h, hy + 0.012 * h);
    S.body([[0, 0], [0.10 * h, 0.002 * h], [0.09 * h, 0.018 * h], [0, 0.022 * h]],
      R.shade(P.skin2, -0.14), { rounded: true, flat: true, seed: 27 });
    ctx.restore();
    R.mouth(hx + 0.06 * h, hy + 0.01 * h, 0.12 * h, 0.04 * h, jaw, '#f2ecdc', 4);
    /* two orange eyes that glow yellow */
    R.eye(hx - 0.01 * h, hy - 0.015 * h, 0.022 * h, P.eye, '#8a3a1a',
      p.act ? P.accent : null);
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
    _sc = 0;
    fn(f, time);
  }

  return { draw, DRAWERS, godzilla, burningGodzilla };
})();
