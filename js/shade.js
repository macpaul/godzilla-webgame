/* ==========================================================================
   shade.js — light rig, materials, procedural texture, post pass.

   The kaiju in art.js are flat polygons. This module is what turns them
   into something that reads as lit, solid, and made of a specific
   material, in the way Switch-era 2D games look:

     key + fill + rim light, a soft terminator, contact shadows between
     overlapping parts, aerial perspective on far-side limbs, material
     texture at the right scale, and a whole-frame bloom/grade/vignette.

   Everything is deterministic: textures are seeded from a string so they
   do not crawl between frames.

   Interface used by art.js / game.js:
     Shade.setLight({ang, key, rim, amb, ...})   one light rig per stage
     Shade.body(pts, base, opts)                lit, textured, rimmed shape
     Shade.contact(pts, opts)                   shadow a part casts on the
                                                part already drawn under it
     Shade.far(color, amt)                      aerial-perspective tint
     Shade.flat(pts, color)                     unlit shape (silhouette work)
     Shade.glow(x, y, r, color, i)              additive emissive blob
     Shade.sparkle(x, y, r, color, i)           crystal star highlight
     Shade.post(canvas, ctx, opts)              bloom + grade + vignette
   ========================================================================== */
'use strict';

const Shade = (() => {

  /* ---------------- light rig ---------------- */
  /* ang points from the subject TOWARD the key light, in canvas space
     (y grows down), so -2.2 rad is a low sun in the upper left. */
  const L = {
    ang: -2.15,
    key: '#fff1d2', keyInt: 0.34,
    rim: '#8ecfff', rimInt: 0.60, rimW: 2.2,
    amb: '#243549', ambInt: 0.60,
    hemi: 0.30,                 // extra light from above, dark from below
    fog: '#2b3d52', fogAmt: 0.55, // far-side limbs drift toward this
  };
  let lx = 0, ly = 0;

  function setLight(o) {
    Object.assign(L, o || {});
    lx = Math.cos(L.ang); ly = Math.sin(L.ang);
    return L;
  }
  setLight();

  const light = () => L;

  /* ---------------- deterministic noise ---------------- */
  function hash(s) {
    let h = 2166136261 >>> 0;
    s = String(s);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function rng(seed) {
    let a = typeof seed === 'number' ? seed >>> 0 : hash(seed);
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- geometry helpers ---------------- */
  function trace(pts, rounded) {
    ctx.beginPath();
    if (rounded === false) Rig.tracePoly(pts); else Rig.traceSmooth(pts);
    ctx.closePath();
  }
  function bbox(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) {
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
    }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  /* extent of the shape along the light axis -> where lit and shadow ends are */
  function lightSpan(pts) {
    let lo = Infinity, hi = -Infinity;
    for (const p of pts) { const d = p[0] * lx + p[1] * ly; if (d < lo) lo = d; if (d > hi) hi = d; }
    return { lo, hi };
  }

  /* ---------------- aerial perspective ---------------- */
  /* the far side of a kaiju is drawn the way a 3D renderer does it: less
     saturated, closer to the stage's air colour, a touch darker. */
  function far(color, amt) {
    const a = amt === undefined ? L.fogAmt : amt;
    return Rig.shade(Rig.mix(color, L.fog, a), -0.06);
  }

  /* ---------------- procedural textures ---------------- */
  /* Each texture draws inside the already-clipped silhouette. `bb` is the
     shape's bounding box, `r` a seeded rng, `o` per-part options. */
  const TEX = {
    /* the 1954 suit's keloid-scarring: overlapping healed arcs */
    keloid(bb, r, o) {
      const s = o.texSize || 9;
      for (let y = bb.y0; y < bb.y1; y += s * 0.62) {
        const off = (Math.round(y / s) % 2) * s * 0.5;
        for (let x = bb.x0 - s; x < bb.x1 + s; x += s) {
          const jx = x + off + (r() - 0.5) * s * 0.5, jy = y + (r() - 0.5) * s * 0.3;
          const a0 = Math.PI * (0.85 + r() * 0.25), a1 = a0 + Math.PI * (0.55 + r() * 0.4);
          ctx.beginPath(); ctx.arc(jx, jy, s * (0.42 + r() * 0.22), a0, a1);
          ctx.strokeStyle = Rig.rgba(o.light, 0.10 + r() * 0.07);
          ctx.lineWidth = 1.1; ctx.stroke();
          ctx.beginPath(); ctx.arc(jx, jy + 1.4, s * (0.42 + r() * 0.2), a0, a1);
          ctx.strokeStyle = Rig.rgba(o.dark, 0.13 + r() * 0.08);
          ctx.stroke();
        }
      }
    },
    /* overlapping diamond scales, row by row */
    scales(bb, r, o) {
      const s = o.texSize || 7;
      for (let y = bb.y0, row = 0; y < bb.y1; y += s * 0.55, row++) {
        for (let x = bb.x0 - s; x < bb.x1 + s; x += s) {
          const cx = x + (row % 2) * s * 0.5 + (r() - 0.5) * 1.5;
          ctx.beginPath();
          ctx.moveTo(cx, y - s * 0.5); ctx.lineTo(cx + s * 0.42, y);
          ctx.lineTo(cx, y + s * 0.5); ctx.lineTo(cx - s * 0.42, y);
          ctx.closePath();
          ctx.fillStyle = Rig.rgba(o.light, 0.05 + r() * 0.05); ctx.fill();
          ctx.strokeStyle = Rig.rgba(o.dark, 0.12); ctx.lineWidth = 0.8; ctx.stroke();
        }
      }
    },
    /* armour plates with lit top edges and dark seams (Destoroyah, Gigan) */
    plates(bb, r, o) {
      const s = o.texSize || 13;
      for (let y = bb.y0, row = 0; y < bb.y1; y += s * 0.72, row++) {
        for (let x = bb.x0 - s; x < bb.x1 + s; x += s) {
          const cx = x + (row % 2) * s * 0.5 + (r() - 0.5) * 2;
          const w = s * (0.40 + r() * 0.12), h = s * (0.30 + r() * 0.14);
          ctx.beginPath();
          ctx.moveTo(cx - w, y + h); ctx.lineTo(cx - w * 0.7, y - h);
          ctx.lineTo(cx + w * 0.7, y - h); ctx.lineTo(cx + w, y + h);
          ctx.closePath();
          ctx.fillStyle = Rig.rgba(o.light, 0.05 + r() * 0.05); ctx.fill();
          ctx.strokeStyle = Rig.rgba(o.dark, 0.16); ctx.lineWidth = 1; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx - w * 0.65, y - h + 0.6); ctx.lineTo(cx + w * 0.65, y - h + 0.6);
          ctx.strokeStyle = Rig.rgba(o.light, 0.16); ctx.stroke();
        }
      }
    },
    /* crustacean shell: growth rings plus scattered nodules */
    chitin(bb, r, o) {
      const s = o.texSize || 10;
      for (let y = bb.y0 + s * 0.4; y < bb.y1; y += s * 0.8) {
        ctx.beginPath();
        ctx.moveTo(bb.x0, y + Math.sin(bb.x0 * 0.05) * 2);
        for (let x = bb.x0; x <= bb.x1; x += 6) ctx.lineTo(x, y + Math.sin(x * 0.09) * 2.2);
        ctx.strokeStyle = Rig.rgba(o.dark, 0.14); ctx.lineWidth = 1.2; ctx.stroke();
        ctx.beginPath();
        for (let x = bb.x0; x <= bb.x1; x += 6) {
          const yy = y - 1.6 + Math.sin(x * 0.09) * 2.2;
          if (x === bb.x0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.strokeStyle = Rig.rgba(o.light, 0.10); ctx.stroke();
      }
      for (let i = 0; i < (bb.w * bb.h) / 260; i++) {
        const x = bb.x0 + r() * bb.w, y = bb.y0 + r() * bb.h, rr = 0.7 + r() * 1.5;
        ctx.beginPath(); ctx.arc(x, y, rr, 0, 7);
        ctx.fillStyle = Rig.rgba(o.light, 0.10 + r() * 0.10); ctx.fill();
      }
    },
    /* long fibre striations, used on thighs, necks, tails */
    muscle(bb, r, o) {
      const s = o.texSize || 8, dir = o.texDir || 0;
      const dx = Math.cos(dir), dy = Math.sin(dir);
      for (let i = -bb.h; i < bb.w + bb.h; i += s) {
        const x = bb.x0 + i, y = bb.y0 - bb.h * 0.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + dx * (bb.h + s * 2), y + dy * (bb.h + s * 2));
        ctx.strokeStyle = Rig.rgba(r() > 0.5 ? o.light : o.dark, 0.05 + r() * 0.06);
        ctx.lineWidth = 1 + r() * 1.6; ctx.stroke();
      }
    },
    /* fur: short strokes that follow the silhouette edge, plus a
       quieter inner layer so the thorax reads as fuzzy, not spiky */
    fur(bb, r, o) {
      const s = o.texSize || 6, n = (bb.w + bb.h) * 1.4;
      for (let i = 0; i < n; i++) {
        const t = r();
        const x = t < 0.5 ? bb.x0 + r() * 3 : bb.x1 - r() * 3;
        const y = bb.y0 + r() * bb.h;
        const a = Math.atan2(y - bb.cy, x - bb.cx) + (r() - 0.5) * 0.9;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
        ctx.strokeStyle = Rig.rgba(r() > 0.35 ? o.light : o.dark, 0.10 + r() * 0.14);
        ctx.lineWidth = 0.9; ctx.stroke();
      }
      for (let i = 0; i < n * 0.25; i++) {
        const x = bb.x0 + r() * bb.w, y = bb.y0 + r() * bb.h;
        const a = r() * 6.283;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.6);
        ctx.strokeStyle = Rig.rgba(o.light, 0.06 + r() * 0.06); ctx.stroke();
      }
    },
    /* wing membrane: veins radiating from an anchor, plus a soft sheen */
    membrane(bb, r, o) {
      const a = o.anchor || [bb.x0, bb.cy];
      const reach = Math.max(bb.w, bb.h) * 1.5;
      for (let i = 0; i < 9; i++) {
        const ang = Math.atan2(bb.cy - a[1], bb.cx - a[0]) + (i - 4) * 0.19;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]);
        let x = a[0], y = a[1];
        for (let s = 0; s < 7; s++) {
          x += Math.cos(ang + (r() - 0.5) * 0.22) * reach / 7;
          y += Math.sin(ang + (r() - 0.5) * 0.22) * reach / 7;
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = Rig.rgba(o.dark, 0.16); ctx.lineWidth = 1.6 - i * 0.08; ctx.stroke();
        ctx.strokeStyle = Rig.rgba(o.light, 0.06); ctx.lineWidth = 0.7; ctx.stroke();
      }
      for (let i = 0; i < 26; i++) {
        const x = bb.x0 + r() * bb.w, y = bb.y0 + r() * bb.h;
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.lineTo(x + (r() - 0.5) * 14, y + (r() - 0.5) * 14);
        ctx.strokeStyle = Rig.rgba(o.dark, 0.07); ctx.lineWidth = 0.8; ctx.stroke();
      }
    },
    /* Hedorah's sludge: tar blobs, running drips, oily sheen */
    sludge(bb, r, o) {
      for (let i = 0; i < (bb.w * bb.h) / 900; i++) {
        const x = bb.x0 + r() * bb.w, y = bb.y0 + r() * bb.h;
        const w = bb.w * (0.05 + r() * 0.16), h = w * (0.4 + r() * 0.5);
        ctx.beginPath(); ctx.ellipse(x, y, w, h, r() * 3.14, 0, 7);
        ctx.fillStyle = Rig.rgba(o.dark, 0.16 + r() * 0.14); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x - w * 0.2, y - h * 0.3, w * 0.6, h * 0.4, 0, 0, 7);
        ctx.fillStyle = Rig.rgba(o.light, 0.06 + r() * 0.06); ctx.fill();
      }
      for (let i = 0; i < 10; i++) {
        const x = bb.x0 + r() * bb.w, y = bb.y0 + r() * bb.h * 0.7;
        const len = 6 + r() * bb.h * 0.18;
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + (r() - 0.5) * 4, y + len * 0.6, x, y + len);
        ctx.strokeStyle = Rig.rgba(o.dark, 0.22); ctx.lineWidth = 1.6 + r() * 2.2; ctx.stroke();
      }
      for (let i = 0; i < 14; i++) {
        const x = bb.x0 + r() * bb.w, y = bb.y0 + r() * bb.h;
        ctx.beginPath(); ctx.ellipse(x, y, 3 + r() * 9, 1.4 + r() * 3, r() * 3.14, 0, 7);
        ctx.fillStyle = Rig.rgba(o.sheen || '#7fd8ff', 0.05 + r() * 0.07); ctx.fill();
      }
    },
    /* kelp-like ribbons over the sludge body (Showa Hedorah) */
    kelp(bb, r, o) {
      for (let i = 0; i < bb.w / 9 + 4; i++) {
        const x = bb.x0 + r() * bb.w;
        ctx.beginPath(); ctx.moveTo(x, bb.y0 - 4);
        for (let y = bb.y0 - 4; y < bb.y1 + 4; y += 8)
          ctx.lineTo(x + Math.sin(y * 0.06 + i) * (3 + r() * 4), y);
        ctx.strokeStyle = Rig.rgba(r() > 0.5 ? o.light : o.dark, 0.10 + r() * 0.08);
        ctx.lineWidth = 2 + r() * 4; ctx.stroke();
      }
    },
    /* faceted crystal: hard planes, internal edges, sparkle */
    crystal(bb, r, o) {
      const n = Math.max(4, Math.round((bb.w + bb.h) / 12));
      for (let i = 0; i < n; i++) {
        const x = bb.x0 + r() * bb.w, y = bb.y0 + r() * bb.h;
        const a = r() * 6.283, s = Math.max(bb.w, bb.h) * (0.18 + r() * 0.3);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
        ctx.lineTo(x + Math.cos(a + 1.1) * s * 0.8, y + Math.sin(a + 1.1) * s * 0.8);
        ctx.closePath();
        ctx.fillStyle = Rig.rgba(o.light, 0.10 + r() * 0.12); ctx.fill();
        ctx.strokeStyle = Rig.rgba('#ffffff', 0.10 + r() * 0.14); ctx.lineWidth = 0.9; ctx.stroke();
      }
      for (let i = 0; i < 5; i++) {
        const x = bb.x0 + r() * bb.w, y = bb.y0 + r() * bb.h;
        ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y);
        ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4);
        ctx.strokeStyle = Rig.rgba('#ffffff', 0.25); ctx.lineWidth = 1; ctx.stroke();
      }
    },
    /* cyborg plating: panel seams, rivets, one hard specular streak */
    metal(bb, r, o) {
      for (let i = 0; i < 5; i++) {
        const y = bb.y0 + (i + 0.5) * bb.h / 5 + (r() - 0.5) * 4;
        ctx.beginPath(); ctx.moveTo(bb.x0, y); ctx.lineTo(bb.x1, y + (r() - 0.5) * 6);
        ctx.strokeStyle = Rig.rgba(o.dark, 0.20); ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bb.x0, y + 1.2); ctx.lineTo(bb.x1, y + 1.2 + (r() - 0.5) * 6);
        ctx.strokeStyle = Rig.rgba(o.light, 0.12); ctx.stroke();
      }
      for (let i = 0; i < (bb.w * bb.h) / 500; i++) {
        const x = bb.x0 + 3 + r() * (bb.w - 6), y = bb.y0 + 3 + r() * (bb.h - 6);
        ctx.beginPath(); ctx.arc(x, y, 1.1, 0, 7);
        ctx.fillStyle = Rig.rgba(o.dark, 0.30); ctx.fill();
        ctx.beginPath(); ctx.arc(x - 0.4, y - 0.5, 0.5, 0, 7);
        ctx.fillStyle = Rig.rgba('#ffffff', 0.35); ctx.fill();
      }
    },
    /* leaf / petal venation for Biollante */
    leaf(bb, r, o) {
      const mid = bb.cy;
      for (let i = 0; i < 12; i++) {
        const t = i / 11, x = bb.x0 + t * bb.w;
        ctx.beginPath(); ctx.moveTo(x, mid);
        ctx.quadraticCurveTo(x + bb.w * 0.05, mid - bb.h * 0.22, x + bb.w * 0.12, mid - bb.h * 0.42);
        ctx.strokeStyle = Rig.rgba(o.dark, 0.12); ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, mid);
        ctx.quadraticCurveTo(x + bb.w * 0.05, mid + bb.h * 0.22, x + bb.w * 0.12, mid + bb.h * 0.42);
        ctx.stroke();
      }
    },
    /* the folded, brain-like flesh on Biollante's chest */
    brain(bb, r, o) {
      const n = Math.max(4, Math.round(bb.h / 7));
      for (let i = 0; i < n; i++) {
        const y = bb.y0 + (i + 0.5) * bb.h / n, amp = bb.h / n * 0.9;
        ctx.beginPath();
        ctx.moveTo(bb.x0 - 2, y);
        for (let x = bb.x0; x < bb.x1; x += bb.w / 6)
          ctx.quadraticCurveTo(x + bb.w / 12, y + (r() - 0.5) * amp,
            x + bb.w / 6, y + (r() - 0.5) * amp * 0.4);
        ctx.strokeStyle = Rig.rgba(o.dark, 0.16);
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    },
    /* sparse pitting + speckle, a quiet default for plain hide */
    pitted(bb, r, o) {
      for (let i = 0; i < (bb.w * bb.h) / 320; i++) {
        const x = bb.x0 + r() * bb.w, y = bb.y0 + r() * bb.h, rr = 0.6 + r() * 1.4;
        ctx.beginPath(); ctx.arc(x, y, rr, 0, 7);
        ctx.fillStyle = Rig.rgba(r() > 0.6 ? o.light : o.dark, 0.06 + r() * 0.09); ctx.fill();
      }
    },
  };

  /* ---------------- the workhorse ---------------- */
  /* body(pts, base, opts)
       opts.rounded   false => straight-edged polygon (default smooth)
       opts.tex       key into TEX
       opts.seed      stable string for the texture rng
       opts.gloss     0..1 specular strength (metal, wet shell, crystal)
       opts.rimOn     default true
       opts.rimW      rim width in px (default from the light rig)
       opts.ao        inner ambient occlusion strength
       opts.trans     0..1 translucency: light bleeds through thin parts
       opts.tint      overrides the key colour (for emissive parts)
       opts.flat      skip shading (pure flat colour)
       opts.stroke    optional outline colour/width (ink read at distance) */
  function body(pts, base, o) {
    o = o || {};
    if (o.flat) { trace(pts, o.rounded); ctx.fillStyle = base; ctx.fill(); return; }
    const bb = bbox(pts), sp = lightSpan(pts);
    const key = o.tint || L.key;
    const lit = Rig.shade(Rig.mix(base, key, L.keyInt), 0.10);
    const shd = Rig.shade(Rig.mix(base, L.amb, L.ambInt), -0.10);
    const span = Math.max(1e-3, sp.hi - sp.lo);

    ctx.save();
    trace(pts, o.rounded);
    ctx.clip();

    /* 1. form gradient: lit side -> terminator -> shadow side */
    const g = ctx.createLinearGradient(
      sp.hi * lx, sp.hi * ly, sp.lo * lx, sp.lo * ly);
    g.addColorStop(0.00, lit);
    g.addColorStop(0.42, base);
    g.addColorStop(1.00, shd);
    ctx.fillStyle = g;
    ctx.fillRect(bb.x0 - 2, bb.y0 - 2, bb.w + 4, bb.h + 4);

    /* 2. hemisphere: sky above, bounce below. Cheap, but it is what makes
       a silhouette sit on the ground instead of floating. */
    if (L.hemi) {
      const hg = ctx.createLinearGradient(0, bb.y0, 0, bb.y1);
      hg.addColorStop(0, Rig.rgba(key, 0.10 * L.hemi));
      hg.addColorStop(0.55, 'rgba(0,0,0,0)');
      hg.addColorStop(1, Rig.rgba(L.amb, 0.22 * L.hemi));
      ctx.fillStyle = hg;
      ctx.fillRect(bb.x0 - 2, bb.y0 - 2, bb.w + 4, bb.h + 4);
    }

    /* 3. core shadow just inside the terminator */
    const ao = o.ao === undefined ? 0.35 : o.ao;
    if (ao > 0) {
      const cg = ctx.createLinearGradient(
        (sp.lo + span * 0.35) * lx, (sp.lo + span * 0.35) * ly, sp.lo * lx, sp.lo * ly);
      cg.addColorStop(0, 'rgba(0,0,0,0)');
      cg.addColorStop(1, Rig.rgba(Rig.shade(base, -0.55), ao));
      ctx.fillStyle = cg;
      ctx.fillRect(bb.x0 - 2, bb.y0 - 2, bb.w + 4, bb.h + 4);
    }

    /* 4. material texture */
    if (o.tex && TEX[o.tex]) {
      const r = rng(o.seed || (o.tex + bb.w.toFixed(1) + bb.h.toFixed(1)));
      TEX[o.tex](bb, r, {
        light: Rig.shade(base, 0.42), dark: Rig.shade(base, -0.5),
        sheen: o.sheen || L.rim, texSize: o.texSize, texDir: o.texDir,
        anchor: o.anchor,
      });
    }

    /* 5. specular band on the lit edge */
    if (o.gloss > 0) {
      ctx.save();
      ctx.translate(-lx * (bb.w + bb.h) * 0.02, -ly * (bb.w + bb.h) * 0.02);
      ctx.lineWidth = Math.max(1.2, (bb.w + bb.h) * 0.012);
      ctx.strokeStyle = Rig.rgba('#ffffff', 0.10 + 0.45 * o.gloss);
      ctx.beginPath();
      if (o.rounded === false) Rig.tracePoly(pts); else Rig.traceSmooth(pts);
      ctx.stroke();
      ctx.restore();
    }

    /* 6. rim light on the edge facing away from the key */
    if (o.rimOn !== false) {
      const w = o.rimW || L.rimW;
      ctx.save();
      ctx.translate(lx * w * 1.15, ly * w * 1.15);
      ctx.lineWidth = w;
      ctx.strokeStyle = Rig.rgba(L.rim, L.rimInt);
      ctx.beginPath();
      if (o.rounded === false) Rig.tracePoly(pts); else Rig.traceSmooth(pts);
      ctx.stroke();
      /* a second, thinner, brighter core inside the rim */
      ctx.lineWidth = Math.max(0.7, w * 0.4);
      ctx.strokeStyle = Rig.rgba(Rig.mix(L.rim, '#ffffff', 0.55), L.rimInt * 0.8);
      ctx.stroke();
      ctx.restore();
    }

    /* 7. subsurface bleed for thin parts: wings, membranes, petals */
    if (o.trans > 0) {
      const tg = ctx.createLinearGradient(sp.hi * lx, sp.hi * ly, sp.lo * lx, sp.lo * ly);
      tg.addColorStop(0, Rig.rgba(Rig.mix(base, key, 0.7), 0.55 * o.trans));
      tg.addColorStop(0.6, Rig.rgba(base, 0));
      ctx.fillStyle = tg;
      ctx.fillRect(bb.x0 - 2, bb.y0 - 2, bb.w + 4, bb.h + 4);
    }
    ctx.restore();

    if (o.stroke) {
      trace(pts, o.rounded);
      ctx.strokeStyle = o.stroke;
      ctx.lineWidth = o.strokeW || 1.2;
      ctx.stroke();
    }
  }

  /* the shadow one part throws onto the part already under it */
  function contact(pts, o) {
    o = o || {};
    const d = o.dist === undefined ? 4 : o.dist;
    const a = o.alpha === undefined ? 0.30 : o.alpha;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = Rig.shade(L.amb, -0.35);
    ctx.beginPath();
    ctx.translate(-lx * d, -ly * d);
    if (o.rounded === false) Rig.tracePoly(pts); else Rig.traceSmooth(pts);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* unlit shape: silhouettes, hard shadows, decals */
  function flat(pts, color, rounded) {
    trace(pts, rounded);
    ctx.fillStyle = color;
    ctx.fill();
  }

  /* claw or pincer pair: two shaded blades that open by `open` */
  function pincer(x, y, len, ang, open, base, dark) {
    const o = (open || 0) * 0.45;
    const ts = Math.max(4, len * 0.13);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.rotate(-o);
    body([[0, -len * 0.10], [len * 0.42, -len * 0.27], [len, -len * 0.03], [len * 0.55, -len * 0.02]],
      base, { rounded: true, tex: 'chitin', texSize: ts, gloss: 0.30, rimOn: true, seed: 711 });
    ctx.rotate(o * 2);
    body([[0, len * 0.10], [len * 0.42, len * 0.27], [len, len * 0.03], [len * 0.55, len * 0.02]],
      dark || Rig.shade(base, -0.12),
      { rounded: true, tex: 'chitin', texSize: ts, gloss: 0.30, seed: 712 });
    ctx.restore();
  }

  /* shaded crystal: form gradient, hard facet edge, inner glow.
     Used by SpaceGodzilla's shoulder blades, dorsals and tail spikes. */
  function crystal(x, y, hh, w, o) {
    o = o || {};
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    const pts = [[0, -hh], [w * 0.55, -hh * 0.35], [w * 0.4, 0], [-w * 0.4, 0], [-w * 0.55, -hh * 0.35]];
    body(pts, o.base || '#eaf4ff', {
      rounded: false, tex: 'crystal', texSize: Math.max(4, w * 0.4),
      gloss: 0.65, rimOn: true, ao: 0.20, seed: o.seed || 901,
    });
    ctx.save();
    trace(pts, false);
    ctx.clip();
    const g = ctx.createLinearGradient(-w * 0.55, -hh, w * 0.55, 0);
    g.addColorStop(0, Rig.rgba('#ffffff', 0.38));
    g.addColorStop(0.55, Rig.rgba('#ffffff', 0.04));
    g.addColorStop(1, Rig.rgba('#000000', 0.20));
    ctx.fillStyle = g;
    ctx.fillRect(-w, -hh - 2, w * 2, hh + 4);
    ctx.strokeStyle = Rig.rgba('#ffffff', 0.55);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, -hh); ctx.lineTo(0, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-w * 0.5, -hh * 0.34); ctx.lineTo(w * 0.5, -hh * 0.30); ctx.stroke();
    ctx.restore();
    if (o.glowColor) glow(0, -hh * 0.55, hh * 0.8, o.glowColor, o.glowInt === undefined ? 0.28 : o.glowInt);
    ctx.restore();
  }

  /* ---------------- emissive bits ---------------- */
  function glow(x, y, r, color, i) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, Rig.rgba(color, i === undefined ? 0.85 : i));
    g.addColorStop(0.45, Rig.rgba(color, (i === undefined ? 0.85 : i) * 0.35));
    g.addColorStop(1, Rig.rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.restore();
  }

  function sparkle(x, y, r, color, i) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = Rig.rgba(color, i === undefined ? 0.8 : i);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
    ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * 0.28, 0, 7);
    ctx.fillStyle = Rig.rgba('#ffffff', 0.7); ctx.fill();
    ctx.restore();
  }

  /* soft blob light used for stage props (lava, windows, beams) */
  function wash(x, y, r, color, i) { glow(x, y, r, color, i); }

  /* ---------------- whole-frame post pass ---------------- */
  let bloomBuf = null, bloomCtx = null, filterOK = null;
  function canFilter(c) {
    if (filterOK === null) filterOK = typeof c.filter === 'string';
    return filterOK;
  }
  function post(srcCanvas, c, o) {
    o = o || {};
    const bloom = o.bloom === undefined ? 0.30 : o.bloom;
    const vig = o.vignette === undefined ? 0.34 : o.vignette;
    const grade = o.grade || ['#5fd0ff', '#ffb46b'];

    if (bloom > 0 && canFilter(c)) {
      const s = 0.34, bw = Math.max(2, Math.round(srcCanvas.width * s)),
        bh = Math.max(2, Math.round(srcCanvas.height * s));
      if (!bloomBuf || bloomBuf.width !== bw) {
        bloomBuf = document.createElement('canvas');
        bloomBuf.width = bw; bloomBuf.height = bh;
        bloomCtx = bloomBuf.getContext('2d');
      }
      bloomCtx.setTransform(1, 0, 0, 1, 0, 0);
      bloomCtx.clearRect(0, 0, bw, bh);
      /* keep only the bright half of the frame, then blur it small */
      bloomCtx.filter = 'brightness(1.35) saturate(1.2) blur(2.4px)';
      bloomCtx.drawImage(srcCanvas, 0, 0, bw, bh);
      bloomCtx.filter = 'none';
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = bloom;
      c.imageSmoothingEnabled = true;
      c.drawImage(bloomBuf, 0, 0, srcCanvas.width, srcCanvas.height);
      c.restore();
    }

    /* split-tone grade: cool up top, warm along the ground line */
    c.save();
    c.globalCompositeOperation = 'overlay';
    const gg = c.createLinearGradient(0, 0, 0, srcCanvas.height);
    gg.addColorStop(0, Rig.rgba(grade[0], 0.10));
    gg.addColorStop(0.55, 'rgba(0,0,0,0)');
    gg.addColorStop(1, Rig.rgba(grade[1], 0.09));
    c.fillStyle = gg;
    c.fillRect(0, 0, srcCanvas.width, srcCanvas.height);
    c.restore();

    /* vignette: pulls the eye to the middle and flattens the corners */
    if (vig > 0) {
      c.save();
      const r = Math.max(srcCanvas.width, srcCanvas.height) * 0.78;
      const vg = c.createRadialGradient(
        srcCanvas.width / 2, srcCanvas.height * 0.52, r * 0.42,
        srcCanvas.width / 2, srcCanvas.height * 0.52, r);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, Rig.rgba('#05070c', vig));
      c.fillStyle = vg;
      c.fillRect(0, 0, srcCanvas.width, srcCanvas.height);
      c.restore();
    }
  }

  return {
    setLight, light, hash, rng, bbox, trace,
    body, contact, flat, far, pincer, crystal, glow, wash, sparkle, post,
  };
})();
