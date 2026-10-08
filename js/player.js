/* =========================================================
   player.js — ゴジラの操作
   Reads Input actions and drives the player fighter through the
   Fighter state machine. Also owns radiation energy, the three
   atomic breath tiers and the between-level upgrades.

     left / right      walk
     up               jump
     J                punch
     K                kick (aerial kick in the air)
     K + guard        踏みつけ stomp (ground pound)
     Space / L        放射熱線 -> レッド熱線 -> 放射火炎
     Q                全身放射熱線 nuclear pulse (unlocked after L4)
     S / down         guard (hold)
   ========================================================= */
'use strict';

const Player = (() => {
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  /* upgrade multipliers, reset for every run */
  function stats() {
    return { hpMul: 1, regenMul: 1, beamMul: 1, meleeMul: 1, costMul: 1,
             guardCut: PLAYER.guardCut, healNow: 0, cleared: 0, burning: false };
  }

  function create(st) {
    const def = {
      id: 'godzilla', ja: PLAYER.ja, element: 'radiation', art: 'godzilla',
      attacks: [], palette: null, ai: {},
      hp: Math.round(PLAYER.hp * st.hpMul), speed: PLAYER.walk,
      w: PLAYER.w, h: PLAYER.h, staggerMax: PLAYER.staggerMax,
    };
    const f = Fighter.create(def, 260, { kind: 'player', facing: 1 });
    f.maxHp = f.hp;
    f.energy = PLAYER.energy;
    f.maxEnergy = PLAYER.energy;
    f.st = st;
    f.buffer = null;
    f.bufferT = 0;
    f.combo = 0;
    f.time = 0;
    f.lastAttackEnd = -99;
    f.lastHitBy = null;
    return f;
  }

  /* which atomic breath tier: 1 base, 2 after level 4, 3 after level 7 */
  function tier(f) {
    const c = f.st.cleared;
    return c >= 7 ? 3 : c >= 4 ? 2 : 1;
  }

  function pulseUnlocked(f) { return f.st.cleared >= 4; }

  /* the beam attack for the current tier, with the tier's damage and colour */
  function beamAttack(f) {
    const t = tier(f);
    const info = PLAYER.beamTiers[t - 1];
    const base = t === 3 ? PLAYER.kit.fireray : PLAYER.kit.beam;
    return Object.assign({}, base, {
      id: 'beam' + t,
      ja: info.name,
      element: info.element,
      dmg: base.dmg * info.dmgMul,
      tierColor: info.color,
      tier: t,
    });
  }

  /* the aerial variant of the kick */
  const AIR_KICK = Object.assign({}, PLAYER.kit.kick,
    { id: 'airkick', ja:'空中キック', boxY: -96, boxH: 96, knock: 260 });

  function canAct(f) {
    const s = f.state.name;
    return s === 'idle' || s === 'walk' || s === 'guard' ||
           (s === 'attack' && Fighter.stageOf(f) === 'recover' && f.combo < 2);
  }

  function queue(f, atk) { f.buffer = atk; f.bufferT = 0.22; }

  function tryStart(f, atk) {
    if (atk.cost) {
      const cost = atk.cost * f.st.costMul;
      if (f.energy < cost) {
        FX.label(f.x, f.y - f.h * 1.1, 'エネルギー不足', '#8fb8ff');
        Audio.SFX.warn();
        return false;
      }
      f.energy -= atk.cost * f.st.costMul;
    }
    const scaled = Object.assign({}, atk);
    if (atk.element === 'radiation' || atk.element === 'fire') scaled.dmg = atk.dmg * f.st.beamMul;
    else if (atk.element === 'melee' || !atk.element) scaled.dmg = atk.dmg * f.st.meleeMul;
    /* the burning form trades HP for raw power on everything */
    if (f.st.burning) scaled.dmg *= PLAYER.burn.dmgMul;
    Fighter.startAttack(f, scaled);
    f.combo = (f.time - f.lastAttackEnd < 0.5) ? f.combo + 1 : 0;
    f.lastAttackEnd = f.time + scaled.windup + scaled.active + scaled.recover;
    const s = scaled.id;
    if (s === 'punch') Audio.SFX.punch();
    else if (s === 'kick' || s === 'airkick') Audio.SFX.kick();
    else if (s === 'stomp') Audio.SFX.stomp();
    else if (s === 'pulse') Audio.SFX.pulse();
    else if (scaled.tier === 2) Audio.SFX.redray();
    else if (scaled.tier === 3) Audio.SFX.fireray();
    else if (s === 'beam1') Audio.SFX.beam();
    return true;
  }

  function update(f, inp, dt, hooks) {
    const st = f.st;
    f.time += dt;
    f.energy = clamp(f.energy + PLAYER.energyRegen * st.regenMul * dt, 0, f.maxEnergy);
    if (f.bufferT > 0) { f.bufferT -= dt; if (f.bufferT <= 0) f.buffer = null; }

    if (f.state.name === 'ko') { Fighter.update(f, dt, 0); return; }

    /* face the boss unless we are mid-attack */
    if (hooks.target && f.state.name !== 'attack')
      f.facing = hooks.target.x >= f.x ? 1 : -1;

    /* burning form: Godzilla's own melt-down in the final level */
    if (st.burning) {
      f.def.art = 'burningGodzilla';
      f.art = 'burningGodzilla';
      f.burnT = (f.burnT || 0) + dt;
      if (f.burnT > 1.2) {
        f.burnT = 0;
        FX.burst('ember', f.x + (Math.random() - 0.5) * f.w, f.y - Math.random() * f.h, 3,
                 { speed: 90, grav: -40 });
      }
    }

    const left = inp.held('left'), right = inp.held('right'), guard = inp.held('guard');
    let move = 0;
    if (left && !right) move = -1;
    if (right && !left) move = 1;

    if (canAct(f)) {
      /* attacks first, then guard, then walking */
      if (f.buffer) { const b = f.buffer; f.buffer = null; tryStart(f, b); }
      else if (inp.pressed('beam')) tryStart(f, beamAttack(f));
      else if (inp.pressed('pulse') && pulseUnlocked(f)) tryStart(f, PLAYER.kit.pulse);
      else if (inp.pressed('pulse') && !pulseUnlocked(f))
        FX.label(f.x, f.y - f.h * 1.1, '未習得', '#8fb8ff');
      else if (inp.pressed('kick')) {
        if (!f.onGround) tryStart(f, AIR_KICK);
        else if (guard) tryStart(f, PLAYER.kit.stomp);
        else tryStart(f, PLAYER.kit.kick);
      }
      else if (inp.pressed('punch')) tryStart(f, PLAYER.kit.punch);
      else if (inp.pressed('jump') && f.onGround) {
        f.vy = -PLAYER.jump;
        f.onGround = false;
        Audio.SFX.jump();
        FX.burst('dust', f.x, f.y, 8, { speed: 140, base: -Math.PI / 2, spread: 1.6 });
      }

      if (f.state.name !== 'attack') {
        if (guard && f.onGround) Fighter.setState(f, 'guard');
        else if (f.state.name === 'guard') Fighter.setState(f, 'idle');
      }
    } else if (f.state.name === 'attack' && Fighter.stageOf(f) === 'windup') {
      /* buffer the next move during the windup so combos feel responsive */
      if (inp.pressed('punch')) queue(f, PLAYER.kit.punch);
      if (inp.pressed('kick')) queue(f, f.onGround ? PLAYER.kit.kick : AIR_KICK);
      if (inp.pressed('beam')) queue(f, beamAttack(f));
    }

    /* Burning Godzilla hits harder but burns his own HP away. */
    if (st.burning && !f.dead) {
      f.hp = Math.max(1, f.hp - PLAYER.burn.drain * dt);
    }

    Fighter.update(f, dt, move);
  }

  /* apply an upgrade card picked between levels */
  function upgrade(f, up) {
    up.apply(f.st);
    if (f.st.healNow) {
      /* the card actually restores HP; the amount is returned for the
         floating number, capped at what the bar can still take */
      const amount = Math.min(f.maxHp - f.hp, Math.round(f.maxHp * f.st.healNow));
      f.st.healNow = 0;
      f.hp += amount;
      return amount;
    }
    if (up.id === 'hp') {
      const before = f.maxHp;
      f.maxHp = Math.round(PLAYER.hp * f.st.hpMul);
      f.hp += f.maxHp - before;
    }
    return 0;
  }

  return { create, stats, update, upgrade, tier, pulseUnlocked, beamAttack };
})();
