/* =========================================================
   rig.js — 手描きPROCEDURAL図形の共通部品
   art.js composes these into the ten kaiju silhouettes. No
   sprites, no images: everything is paths, gradients and chains.
   ========================================================= */
'use strict';

const Rig = (() => {
  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const wave = (t, f, a) => Math.sin(t * f) * a;

  /* ---- colour helpers ---- */
  function hex2rgb(h) {
    let s = h.replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }
  function rgb2hex(c) {
    return '#' + c.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  }
  function shade(hex, amt) {
    const c = hex2rgb(hex);
    return rgb2hex(c.map(v => v + amt * 255));
  }
  function mix(a, b, t) {
    const A = hex2rgb(a), B = hex2rgb(b);
    return rgb2hex([0, 1, 2].map(i => lerp(A[i], B[i], t)));
  }
  function rgba(hex, a) {
    const c = hex2rgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  /* ---- transform helpers ---- */
  /* draw in a left-facing local space; flip for right-facing fighters */
  function face(x, facing, fn) {
    ctx.save();
    ctx.translate(x, 0);
    ctx.scale(facing, 1);
    fn();
    ctx.restore();
  }

  /* ---- primitives ---- */
  /* path building is split out so shade.js can clip to a silhouette and
     stroke it for rim light without re-filling it */
  function tracePoly(pts) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  }

  /* smooth closed curve through points (Catmull-Rom -> bezier) */
  function traceSmooth(pts) {
    const n = pts.length;
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      ctx.bezierCurveTo(
        p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
        p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
        p2[0], p2[1]);
    }
  }

  function poly(pts, fill, stroke, lw) {
    ctx.beginPath(); tracePoly(pts); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  }

  function smooth(pts, fill, stroke, lw) {
    ctx.beginPath(); traceSmooth(pts); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  }

  function ellipse(x, y, rx, ry, rot, fill, stroke, lw) {
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.abs(rx), Math.abs(ry), 0, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
    ctx.restore();
  }

  function circle(x, y, r, fill) {
    ctx.beginPath(); ctx.arc(x, y, Math.abs(r), 0, TAU);
    ctx.fillStyle = fill; ctx.fill();
  }

  function capsule(x1, y1, x2, y2, r, fill) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.save();
    ctx.translate(x1, y1); ctx.rotate(a);
    const len = Math.hypot(x2 - x1, y2 - y1);
    ctx.beginPath();
    ctx.moveTo(0, -r); ctx.lineTo(len, -r);
    ctx.arc(len, 0, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(0, r);
    ctx.arc(0, 0, r, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.restore();
  }

  function spike(x, y, len, ang, w, fill) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, -w / 2); ctx.lineTo(len, 0); ctx.lineTo(0, w / 2);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.restore();
  }

  /* a row of spikes along a direction, used for carapaces and tails */
  function spikeRow(x, y, n, step, len, ang, w, fill, grow) {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      spike(x + Math.cos(ang) * step * i, y + Math.sin(ang) * step * i,
            len * lerp(grow === undefined ? 1 : grow, 1, t), ang - Math.PI / 2, w, fill);
    }
  }

  /* two-segment limb with tapering width and an optional hand/foot */
  function limb(x1, y1, mid, x3, y3, w1, w3, fill, capR) {
    const [mx, my] = mid;
    capsule(x1, y1, mx, my, w1, fill);
    capsule(mx, my, x3, y3, w3, fill);
    circle(mx, my, (w1 + w3) / 2 * 0.9, fill);
    if (capR) circle(x3, y3, capR, fill);
  }

  /* joint chain: tail, neck, tentacle. angles are absolute per segment */
  function chain(x, y, segs, len, angles, widths, fill, opts) {
    opts = opts || {};
    let px = x, py = y;
    for (let i = 0; i < segs; i++) {
      const a = angles[i], L = len * (opts.taper ? Math.pow(opts.taper, i) : 1);
      const nx = px + Math.cos(a) * L, ny = py + Math.sin(a) * L;
      capsule(px, py, nx, ny, widths[i], fill);
      px = nx; py = ny;
    }
    if (opts.cap) circle(px, py, widths[widths.length - 1], opts.cap);
    return [px, py];
  }

  /* tapered chain that reads as one organic limb instead of capsules */
  function taperChain(x, y, len, angles, w0, w1, fill, opts) {
    opts = opts || {};
    const n = angles.length;
    const left = [], right = [];
    let px = x, py = y;
    for (let i = 0; i < n; i++) {
      const a = angles[i];
      const t = n === 1 ? 1 : i / (n - 1);
      const L = len * (opts.taper ? Math.pow(opts.taper, i) : 1);
      const nx = px + Math.cos(a) * L, ny = py + Math.sin(a) * L;
      const w = lerp(w0, w1, t) / 2;
      const na = a + Math.PI / 2;
      left.push([px + Math.cos(na) * w, py + Math.sin(na) * w]);
      right.push([nx + Math.cos(na) * w, ny + Math.sin(na) * w]);
      px = nx; py = ny;
    }
    const pts = left.concat(right.reverse());
    if (opts.smooth === false) poly(pts, fill); else smooth(pts, fill);
    return [px, py];
  }

  /* ---- shading ---- */
  function bodyGradient(x0, y0, x1, y1, base, lightAmt, darkAmt) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, shade(base, lightAmt === undefined ? 0.10 : lightAmt));
    g.addColorStop(0.55, base);
    g.addColorStop(1, shade(base, darkAmt === undefined ? -0.16 : darkAmt));
    return g;
  }

  function glow(x, y, r, color, alpha) {
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, alpha === undefined ? 0.55 : alpha));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function eye(x, y, r, sclera, iris, glowColor) {
    circle(x, y, r, sclera);
    circle(x - r * 0.12, y, r * 0.62, iris);
    circle(x - r * 0.24, y - r * 0.2, r * 0.22, 'rgba(255,255,255,.85)');
    if (glowColor) glow(x, y, r * 3, glowColor, 0.30);
  }

  /* classic Godzilla dorsal fin */
  function dorsal(x, y, h, w, fill, angle) {
    ctx.save();
    ctx.translate(x, y);
    if (angle) ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.quadraticCurveTo(-w * 0.4, -h * 0.55, 0, -h);
    ctx.quadraticCurveTo(w * 0.7, -h * 0.5, w * 0.9, 0);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.restore();
  }

  function crystal(x, y, h, w, fill, edge) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(w * 0.55, -h * 0.35);
    ctx.lineTo(w * 0.4, 0);
    ctx.lineTo(-w * 0.4, 0);
    ctx.lineTo(-w * 0.55, -h * 0.35);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (edge) {
      ctx.strokeStyle = edge; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(0, 0); ctx.stroke();
    }
    ctx.restore();
  }

  /* petal / leaf: pointed at the tip, rounded at the stem */
  function leafShape(x, y, len, wid, rot, fill, veinColor) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(wid * 0.5, -len * 0.35, 0, -len);
    ctx.quadraticCurveTo(-wid * 0.5, -len * 0.35, 0, 0);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (veinColor) {
      ctx.strokeStyle = veinColor; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -len * 0.9); ctx.stroke();
    }
    ctx.restore();
  }

  /* moth / bat wing from a shoulder, drawn as a lobed membrane */
  function wing(x, y, span, chord, rot, fill, veins, veinColor) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(span * 0.35, -chord * 0.85, span, -chord * 0.45);
    ctx.quadraticCurveTo(span * 0.86, chord * 0.10, span * 0.52, chord * 0.16);
    ctx.quadraticCurveTo(span * 0.24, chord * 0.30, 0, 0);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (veins) {
      ctx.strokeStyle = veinColor || 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.4;
      for (let i = 1; i <= veins; i++) {
        const t = i / (veins + 1);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(span * 0.4, -chord * 0.6 * t, span * t, -chord * 0.45 * t + chord * 0.05);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* pincer / claw pair opening by `open` (0 closed .. 1 open) */
  function pincer(x, y, len, ang, open, fill, dark) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    const o = open * 0.45;
    ctx.rotate(-o);
    ctx.beginPath();
    ctx.moveTo(0, -len * 0.10);
    ctx.quadraticCurveTo(len * 0.7, -len * 0.30, len, -len * 0.02);
    ctx.quadraticCurveTo(len * 0.55, -len * 0.02, 0, len * 0.10);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    ctx.rotate(o * 2);
    ctx.beginPath();
    ctx.moveTo(0, len * 0.10);
    ctx.quadraticCurveTo(len * 0.7, len * 0.30, len, len * 0.02);
    ctx.quadraticCurveTo(len * 0.55, len * 0.02, 0, -len * 0.10);
    ctx.closePath(); ctx.fillStyle = dark || shade(fill, -0.12); ctx.fill();
    ctx.restore();
  }

  function saw(x, y, r, rot, fill, teeth) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath();
    const n = teeth || 14;
    for (let i = 0; i < n * 2; i++) {
      const a = i / (n * 2) * TAU;
      const rr = i % 2 ? r : r * 0.82;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    circle(0, 0, r * 0.34, shade(fill, -0.25));
    ctx.restore();
  }

  /* jagged mouth line with teeth */
  function mouth(x, y, w, h, open, toothColor, teeth) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#2a1418';
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, Math.max(1.5, h / 2 * open), 0, 0, TAU);
    ctx.fill();
    if (open > 0.15) {
      ctx.fillStyle = toothColor || '#f0ead8';
      const n = teeth || 6;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, tx = -w / 2 + w * t;
        spike(tx, -h * 0.42 * open, h * 0.34 * open, Math.PI / 2, w / n * 0.55, toothColor || '#f0ead8');
        spike(tx, h * 0.42 * open, h * 0.34 * open, -Math.PI / 2, w / n * 0.55, toothColor || '#f0ead8');
      }
    }
    ctx.restore();
  }

  /* ground shadow under a fighter */
  function shadow(x, y, rx, alpha) {
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 1, x, y, rx);
    g.addColorStop(0, 'rgba(0,0,0,' + (alpha === undefined ? 0.45 : alpha) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.22, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ---- animation maths ---- */
  /* phase 0..1 through the current attack stage */
  function attackPhase(f) {
    const s = f.state;
    if (!s.atk) return 0;
    const a = s.atk;
    if (s.t < a.windup) return s.t / a.windup * 0.5;
    if (s.t < a.windup + a.active) return 0.5 + (s.t - a.windup) / a.active * 0.5;
    return 1;
  }

  /* walk cycle amount: 0 idle, 1 walking */
  function gait(f, time) {
    const sp = Math.abs(f.vx || 0);
    const amt = clamp(sp / 220, 0, 1);
    return { amt, p: Math.sin(time * 7.2), p2: Math.sin(time * 7.2 + Math.PI) };
  }

  /* hurt recoil amount */
  function hurtAmt(f) {
    return f.state.name === 'hurt' ? clamp(1 - f.state.t / (f.state.dur || 0.3), 0, 1) : 0;
  }

  return {
    TAU, lerp, clamp, ease, easeOut, wave,
    hex2rgb, rgb2hex, shade, mix, rgba,
    face, poly, smooth, tracePoly, traceSmooth,
    ellipse, circle, capsule, spike, spikeRow, limb,
    chain, taperChain, bodyGradient, glow, eye, dorsal, crystal, leafShape, wing,
    pincer, saw, mouth, shadow,
    attackPhase, gait, hurtAmt,
  };
})();
