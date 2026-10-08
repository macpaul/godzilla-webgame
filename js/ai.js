/* =========================================================
   ai.js — ボスの思考
   Each boss reads its own ai block from data.js:
     aggression   0..1  how eagerly it closes and attacks
     preferRange        the distance it tries to hold
     dodge              chance to react to the player's windup
     flank              chance to leap around the player
     stationary         never walks (Biollante)
   Attacks are chosen from the boss's move list, gated by the
   attack's own minRange/maxRange, cooldown and weight.
   ========================================================= */
'use strict';

const AI = (() => {
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rnd = (a, b) => a + Math.random() * (b - a);

  function create(f) {
    f.cd = {};                       /* attack id -> seconds left */
    f.ai = {
      think: 0,                      /* seconds until the next decision */
      move: 0,                       /* -1 back, 0 hold, 1 forward */
      wantJump: false,
      hoverPhase: Math.random() * 6,
      react: 0,                      /* cooldown on dodging */
      mode: 'fight',
      modeT: 0,
      taunt: 0,
    };
  }

  /* distance between the two bodies, always positive */
  function gap(f, p) { return Math.abs(p.x - f.x); }

  /* is the player currently winding something up we should respect? */
  function playerWindup(p) {
    if (p.state.name !== 'attack' || !p.state.atk) return null;
    const a = p.state.atk;
    if (p.state.t >= a.windup) return null;
    return a;
  }

  /* pick the best attack for the current range */
  function choose(f, dist) {
    const list = (f.moves || f.def.attacks).filter(a => {
      if ((f.cd[a.id] || 0) > 0) return false;
      if (dist < a.minRange || dist > a.maxRange) return false;
      if (f.rooted && a.tags && a.tags.indexOf('air') >= 0) return false;
      return true;
    });
    if (!list.length) return null;
    /* weight the telegraphed-but-strong moves a little higher when close */
    let total = 0;
    const w = list.map(a => {
      let k = (a.weight || 1) * (a.kind === 'grab' ? (dist < 200 ? 1.6 : 0.4) : 1);
      if (a.kind === 'melee' && dist < 160) k *= 1.4;
      if ((a.kind === 'beam' || a.kind === 'proj') && dist > 380) k *= 1.4;
      if (a.kind === 'aura' && dist < 300) k *= 1.2;
      total += k;
      return k;
    });
    let r = Math.random() * total;
    for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
    return list[list.length - 1];
  }

  /* react to the player's windup: backstep, jump, or eat it */
  function react(f, p, dist, dt) {
    const a = f.ai;
    if (a.react > 0) { a.react -= dt; return; }
    const pa = playerWindup(p);
    if (!pa) return;
    const cfg = f.def.ai;
    const incoming = (pa.reach || pa.area && pa.area.r || 0) + 40;
    if (dist > incoming + 120) return;
    if (Math.random() > cfg.dodge) return;
    a.react = rnd(0.7, 1.6);
    if (pa.kind === 'beam' || pa.kind === 'proj') {
      /* jump the beam line, or step out of it */
      if (Math.random() < 0.55 && !f.rooted) a.wantJump = true;
      else a.move = -1;
    } else if (Math.random() < 0.5 && !f.rooted) {
      a.move = -1;
      a.think = Math.max(a.think, 0.30);
    } else if (!f.rooted && f.def.ai.flank > Math.random()) {
      a.wantJump = true;
      a.move = 1;
    }
  }

  /* hold the preferred stand-off distance */
  function position(f, p, dist, dt) {
    const cfg = f.def.ai, a = f.ai;
    if (f.rooted) { a.move = 0; return; }
    const want = cfg.preferRange * (f.airborne ? 1.25 : 1);
    const band = 60 + 90 * (1 - cfg.aggression);
    if (dist > want + band) a.move = 1;
    else if (dist < want - band) a.move = -1;
    else if (Math.random() < 0.02) a.move = Math.random() < 0.5 ? -1 : 1;
    else a.move = 0;

    /* flying bosses drift up and down so the beam line keeps moving */
    if (f.airborne) {
      a.hoverPhase += dt * 1.4;
      f.hoverY = Math.sin(a.hoverPhase) * 0.16;
    }
    /* occasionally change the whole approach: charge in or hang back */
    a.modeT -= dt;
    if (a.modeT <= 0) {
      a.modeT = rnd(2.2, 5.0);
      a.mode = Math.random() < cfg.aggression ? 'press' : 'spacing';
    }
    if (a.mode === 'press' && dist > 120) a.move = 1;
    if (a.mode === 'spacing' && dist < want * 0.7) a.move = -1;
  }

  /* main tick */
  function update(f, p, dt, hooks) {
    const a = f.ai;
    for (const k in f.cd) if (f.cd[k] > 0) f.cd[k] -= dt;

    if (f.state.name === 'ko' || f.state.name === 'hurt' ||
        f.state.name === 'stagger' || f.state.name === 'attack' ||
        f.state.name === 'grabbed') {
      a.move = 0;
      return;
    }

    const dist = gap(f, p);
    a.think -= dt;

    if (a.think <= 0) {
      a.think = rnd(0.16, 0.42) * (1.4 - f.def.ai.aggression);
      react(f, p, dist, dt);
      position(f, p, dist, dt);

      const atk = choose(f, dist);
      if (atk && Math.random() < 0.35 + f.def.ai.aggression * 0.6) {
        f.cd[atk.id] = (atk.cooldown || 3) * (f.cooldownMul || 1) * rnd(0.85, 1.3);
        hooks.attack(f, atk);
        a.think += (atk.windup + atk.active + atk.recover) * 0.6;
        a.move = 0;
      }
    }

    if (a.wantJump && f.onGround && !f.rooted) {
      a.wantJump = false;
      hooks.jump(f);
    }
    a.move = clamp(a.move, -1, 1);
  }

  /* called by game.js when a phase changes: forget the old move set */
  function refresh(f) {
    f.cd = {};
    f.ai.think = rnd(0.4, 1.0);
    f.ai.modeT = 0;
  }

  return { create, update, refresh, gap };
})();
