/* =========================================================
   input.js — キーボード / タッチ入力
   Maps physical keys and on-screen pad buttons onto abstract
   actions, and tracks "held" vs "pressed this frame".
   ========================================================= */
'use strict';

const ACT = {
  ArrowLeft:'left',    KeyA:'left',
  ArrowRight:'right',  KeyD:'right',
  ArrowUp:'jump',      KeyW:'jump',
  KeyJ:'punch',
  KeyK:'kick',
  Space:'beam',        KeyL:'beam',
  KeyQ:'pulse',
  ArrowDown:'guard',   KeyS:'guard',
  Enter:'start',       NumpadEnter:'start',
  KeyR:'restart',
  Escape:'back',
};

const Input = (() => {
  const held = {}, pressed = {};

  function setAct(a, v) {
    if (v) {
      if (!held[a]) pressed[a] = true;
      held[a] = true;
    } else {
      held[a] = false;
    }
  }

  addEventListener('keydown', e => {
    const a = ACT[e.code];
    if (!a) return;
    e.preventDefault();
    if (!e.repeat) setAct(a, true);
    Audio.unlock();
  });

  addEventListener('keyup', e => {
    const a = ACT[e.code];
    if (!a) return;
    e.preventDefault();
    setAct(a, false);
  });

  // blur would otherwise leave a key stuck "held"
  addEventListener('blur', () => { for (const k in held) held[k] = false; });

  function bindPad() {
    document.querySelectorAll('#pad button').forEach(b => {
      const act = b.dataset.act;
      if (!act) return;
      const on = ev => {
        ev.preventDefault();
        b.classList.add('on');
        setAct(act, true);
        Audio.unlock();
      };
      const off = ev => {
        ev.preventDefault();
        b.classList.remove('on');
        setAct(act, false);
      };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointerleave', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('contextmenu', ev => ev.preventDefault());
    });
  }

  return {
    bindPad,
    held:    a => !!held[a],
    pressed: a => !!pressed[a],
    /* consume all one-frame presses; call once per tick */
    endFrame() { for (const k in pressed) pressed[k] = false; },
  };
})();
