/* TT Moon Buggy: the game's own sounds, made with Kit.sound.tone / hiss (Web Audio synth, no files).
   Everything is a no-op until Kit.sound.init() runs on the first tap or key, and silent while muted.
   MB.sfx.log counts what played (tests check sound in code, never by ear). */
(function () {
  'use strict';
  const MB = (window.MB = window.MB || {});
  const S = Kit.sound;
  const tone = (o) => S.tone(o), hiss = (o) => S.hiss(o);
  const log = {};

  // a little "let's roll" tune of our own (D major, square lead over a triangle bass)
  const GO = [[587, 0, 0.09], [740, 0.1, 0.09], [880, 0.2, 0.09], [1175, 0.32, 0.26]];
  const POINT = [[784, 0, 0.08], [988, 0.08, 0.08], [1175, 0.16, 0.08], [1568, 0.26, 0.2]];
  const STAGE = [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.1], [1047, 0.32, 0.12], [784, 0.46, 0.08], [1047, 0.56, 0.08], [1319, 0.66, 0.36]];

  const fx = {
    go() {
      for (const [f, at, dur] of GO) tone({ type: 'square', f, at, dur, vol: 0.06, lp: 3000 });
      for (const [f, at] of [[147, 0], [220, 0.2], [294, 0.32]]) tone({ type: 'triangle', f, at, dur: 0.2, vol: 0.2 });
    },
    // the buggy's springy hop
    jump() { tone({ type: 'sine', f: 240, to: 620, dur: 0.2, vol: 0.16 }); tone({ type: 'square', f: 480, to: 900, at: 0.04, dur: 0.12, vol: 0.03, lp: 2400 }); },
    land() { tone({ f: 130, to: 60, dur: 0.12, vol: 0.2 }); tone({ type: 'sine', f: 300, to: 420, at: 0.05, dur: 0.1, vol: 0.06 }); },
    // pew (front) and a higher pew (up): both at once when you fire
    zap() { tone({ type: 'square', f: 900, to: 300, dur: 0.09, vol: 0.035, lp: 2600 }); tone({ type: 'triangle', f: 1400, to: 2200, dur: 0.1, vol: 0.05 }); },
    poof(big) {
      hiss({ filter: 'lowpass', f: big ? 1600 : 2600, to: 300, dur: big ? 0.4 : 0.25, vol: big ? 0.22 : 0.15 });
      [1047, 1319, 1568, 2093].forEach((f, i) => tone({ type: 'triangle', f, at: 0.05 + i * 0.04, dur: 0.08, vol: 0.04 }));
    },
    crack() { tone({ type: 'triangle', f: 180, to: 90, dur: 0.16, vol: 0.2 }); hiss({ filter: 'lowpass', f: 1800, to: 400, dur: 0.18, vol: 0.12 }); },
    pop() { tone({ type: 'sine', f: 500, to: 1400, dur: 0.08, vol: 0.14 }); [1568, 2093, 2637].forEach((f, i) => tone({ type: 'triangle', f, at: 0.06 + i * 0.045, dur: 0.1, vol: 0.05 })); },
    gooPop() { tone({ type: 'sine', f: 700, to: 1200, dur: 0.06, vol: 0.08 }); },
    wobble() { tone({ type: 'sine', f: 330, to: 260, dur: 0.18, vol: 0.06 }); tone({ type: 'sine', f: 300, to: 380, at: 0.2, dur: 0.18, vol: 0.06 }); },
    drop() { tone({ type: 'sine', f: 520, to: 200, dur: 0.25, vol: 0.06 }); },
    splat() { hiss({ filter: 'lowpass', f: 900, to: 200, dur: 0.15, vol: 0.12 }); tone({ type: 'sine', f: 160, to: 90, dur: 0.1, vol: 0.1 }); },
    sticky() { tone({ type: 'sine', f: 200, to: 120, dur: 0.3, vol: 0.14 }); hiss({ filter: 'bandpass', f: 600, q: 2, dur: 0.3, vol: 0.1 }); },
    // into a crater: a soft plop, then BOING back out
    plop() {
      tone({ f: 300, to: 80, dur: 0.3, vol: 0.25 });
      tone({ type: 'sine', f: 180, to: 700, at: 0.55, dur: 0.35, vol: 0.18 });
      tone({ type: 'sine', f: 260, to: 900, at: 0.7, dur: 0.3, vol: 0.1 });
    },
    // a silly bonk with dizzy stars
    bonk() {
      tone({ f: 300, to: 90, dur: 0.18, vol: 0.3 });
      tone({ type: 'square', f: 700, to: 250, at: 0.08, dur: 0.35, vol: 0.05, lp: 1800 });
      for (let i = 0; i < 4; i++) tone({ type: 'triangle', f: 1200 + i * 220, at: 0.25 + i * 0.07, dur: 0.07, vol: 0.04 });
    },
    softBump() { tone({ type: 'sine', f: 220, to: 520, dur: 0.18, vol: 0.16 }); hiss({ filter: 'lowpass', f: 1200, to: 300, dur: 0.2, vol: 0.08 }); },
    over20() { tone({ type: 'triangle', f: 1047, dur: 0.06, vol: 0.05 }); },
    checkpoint() { for (const [f, at, dur] of POINT) tone({ type: 'square', f, at, dur, vol: 0.05, lp: 3400 }); },
    bonus(i) { tone({ type: 'triangle', f: 880 + i * 60, dur: 0.05, vol: 0.05 }); },
    stage() {
      for (const [f, at, dur] of STAGE) tone({ type: 'square', f, at, dur, vol: 0.06, lp: 3400 });
      for (const [f, at] of [[131, 0], [196, 0.32], [262, 0.66]]) tone({ type: 'triangle', f, at, dur: 0.25, vol: 0.2 });
    },
    rocket() { hiss({ f: 500, to: 2600, dur: 0.6, vol: 0.09, q: 1.2 }); tone({ type: 'sawtooth', f: 110, to: 330, dur: 0.6, vol: 0.03, lp: 1200 }); },
    treat() { S.coin(3); },
    plank(i) { tone({ type: 'square', f: 523 + i * 70, dur: 0.05, vol: 0.04, lp: 2600 }); tone({ f: 160, dur: 0.05, vol: 0.08 }); },
    highFive() { tone({ type: 'square', f: 880, dur: 0.06, vol: 0.06, lp: 3000 }); hiss({ filter: 'highpass', f: 3000, dur: 0.08, vol: 0.2 }); [1047, 1319, 1568].forEach((f, i) => tone({ type: 'triangle', f, at: 0.08 + i * 0.05, dur: 0.1, vol: 0.06 })); },
    respawn() { [523, 659, 784].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.06, dur: 0.1, vol: 0.07 })); },
    turn() { [659, 784, 659, 988].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.1, dur: 0.12, vol: 0.08 })); },
    win() {
      [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => tone({ type: 'square', f, at: i * 0.1, dur: 0.14, vol: 0.05, lp: 3400 }));
      [131, 196, 262, 392].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.2, dur: 0.3, vol: 0.2 }));
    },
    over() { [784, 659, 523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.12, dur: 0.16, vol: 0.08 })); },
    click() { tone({ type: 'triangle', f: 900, dur: 0.04, vol: 0.06 }); },
  };
  MB.sfx = { log };
  for (const k of Object.keys(fx)) MB.sfx[k] = (...a) => { log[k] = (log[k] || 0) + 1; fx[k](...a); };
})();
