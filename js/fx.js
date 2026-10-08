/* =========================================================
   fx.js — パーティクル / 飛翔体 / 効果
   Projectiles, lingering hazards, telegraph markers, damage
   numbers, screen shake and hit-stop all live here. Collision
   is resolved by game.js; this module only moves and draws.
   ========================================================= */
'use strict';

const FX = (() => {
  let parts = [], projs = [], waves = [], hazards = [], texts = [], tells = [];
  let shake = 0, hitStop = 0, flash = 0, flashColor = '#ffffff';

  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  function reset() {
    parts = []; projs = []; waves = []; hazards = []; texts = []; tells = [];
    shake = 0; hitStop = 0; flash = 0;
  }

  /* ---------------- particles ---------------- */
  const PALETTE = {
    dust:    ['#b8a890', '#9a8a72', '#7a6a56'],
    spark:   ['#ffe89a', '#ffb84a', '#ff8a3c'],
    blood:   ['#8a2a2a', '#6a1c1c', '#a83a3a'],
    scale:   ['#ffe87a', '#f0e0a0', '#d8c878'],
    sludge:  ['#8fb84a', '#6a8a3a', '#5a7a30'],
    crystal: ['#e8f4ff', '#bfe0ff', '#8fc0ff'],
    ember:   ['#ffd070', '#ff8a3c', '#ff5a2a'],
    smoke:   ['#6a6a72', '#4a4a52', '#33333a'],
    beam:    ['#7fd8ff', '#bfeaff', '#4ab0e8'],
    fire:    ['#ffd070', '#ff8a3c', '#ff4a2a'],
    silk:    ['#f4f4e8', '#dedece'],
  };

  function particle(type, x, y, vx, vy, life, size, grav) {
    const pal = PALETTE[type] || PALETTE.dust;
    parts.push({
      type, x, y, vx, vy, life, max: life,
      size: size || 3, grav: grav === undefined ? 900 : grav,
      color: pal[(Math.random() * pal.length) | 0],
      spin: rnd(-6, 6), rot: rnd(0, 6.28),
    });
  }

  function burst(type, x, y, n, opt) {
    opt = opt || {};
    const spd = opt.speed || 260, spread = opt.spread || Math.PI * 2;
    const dir = opt.dir === undefined ? null : opt.dir;
    for (let i = 0; i < n; i++) {
      const a = dir === null ? rnd(-spread / 2, spread / 2) + (opt.base || -Math.PI / 2)
                             : dir + rnd(-spread / 2, spread / 2);
      const s = spd * rnd(0.35, 1.15);
      particle(type, x + rnd(-6, 6), y + rnd(-6, 6),
               Math.cos(a) * s, Math.sin(a) * s,
               rnd(0.25, opt.life || 0.7), rnd(2, opt.size || 5), opt.grav);
    }
  }

  function plume(type, x, y, n, opt) {
    opt = opt || {};
    for (let i = 0; i < n; i++)
      particle(type, x + rnd(-opt.w / 2, opt.w / 2), y + rnd(-4, 4),
               rnd(-40, 40), rnd(-120, -30), rnd(0.6, 1.6), rnd(3, opt.size || 9), -60);
  }

  /* ---------------- projectiles ---------------- */
  /* spec comes straight from an attack's `proj` block in data.js */
  function shoot(owner, spec, x, y, facing, element) {
    const count = spec.count || 1;
    const spread = spec.spread || 0;
    for (let i = 0; i < count; i++) {
      const off = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
      const a = off;
      projs.push({
        owner, spec, element: element || 'melee',
        x, y,
        vx: Math.cos(a) * spec.speed * facing,
        vy: Math.sin(a) * spec.speed - (spec.up || 0),
        r: spec.r || 10, life: spec.life || 3, age: 0,
        facing, spin: spec.spin ? 0 : null, rot: 0,
        gone: false, returned: false, hitOnce: spec.boomerang ? false : true,
      });
    }
  }

  function updateProjectiles(dt, targets) {
    for (const p of projs) {
      if (p.gone) continue;
      const s = p.spec;
      p.age += dt;
      if (p.age > p.life) { p.gone = true; continue; }

      if (s.homing) {
        const t = targets[p.owner === 'player' ? 'kaiju' : 'player'];
        if (t && t.alive) {
          const dx = t.x - p.x, dy = (t.y - (t.h || 0) * 0.5) - p.y;
          const d = Math.hypot(dx, dy) || 1;
          const k = s.homing * dt * 3.2;
          p.vx += (dx / d) * s.speed * k;
          p.vy += (dy / d) * s.speed * k;
        }
      }
      if (s.boomerang && !p.returned && p.age > p.life * 0.42) {
        p.returned = true;
        p.vx = -p.vx * 1.05;
        p.vy = -p.vy * 0.6;
      }
      p.vy += (s.grav || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.spin !== null) { p.spin += dt * 22; p.rot = p.spin; }

      if (p.x < -80 || p.x > W + 80) { p.gone = true; continue; }
      if (p.y > GROUND + 6) {
        if (s.pool) addHazard('pool', p.x, GROUND, 70, s.pool.dur, s.pool.dps, 'toxic');
        burst(s.fire ? 'fire' : s.color === '#8fdcf0' ? 'spark' : 'dust', p.x, GROUND, 10, { speed: 180 });
        p.gone = true;
      }
      if (s.trail && Math.random() < 0.5)
        particle(s.fire ? 'ember' : 'smoke', p.x, p.y, rnd(-20, 20), rnd(-30, 0), 0.4, 4, -40);
    }
    projs = projs.filter(p => !p.gone);
  }

  function removeProjectile(p) { p.gone = true; }
  function projectilesOf(owner) { return projs.filter(p => p.owner === owner && !p.gone); }

  /* ---------------- shockwaves ---------------- */
  function wave(x, y, r, color, opt) {
    opt = opt || {};
    waves.push({ x, y, r, maxR: r, color, age: 0, life: opt.life || 0.4, ring: opt.ring !== false });
  }

  /* ---------------- lingering hazards ---------------- */
  /* kind: pool | cloud | arena ; dmg is per-second */
  function addHazard(kind, x, y, r, dur, dps, element, extra) {
    const h = Object.assign({ kind, x, y, r, dps, element, age: 0, life: dur }, extra || {});
    hazards.push(h);
    return h;
  }
  function hazardsOf() { return hazards; }

  /* ---------------- telegraphs ---------------- */
  /* shape: flash (on the kaiju) | line (beam path) | ring (ground area) */
  function tell(shape, a, b, dur, color) {
    tells.push({ shape, a, b, age: 0, life: dur, color: color || '#ffd75e' });
  }

  /* ---------------- text / feedback ---------------- */
  function damageText(x, y, value, kind) {
    texts.push({ x, y, v: Math.round(value), kind: kind || 'normal', age: 0, life: 0.9,
                 vy: -70, vx: rnd(-30, 30) });
  }
  function label(x, y, str, color) {
    texts.push({ x, y, str, color, age: 0, life: 1.4, vy: -34, vx: 0 });
  }

  function addShake(v) { shake = Math.min(34, shake + v); }
  function addHitStop(s) { hitStop = Math.max(hitStop, s); }
  function addFlash(a, color) { flash = Math.max(flash, a); flashColor = color || '#ffffff'; }

  /* ---------------- update ---------------- */
  function update(dt) {
    for (const p of parts) {
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.spin * dt;
      p.life -= dt;
      if (p.y > GROUND && p.grav > 0) { p.y = GROUND; p.vy *= -0.28; p.vx *= 0.7; }
    }
    parts = parts.filter(p => p.life > 0);
    if (parts.length > 900) parts.splice(0, parts.length - 900);

    for (const w of waves) w.age += dt;
    waves = waves.filter(w => w.age < w.life);

    for (const h of hazards) h.age += dt;
    hazards = hazards.filter(h => h.age < h.life);

    for (const t of tells) t.age += dt;
    tells = tells.filter(t => t.age < t.life);

    for (const t of texts) {
      t.age += dt; t.x += t.vx * dt; t.y += t.vy * dt; t.vy += 60 * dt;
    }
    texts = texts.filter(t => t.age < t.life);

    shake *= Math.pow(0.0016, dt);
    if (shake < 0.05) shake = 0;
    flash *= Math.pow(0.002, dt);
    if (hitStop > 0) hitStop = Math.max(0, hitStop - dt);
  }

  /* ---------------- draw ---------------- */
  function shakeOffset() {
    if (!shake) return [0, 0];
    return [rnd(-shake, shake) * 0.6, rnd(-shake, shake) * 0.4];
  }

  function drawTelegraphs() {
    for (const t of tells) {
      const k = clamp(t.age / t.life, 0, 1);
      ctx.save();
      ctx.globalAlpha = 0.22 + 0.5 * k;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 2 + 2 * k;
      if (t.shape === 'ring') {
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.ellipse(t.a.x, t.a.y, t.a.r * (0.55 + 0.45 * k), t.a.r * 0.28 * (0.55 + 0.45 * k), 0, 0, 6.284);
        ctx.stroke();
      } else if (t.shape === 'line') {
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.moveTo(t.a.x, t.a.y);
        ctx.lineTo(t.b.x, t.b.y);
        ctx.stroke();
      } else if (t.shape === 'flash') {
        /* a warning arc over the kaiju that closes as the windup ends */
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(t.a.x, t.a.y, t.a.r * (1.25 - 0.35 * k), -Math.PI * 1.5,
                -Math.PI * 1.5 + k * 6.284);
        ctx.stroke();
        ctx.globalAlpha = 0.18 * k;
        ctx.fillStyle = t.color;
        ctx.beginPath(); ctx.arc(t.a.x, t.a.y, t.a.r * 0.5, 0, 6.284); ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawWaves() {
    for (const w of waves) {
      const k = w.age / w.life;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.6;
      ctx.strokeStyle = w.color;
      ctx.lineWidth = 6 * (1 - k) + 1;
      const r = w.maxR * (0.25 + 0.75 * k);
      if (w.ring) {
        ctx.beginPath(); ctx.ellipse(w.x, w.y, r, r * 0.32, 0, 0, 6.284); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(w.x, w.y, r, 0, 6.284); ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawHazards() {
    for (const h of hazards) {
      const k = 1 - h.age / h.life;
      ctx.save();
      if (h.kind === 'pool') {
        ctx.globalAlpha = 0.55 * k;
        ctx.fillStyle = h.color || '#7aa83a';
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * (0.7 + 0.3 * k), 12, 0, 0, 6.284); ctx.fill();
        ctx.globalAlpha = 0.25 * k;
        ctx.beginPath(); ctx.ellipse(h.x, h.y - 4, h.r * 0.8, 18, 0, 0, 6.284); ctx.fill();
      } else {
        const r = h.kind === 'arena' ? 640 : h.r;
        const cx = h.kind === 'arena' ? W / 2 : h.x;
        const g = ctx.createRadialGradient(cx, h.y - 40, 10, cx, h.y - 40, r);
        const col = h.element === 'toxic' ? '150,220,90' : h.element === 'oxygen' ? '255,110,110' : '220,220,160';
        g.addColorStop(0, 'rgba(' + col + ',' + (0.30 * k).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + col + ',0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - r, h.y - 40 - r, r * 2, r * 2);
      }
      ctx.restore();
    }
  }

  function drawProjectiles() {
    for (const p of projs) {
      const s = p.spec;
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.rot) ctx.rotate(p.rot);
      if (s.ring) {
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = s.color; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, p.r * (1 + p.age * 1.6), 0, 6.284); ctx.stroke();
      } else if (s.spin) {
        ctx.fillStyle = s.color;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * 6.284, rr = i % 2 ? p.r : p.r * 0.45;
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath(); ctx.fill();
      } else {
        ctx.shadowColor = s.color; ctx.shadowBlur = 14;
        ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 6.284); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(-p.r * 0.25, -p.r * 0.25, p.r * 0.4, 0, 6.284); ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of parts) {
      const k = clamp(p.life / p.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = k;
      ctx.fillStyle = p.color;
      if (p.type === 'crystal' || p.type === 'scale' || p.type === 'silk') {
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * (p.type === 'silk' ? 0.35 : 1));
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * k), 0, 6.284); ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawTexts() {
    for (const t of texts) {
      const k = 1 - t.age / t.life;
      ctx.save();
      ctx.globalAlpha = clamp(k * 1.6, 0, 1);
      ctx.textAlign = 'center';
      if (t.str) {
        ctx.font = '700 20px system-ui, sans-serif';
        ctx.fillStyle = t.color || '#ffffff';
        ctx.fillText(t.str, t.x, t.y);
      } else {
        const big = t.kind === 'weak' || t.kind === 'crit';
        const col = big ? '#ffd75e' : t.kind === 'resist' ? '#8fa2bd'
                  : t.kind === 'player' ? '#ff6a6a' : '#ffffff';
        ctx.font = '800 ' + (big ? 26 : 20) + 'px system-ui, sans-serif';
        ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 4;
        ctx.strokeText(t.v, t.x, t.y);
        ctx.fillStyle = col;
        ctx.fillText(t.v, t.x, t.y);
      }
      ctx.restore();
    }
  }

  function drawFlash() {
    if (flash <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = clamp(flash, 0, 0.6);
    ctx.fillStyle = flashColor;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  return {
    reset, update, particle, burst, plume, shoot, updateProjectiles,
    projectilesOf, removeProjectile, wave, addHazard, hazardsOf, tell,
    damageText, label, addShake, addHitStop, addFlash,
    drawTelegraphs, drawWaves, drawHazards, drawProjectiles, drawParticles,
    drawTexts, drawFlash, shakeOffset,
    get hitStop() { return hitStop; },
    get parts() { return parts; },
  };
})();
