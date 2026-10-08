/* =========================================================
   ui.js — HUD と画面
   Everything drawn on top of the arena: the two health bars,
   the radiation gauge, the level pips, the title screen, the
   level intro card, the upgrade choice, and the result screens.
   Menus are driven by the same abstract actions as the fight.
   ========================================================= */
'use strict';

const UI = (() => {
  const FONT = '"Hiragino Sans","Yu Gothic","Noto Sans JP",system-ui,sans-serif';
  const MONO = 'ui-monospace,"SFMono-Regular",Menlo,monospace';

  function font(px, weight, mono) {
    ctx.font = (weight ? weight + ' ' : '') + px + 'px ' + (mono ? MONO : FONT);
  }
  /* fight clock, mm:ss */
  function clock(t) {
    const s = Math.max(0, Math.floor(t));
    const p = n => (n < 10 ? '0' : '') + n;
    return p(Math.floor(s / 60)) + ':' + p(s % 60);
  }
  function text(str, x, y, px, color, align, weight, mono) {
    font(px, weight, mono);
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillText(str, x + 1.5, y + 1.5);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }
  function rrect(x, y, w, h, r, fill, stroke, lw) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
    ctx.restore();
  }
  function bar(x, y, w, h, k, fill, back, edge) {
    rrect(x, y, w, h, h / 2, back || 'rgba(0,0,0,.55)');
    const bw = Math.max(0, Math.min(1, k)) * (w - 2);
    if (bw > 1) {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, fill);
      g.addColorStop(1, Rig.shade(fill, -0.28));
      ctx.fillStyle = g;
      ctx.fillRect(x + 1, y + 1, bw, h - 2);
    }
    if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1); }
  }
  function scrim(a) {
    ctx.fillStyle = 'rgba(6,8,14,' + a + ')';
    ctx.fillRect(0, 0, W, H);
  }
  function panel(x, y, w, h, a) {
    rrect(x, y, w, h, 14, 'rgba(10,14,22,' + (a === undefined ? 0.82 : a) + ')',
          'rgba(255,255,255,.14)', 1);
  }

  /* ---------------- HUD ---------------- */
  function drawHud(g) {
    const p = g.player, b = g.boss, st = g.diff;
    /* player */
    bar(24, 22, 300, 16, p.hp / p.maxHp, '#6ad06a', 'rgba(0,0,0,.6)', 'rgba(255,255,255,.22)');
    text(PLAYER.ja, 24, 56, 15, '#e8f0e8', 'left', '600');
    text(Math.ceil(p.hp) + ' / ' + p.maxHp, 324, 35, 12, '#c8d8c8', 'right', '500', true);
    /* radiation energy */
    const tier = Player.tier(p);
    const tierInfo = PLAYER.beamTiers[tier - 1];
    bar(24, 62, 220, 9, p.energy / p.maxEnergy, tierInfo.color, 'rgba(0,0,0,.55)');
    text('放射エネルギー', 24, 88, 11, '#9ab0c8');
    text(tierInfo.name, 252, 70, 12, tierInfo.color, 'left', '600');
    if (Player.pulseUnlocked(p))
      text('Q 全身放射熱線', 252, 88, 11, '#8fb8d8');

    /* boss */
    const bw = 380;
    bar(W - 24 - bw, 22, bw, 14, b.hp / b.maxHp, '#e0524a', 'rgba(0,0,0,.6)', 'rgba(255,255,255,.22)');
    text(b.def.ja, W - 24, 54, 19, '#ffe8e0', 'right', '700');
    text(b.def.en + '  ・  ' + b.def.subtitle, W - 24, 74, 12, '#c8a8a0', 'right');
    text(b.def.film, W - 24, 92, 11, '#8a7a76', 'right', '400');
    /* phase pips: one per phase, lit once the kaiju has entered it */
    b.def.phases.forEach((_, i) => {
      const x = W - 24 - bw + 8 + i * 15;
      ctx.fillStyle = i < b.phaseIndex ? '#e0524a' : 'rgba(255,255,255,.18)';
      ctx.beginPath(); ctx.arc(x, 42, 3.5, 0, 6.284); ctx.fill();
    });
    if (b.def.weakness)
      text('弱点: ' + b.def.weakness.text, W - 24, 112, 11, '#ffd88a', 'right');

    /* level pips */
    for (let i = 0; i < 10; i++) {
      const x = W / 2 - 10 * 11 / 2 + i * 11, done = i < g.levelIndex;
      ctx.fillStyle = i === g.levelIndex ? '#ffd75e' : done ? 'rgba(255,215,94,.45)' : 'rgba(255,255,255,.16)';
      ctx.beginPath(); ctx.arc(x, 26, i === g.levelIndex ? 5 : 3.5, 0, 6.284); ctx.fill();
    }
    text('STAGE ' + (g.levelIndex + 1) + ' / 10', W / 2, 48, 11, '#c8b878', 'center', '600', true);
    text(st.name, W / 2, 64, 10, '#8a8a96', 'center');
    text(clock(g.levelTime), W / 2, 82, 12, '#9ab0c8', 'center', '600', true);

    /* combo counter */
    if (p.combo > 1 && p.state.name === 'attack')
      text(p.combo + ' HIT', 24, 120, 20 + p.combo, '#ffe060', 'left', '700');
  }

  /* ---------------- title ---------------- */
  function drawTitle(g) {
    scrim(0.55);
    ctx.save();
    ctx.textAlign = 'center';
    const pulse = 1 + Math.sin(g.time * 2) * 0.02;
    ctx.save();
    ctx.translate(W / 2, 170); ctx.scale(pulse, pulse);
    text('ゴジラ', 0, 0, 76, '#e8f2ff', 'center', '700');
    text('怪獣大決戦', 0, 58, 34, '#ffd75e', 'center', '700');
    ctx.restore();
    text('GODZILLA — TEN BATTLES', W / 2, 214, 13, '#8fa8c8', 'center', '600', true);
    text('全10ステージ。歴代怪獣との決戦。', W / 2, 262, 15, '#cfe0f0', 'center');

    /* difficulty selector */
    const keys = ['easy', 'normal', 'hard'];
    text('難易度', W / 2, 306, 12, '#8a9ab0', 'center');
    keys.forEach((k, i) => {
      const x = W / 2 + (i - 1) * 130, sel = g.diffKey === k;
      rrect(x - 58, 318, 116, 34, 8, sel ? 'rgba(255,215,94,.18)' : 'rgba(255,255,255,.05)',
            sel ? '#ffd75e' : 'rgba(255,255,255,.18)', sel ? 2 : 1);
      text(DIFFICULTY[k].name, x, 340, sel ? 16 : 14, sel ? '#ffe89a' : '#9aa8b8', 'center',
           sel ? '700' : '500');
    });
    text('← → で選択', W / 2, 372, 11, '#7a8a9a', 'center');

    /* a run left in localStorage resumes at the battle it stopped on */
    if (g.save) {
      rrect(W / 2 - 215, 382, 430, 30, 8, 'rgba(255,215,94,.10)', 'rgba(255,215,94,.5)', 1);
      text('つづきから STAGE ' + (g.save.levelIndex + 1) + ' : ENTER      まっさらから : R',
           W / 2, 402, 12, '#ffe89a', 'center', '600');
    }

    /* kaiju roster strip */
    MONSTERS.forEach((m, i) => {
      const x = 40 + i * ((W - 80) / 10);
      ctx.fillStyle = 'rgba(255,255,255,.10)';
      ctx.beginPath(); ctx.arc(x, 424, 4, 0, 6.284); ctx.fill();
      text(String(m.n), x, 448, 13, '#c8b878', 'center', '700', true);
      text(m.ja, x, 466, 11, '#9ab0c8', 'center');
    });

    const blink = 0.55 + 0.45 * Math.sin(g.time * 4);
    ctx.globalAlpha = blink;
    text('ENTER / スタート', W / 2, 512, 17, '#ffffff', 'center', '700');
    ctx.globalAlpha = 1;
    text('←→ 移動  ↑ ジャンプ  J パンチ  K キック  Space 放射熱線  Q 全身放射熱線  ↓ ガード',
         W / 2, 546, 11, '#7f8fa0', 'center');
    ctx.restore();
  }

  /* ---------------- level intro card ---------------- */
  function drawIntro(g) {
    const m = g.boss.def;
    const k = Math.min(1, g.introT / 0.35);
    const out = g.introT > 2.2 ? Math.min(1, (g.introT - 2.2) / 0.4) : 0;
    ctx.save();
    ctx.globalAlpha = 1 - out;
    scrim(0.62 * (1 - out));
    const x = 90 + (1 - k) * -120, y = 150;
    panel(x, y, W - 180, 250, 0.86);
    text('STAGE ' + m.n, x + 28, y + 52, 15, '#ffd75e', 'left', '700', true);
    text(m.ja, x + 28, y + 108, 46, '#ffffff', 'left', '700');
    text(m.en + '  ・  ' + m.subtitle, x + 28, y + 136, 15, '#c8a8a0', 'left');
    text(m.film, x + 28, y + 160, 12, '#8a9ab0', 'left');
    text('全高 ' + m.height + '   体重 ' + m.weight +
         '   脅威度 ' + '★'.repeat(m.threat) + '☆'.repeat(5 - m.threat),
         x + 28, y + 186, 12, '#9ab0c8', 'left');
    const el = ELEMENTS[m.element];
    ctx.fillStyle = el.color;
    ctx.fillRect(x + 28, y + 202, 8, 8);
    text((el.ja + ' 属性'), x + 44, y + 210, 12, el.color, 'left', '600');
    text('弱点: ' + m.weakness.text, x + 28, y + 234, 13, '#ffd88a', 'left');
    text(m.weakness.en, x + 28, y + 254, 11, '#a8b8c8', 'left');
    const blink = 0.5 + 0.5 * Math.sin(g.time * 5);
    ctx.globalAlpha = (1 - out) * blink;
    text('ENTER で開始', W - 110, y + 234, 14, '#ffffff', 'right', '700');
    ctx.restore();
  }

  /* ---------------- upgrade choice ---------------- */
  function drawUpgrade(g) {
    scrim(0.7);
    text('次の戦いへの準備', W / 2, 96, 26, '#ffd75e', 'center', '700');
    text('強化を1つ選択', W / 2, 124, 13, '#9ab0c8', 'center');
    const cards = g.upgrades, n = cards.length;
    const cw = 240, gap = 24;
    const total = n * cw + (n - 1) * gap;
    cards.forEach((c, i) => {
      const x = W / 2 - total / 2 + i * (cw + gap), y = 180;
      const sel = g.upgradeIndex === i;
      rrect(x, y, cw, 170, 12, sel ? 'rgba(255,215,94,.14)' : 'rgba(255,255,255,.05)',
            sel ? '#ffd75e' : 'rgba(255,255,255,.16)', sel ? 2 : 1);
      text(c.ja, x + cw / 2, y + 74, 17, sel ? '#ffffff' : '#b8c8d8', 'center', '700');
      text(c.en, x + cw / 2, y + 100, 12, '#8a9ab0', 'center');
      if (sel) text('決定: ENTER / J', x + cw / 2, y + 142, 11, '#ffd75e', 'center', '600');
    });
    text('← → で選択   ENTER で決定', W / 2, 400, 12, '#7f8fa0', 'center');
    text(PLAYER.ja + '  体力 ' + Math.ceil(g.player.hp) + ' / ' + g.player.maxHp +
         '   放射エネルギー ' + Math.round(g.player.energy),
         W / 2, 440, 12, '#9ab0c8', 'center', '400', true);
  }

  /* ---------------- result ---------------- */
  function drawResult(g) {
    scrim(0.66);
    if (g.result === 'win') {
      text('勝利', W / 2, 190, 64, '#ffd75e', 'center', '700');
      text(g.boss.def.ja + ' 撃破', W / 2, 236, 20, '#e8f0f8', 'center', '600');
      text('残り体力 ' + Math.ceil(g.player.hp) + ' / ' + g.player.maxHp +
           '   被弾 ' + g.hitsTaken + '   時間 ' + Math.floor(g.levelTime) + '秒',
           W / 2, 276, 13, '#9ab0c8', 'center', '400', true);
      const blink = 0.5 + 0.5 * Math.sin(g.time * 5);
      ctx.globalAlpha = blink;
      text(g.levelIndex < 9 ? 'ENTER で次の戦い' : 'ENTER で結末へ', W / 2, 350, 16, '#ffffff',
           'center', '700');
      ctx.globalAlpha = 1;
    } else {
      text('ゴジラ死す', W / 2, 190, 58, '#ff6a5a', 'center', '700');
      text('THE END', W / 2, 232, 15, '#c8a8a0', 'center', '600', true);
      text(g.boss.def.ja + ' に敗れた', W / 2, 268, 16, '#e8d8d0', 'center');
      const blink = 0.5 + 0.5 * Math.sin(g.time * 5);
      ctx.globalAlpha = blink;
      text('R でこのステージから  /  ESC でタイトルへ', W / 2, 350, 15, '#ffffff', 'center', '700');
      ctx.globalAlpha = 1;
    }
  }

  /* ---------------- ending ---------------- */
  function drawEnding(g) {
    scrim(0.78);
    text('地球の平和', W / 2, 150, 40, '#ffd75e', 'center', '700');
    text('十体の怪獣を退けたゴジラは海に去った。', W / 2, 206, 17, '#cfe0f0', 'center');
    const lines = g.runSummary || [];
    lines.forEach((l, i) => {
      text(l, W / 2, 260 + i * 22, 12, '#9ab0c8', 'center', '400', true);
    });
    text('全記録: 難易度 ' + g.diff.name + '   被弾 ' + g.hitsTaken,
         W / 2, 500, 12, '#8a9ab0', 'center', '400', true);
    const blink = 0.5 + 0.5 * Math.sin(g.time * 4);
    ctx.globalAlpha = blink;
    text('ENTER でタイトルへ', W / 2, 540, 15, '#ffffff', 'center', '700');
    ctx.globalAlpha = 1;
  }

  /* ---------------- small overlays ---------------- */
  function drawPhaseBanner(g) {
    if (!g.banner || g.bannerT <= 0) return;
    const k = Math.min(1, g.bannerT / 0.4);
    ctx.save();
    ctx.globalAlpha = Math.min(1, g.bannerT * 2);
    rrect(W / 2 - 170, 150, 340, 54, 10, 'rgba(20,10,14,.8)', '#ffd75e', 2);
    text(g.banner, W / 2, 184, 22, '#ffe89a', 'center', '700');
    ctx.restore();
  }

  function drawPause() {
    scrim(0.6);
    text('一時停止', W / 2, 260, 40, '#ffffff', 'center', '700');
    text('ESC で再開  /  R でやり直し', W / 2, 310, 14, '#9ab0c8', 'center');
  }

  function drawTouchHint() {
    if (!('ontouchstart' in window)) return;
    text('タッチ操作: 左下 移動 / 右下 攻撃', W / 2, H - 8, 10, 'rgba(200,215,230,.45)', 'center');
  }

  return {
    drawHud, drawTitle, drawIntro, drawUpgrade, drawResult, drawEnding,
    drawPhaseBanner, drawPause, drawTouchHint,
    panel, bar, text, rrect, scrim, font,
  };
})();
