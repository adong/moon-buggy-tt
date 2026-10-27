/* TT Moon Buggy: the autopilot. It drives the title-screen demo and the headless check's "every course can be passed".
   It reads one run's state and gives back that tick's input, the same input a kid's keys make. */
(function () {
  'use strict';
  const MB = (window.MB = window.MB || {});

  // o.mood: 'clean' (the check: jump everything it can't zap, dodge goo) or 'show' (the demo: a bit showy, zaps rocks too)
  MB.bot = function (R, o = {}) {
    const S = MB.sim, L = R.L, inp = S.blankInput();
    if (R.state !== 'drive') return inp;
    const T = S.jumpTime(L), x = R.x, v = R.v;
    const hz = R.C.hz;
    let fire = false, jump = false, dodge = 0;

    // the next things on the ground
    const next = [];
    for (let k = R.hp; k < hz.length && next.length < 3; k++) {
      const h = hz[k];
      if (h.b + S.BUGGY_HALF < x) continue;
      if (h.kind === 'crater' ? h.bridged : !h.alive) continue;
      next.push(h);
    }
    const front = R.shots.filter((s) => !s.up).length;
    for (const h of next) {
      if (h.kind === 'crater') {
        const lip = h.a + L.edge;
        let take = (h.a + h.b) / 2 - (v * T) / 2;
        take = Math.min(take, lip - 0.25);
        if (!R.air && x >= take && x < lip) jump = true;
      } else {
        const gap = h.a - (x + 1.5);
        const zap = h.kind === 'boulder' || !L.softRocks || o.mood === 'show';
        if (zap && gap < 17 && gap > -0.5 && front < 1) fire = true;
        // still there when it's close: jump it
        const reach = S.BUGGY_HALF + h.w / 2;
        const take = h.x - (v * T) / 2;
        if (!R.air && x >= Math.min(take, h.x - reach - 0.2) && x < h.x && (h.kind === 'rock' || L.softRocks)) jump = true;
      }
    }

    // jellies overhead: keep the top cannon going
    for (const j of R.jellies) {
      if (j.state === 'pop' || j.state === 'leave') continue;
      if (Math.abs(j.x - (x + 0.35)) < 3) fire = true;
    }
    // goo coming down (or a jelly wobbling, about to drop some): slow down so it lands ahead of you, and zap it
    const drops = R.goo.map((g) => ({ x: g.x, y: g.y, vx: g.vx, vy: g.vy }));
    for (const j of R.jellies) if (j.charge > 0) drops.push({ x: j.x, y: j.y - 0.6, vx: v, vy: 0 });
    for (const g of drops) {
      const h0 = g.y - (R.y + 1.2);
      if (h0 < 0) continue;
      const G = S.GOO_G;
      const t = (g.vy + Math.sqrt(g.vy * g.vy + 2 * G * h0)) / G;
      const rel = g.x + g.vx * t - (x + v * t);
      if (Math.abs(rel) < 2.2 && t < 2) {
        fire = true;
        if (!R.air) dodge = -1;
      }
    }

    if (o.speed === 'fast') inp.right = true;
    else if (o.speed === 'slow') inp.left = true;
    if (dodge < 0) { inp.left = true; inp.right = false; }
    if (dodge > 0) { inp.right = true; inp.left = false; }
    if (jump) inp.jumpPress = true;
    if (fire) { inp.fire = true; if (R.fireCd <= 0) inp.firePress = true; }
    return inp;
  };
})();
