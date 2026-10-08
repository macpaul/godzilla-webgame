/* =========================================================
   fighter.js — 共通の体・状態・当たり判定
   Both the player and the ten bosses are fighters: a body box,
   a small state machine, gravity, stagger and hitboxes derived
   from the attack definition in data.js.
   State names: idle walk attack hurt stagger guard dash grab ko
   ========================================================= */
'use strict';

const Fighter = (() => {
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  function create(def, x, opt) {
    opt = opt || {};
    const f = {
      def,
      kind: opt.kind || 'boss',
      pal: def.palette || { skin: '#4a5a6a', skin2: '#39485a', belly: '#8a9aa8',
                            fin: '#cfe6ef', eye: '#d8b020', glow: '#7fd8ff' },
      art: def.art,
      x, y: GROUND, vx: 0, vy: 0,
      w: def.w, h: def.h,
      facing: opt.facing || -1,
      hp: def.hp, maxHp: def.hp,
      stagger: 0, staggerMax: def.staggerMax || 120,
      speed: def.speed,
      state: { name: 'idle', t: 0, dur: 0, atk: null },
      moves: def.attacks.slice(),
      cd: {},
      airborne: !!def.airborne,
      rooted: !!def.rooted,
      onGround: true,
      hoverY: 0,
      shield: false,
      invuln: 0,
      hitMarks: {},          /* per-attack already-hit flags */
      flash: 0,
      dead: false,
    };
    AI.create(f);
    return f;
  }

  function setState(f, name, dur, extra) {
    if (f.state.name === name && extra && extra.keepTimer) { f.state.t += 0; return; }
    f.state = Object.assign({ name, t: 0, dur: dur || 0, atk: null }, extra || {});
  }

  /* feet position; airborne bodies hover above the ground line */
  function floorFor(f) {
    return f.airborne ? GROUND - f.hoverY - f.h * 0.05 : GROUND;
  }

  function update(f, dt, moveDir) {
    const s = f.state;
    s.t += dt;
    if (f.invuln > 0) f.invuln -= dt;
    if (f.flash > 0) f.flash -= dt;

    const locked = s.name === 'attack' || s.name === 'grab' || s.name === 'ko';

    /* horizontal motion */
    if (!f.rooted && !locked) {
      const sp = f.speed * (f.speedMul || 1);
      if (s.name === 'hurt' || s.name === 'stagger') {
        f.vx *= Math.pow(0.02, dt);
      } else if (s.name === 'dash') {
        /* dash speed comes from the attack */
      } else if (moveDir) {
        f.vx = moveDir * sp * (s.name === 'guard' ? 0.45 : 1);
        if (f.onGround && s.name !== 'guard') setState(f, 'walk');
      } else if (f.onGround) {
        f.vx *= Math.pow(0.0005, dt);
        if (Math.abs(f.vx) < 6) f.vx = 0;
        if (s.name === 'walk') setState(f, 'idle');
      } else {
        /* air control */
        if (moveDir) f.vx += moveDir * sp * 2.2 * dt;
        f.vx = clamp(f.vx, -sp * 1.4, sp * 1.4);
      }
    } else if (locked && f.onGround && s.name !== 'attack') {
      f.vx *= Math.pow(0.0002, dt);
    }
    if (s.name === 'attack' && s.atk && s.atk.kind === 'dash' &&
        s.t >= s.atk.windup && s.t < s.atk.windup + s.atk.active)
      f.vx = f.facing * s.atk.speed;

    f.x += f.vx * dt;

    /* vertical motion */
    if (f.airborne) {
      f.y = floorFor(f);
      f.vy = 0;
      f.onGround = true;
    } else {
      if (!f.onGround) f.vy += GRAV * dt;
      f.y += f.vy * dt;
      if (f.y >= GROUND) {
        const impact = f.vy;
        f.y = GROUND; f.vy = 0;
        if (!f.onGround) {
          f.onGround = true;
          setState(f, 'idle');
          if (impact > 700) Audio.SFX.land();
        }
      } else f.onGround = false;
    }
    f.x = clamp(f.x, 60, W - 60);

    /* timed states fall out on their own */
    if (s.dur && s.t >= s.dur) {
      if (s.name === 'hurt' || s.name === 'stagger' || s.name === 'dash')
        setState(f, 'idle');
    }
    if (s.name === 'attack' && s.atk && s.t >= s.atk.windup + s.atk.active + s.atk.recover)
      setState(f, 'idle');
  }

  /* ---- attacking ---- */
  function startAttack(f, atk) {
    setState(f, 'attack', atk.windup + atk.active + atk.recover, { atk });
    f.hitMarks = {};
    f.vx = f.onGround ? 0 : f.vx;
    if (atk.kind === 'dash') f.vx = f.facing * atk.speed;
    const tel = atk.telegraph;
    if (tel && tel !== 'none') {
      const el = ELEMENTS[atk.element || f.def.element];
      const c = el ? el.color : '#ffd75e';
      if (tel === 'line') {
        const y = f.y + (atk.beam ? atk.beam.yOff : atk.boxY || -f.h * 0.5);
        const len = atk.beam ? atk.beam.len : (atk.reach || 260) + 120;
        FX.tell('line', { x: f.x, y }, { x: f.x + f.facing * len, y }, atk.windup * 0.9, c);
      } else if (tel === 'ring') {
        const r = atk.area ? atk.area.r : atk.reach || 200;
        FX.tell('ring', { x: f.x, y: f.y, r }, null, atk.windup * 0.9, c);
      } else {
        FX.tell('flash', { x: f.x, y: f.y - f.h * 0.55, r: f.h * 0.5 }, null,
                atk.windup * 0.75, c);
      }
    }
    if (atk.kind === 'beam' || atk.id === 'roar' || atk.id === 'split')
      Audio.SFX.roarOf(f.kind === 'player' ? 'godzilla' : f.def.id);
  }

  /* which stage of the current attack are we in? */
  function stageOf(f) {
    const s = f.state, a = s.atk;
    if (s.name !== 'attack' || !a) return null;
    if (s.t < a.windup) return 'windup';
    if (s.t < a.windup + a.active) return 'active';
    return 'recover';
  }

  /* body box (the thing a melee attack can connect with) */
  function bodyBox(f) {
    const lean = f.state.name === 'attack' ? 0.10 : 0;
    return {
      x: f.x - f.w * 0.5 - lean * f.h * 0.2,
      y: f.y - f.h * (0.96 + lean * 0.05),
      w: f.w * (1 + lean * 0.18),
      h: f.h * (0.96 + lean * 0.05),
    };
  }

  /* the damage shape the attack currently produces, or null */
  function hitbox(f) {
    const s = f.state, a = s.atk;
    if (stageOf(f) !== 'active' || !a) return null;
    const dir = f.facing;
    if (a.kind === 'melee' || a.kind === 'grab') {
      const reach = a.reach || 120;
      const x0 = f.x + (dir > 0 ? f.w * 0.35 : -f.w * 0.35 - reach);
      return { kind: 'box', x: x0, y: f.y + (a.boxY || -f.h * 0.55),
               w: reach, h: a.boxH || f.h * 0.4 };
    }
    if (a.kind === 'beam') {
      const b = a.beam, x0 = dir > 0 ? f.x + f.w * 0.3 : f.x - f.w * 0.3 - b.len;
      return { kind: 'beam', x: x0, y: f.y + b.yOff - b.h * 0.5, w: b.len, h: b.h, atk: a };
    }
    if (a.kind === 'quake' || a.kind === 'aura' || a.kind === 'special') {
      const r = a.area ? a.area.r : 180;
      return { kind: 'area', cx: f.x, cy: f.y - f.h * 0.35, r };
    }
    if (a.kind === 'dash')
      return { kind: 'box', x: f.x - f.w * 0.6, y: f.y - f.h * 0.9, w: f.w * 1.2, h: f.h * 0.9 };
    if (a.kind === 'channel') {
      const reach = a.channel ? a.channel.reach : 150;
      const x0 = dir > 0 ? f.x + f.w * 0.3 : f.x - f.w * 0.3 - reach;
      return { kind: 'box', x: x0, y: f.y - f.h * 0.7, w: reach, h: f.h * 0.55 };
    }
    return null;
  }

  /* has this attack already landed on the target? */
  function alreadyHit(f, key) { return !!f.hitMarks[key]; }
  function markHit(f, key) { f.hitMarks[key] = true; }

  function boxHits(box, target) {
    const t = bodyBox(target);
    return box.x < t.x + t.w && box.x + box.w > t.x && box.y < t.y + t.h && box.y + box.h > t.y;
  }

  function areaHits(area, target) {
    const t = bodyBox(target);
    const cx = clamp(area.cx, t.x, t.x + t.w), cy = clamp(area.cy, t.y, t.y + t.h);
    const dx = area.cx - cx, dy = area.cy - cy;
    return dx * dx + dy * dy <= area.r * area.r;
  }

  /* ---- taking a hit ---- */
  /* returns the damage actually applied */
  function hurt(f, dmg, opt) {
    opt = opt || {};
    if (f.dead || f.invuln > 0) return 0;
    if (f.shield && opt.element && opt.element !== 'melee') {
      FX.wave(f.x, f.y - f.h * 0.5, f.h * 0.55, '#bfe0ff', { life: 0.35, ring: true });
      FX.label(f.x, f.y - f.h * 1.05, 'シールド', '#bfe0ff');
      return 0;
    }
    const guarded = f.state.name === 'guard' && !opt.unguard;
    let d = dmg;
    /* guardCut is the fraction of the damage the guard removes: 0.75 cuts
       three quarters of it, as the design sheet and the HUD both promise. */
    if (guarded) d *= 1 - clamp(opt.guardCut == null ? 0.75 : opt.guardCut, 0, 0.95);
    if (opt.resist && opt.resist[opt.element]) d *= opt.resist[opt.element];
    d = Math.max(1, Math.round(d));
    f.hp = Math.max(0, f.hp - d);
    f.flash = 0.14;
    /* the impact itself: a guarded hit clicks, a heavy one thuds */
    if (d >= 6) {
      if (guarded) Audio.SFX.block();
      else if (d >= 45) Audio.SFX.bigHit();
      else Audio.SFX.hit();
    }

    const el = ELEMENTS[opt.element] ? ELEMENTS[opt.element].color : '#ffffff';
    FX.damageText(f.x + (Math.random() - 0.5) * 30, f.y - f.h * 0.95, d,
                  opt.weak ? 'weak' : opt.crit ? 'crit' : guarded ? 'guard' : 'normal');
    FX.burst(opt.element === 'radiation' || opt.element === 'fire' ? 'spark' : 'blood',
             f.x + (opt.from || 0), f.y - f.h * 0.6, guarded ? 6 : 14, { color: el });
    FX.addShake(guarded ? 3 : clamp(d * 0.35, 4, 22));
    FX.addHitStop(guarded ? 0.02 : clamp(d * 0.004, 0.04, 0.14));

    if (!guarded) {
      f.stagger += opt.stagger || 0;
      if (f.stagger >= f.staggerMax) {
        f.stagger = 0;
        setState(f, 'stagger', 1.5);
        FX.label(f.x, f.y - f.h * 1.15, '怯み!', '#ffe060');
      } else if (opt.knock && !opt.noHurt) {
        setState(f, 'hurt', 0.34);
        f.vx = (opt.dir || 1) * (opt.knock || 120);
        if (opt.knockUp) { f.vy = -opt.knockUp; f.onGround = false; }
      }
    } else {
      f.vx = (opt.dir || 1) * (opt.knock || 120) * 0.25;
    }

    if (f.hp <= 0) {
      f.dead = true;
      setState(f, 'ko', 99);
      f.vx = (opt.dir || 1) * 160;
      FX.addShake(30); FX.addFlash(0.5, '#ffffff');
    }
    return d;
  }

  return {
    create, setState, update, startAttack, stageOf, hitbox, bodyBox,
    boxHits, areaHits, alreadyHit, markHit, hurt, floorFor,
  };
})();
