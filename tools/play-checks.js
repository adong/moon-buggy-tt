/* The real-key play check: run by tools/play.js inside the page (muted, real frames, no game.step, no autopilot).
   Keys are real keydown / keyup events on window; touch is real pointer events on the on-screen buttons (?touch=1).
   What's measured is what you see: the buggy's drawn position on the screen, through the game's own camera.
   At the end it breaks the game on purpose twice (mirrored input, a crater you never come out of) and checks that
   these checks then fail. Returns { ok, checks, sabotage }. */
async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const NAMES = { ArrowRight: 'ArrowRight', ArrowLeft: 'ArrowLeft', ArrowUp: 'ArrowUp', Space: ' ', KeyD: 'd', KeyA: 'a', KeyW: 'w', KeyX: 'x', KeyZ: 'z', KeyF: 'f', KeyT: 't', Enter: 'Enter', KeyP: 'p', Escape: 'Escape', KeyK: 'k', KeyQ: 'q', KeyE: 'e', KeyS: 's', Digit1: '1', Digit2: '2', Digit3: '3', Slash: '?' };
  const key = (type, code, o = {}) => window.dispatchEvent(new KeyboardEvent(type, Object.assign({ code, key: NAMES[code] || code, bubbles: true, cancelable: true }, o)));
  const down = (code, o) => key('keydown', code, o);
  const up = (code, o) => key('keyup', code, o);
  const tap = async (code, ms = 90) => { down(code); await sleep(ms); up(code); await frame(); };
  const until = async (cond, ms) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (cond()) return true; await frame(); } return !!cond(); };
  const S = () => game.sim();
  const R = () => game.sim().R;
  const scr = () => game.buggyScreen();
  const checks = [];
  let fails = 0;
  const check = (name, pass, info = '') => { checks.push({ name, ok: !!pass, info }); if (!pass) fails++; };
  const touch = document.body.classList.contains('touch');
  game.keepAwake(true);

  // clear the road ahead (test setup only: it bridges craters, puts rocks to sleep, sends jellies home)
  const clearRoad = (from, len) => {
    for (const h of R().C.hz) {
      if (h.b < from - 4 || h.a > from + len) continue;
      if (h.kind === 'crater') h.bridged = true; else h.alive = false;
    }
    R().jellies.length = 0; R().goo.length = 0;
    R().nextJelly = R().C.jellyAt.length;
  };
  // a quiet stretch at a checkpoint, at cruise speed
  const settle = async () => {
    const L = R().L;
    await until(() => Math.abs(R().v - L.vCruise) < 0.05 && R().state === 'drive' && !R().air, 3000);
    await frame(); await frame();
  };
  const place = async (x) => { game.place(x, R().L.vCruise); clearRoad(x, 140); await frame(); await frame(); await settle(); };

  // ← → and jumping, measured on the screen: returns problems
  async function directions(label, keys) {
    const probs = [];
    const L = R().L;
    await settle();
    const p0 = scr(), v0 = R().v;
    down(keys.right);
    await until(() => R().v >= L.vMax - 0.01, 1500);
    await frame(); await frame();
    const p1 = scr(), v1 = R().v;
    up(keys.right);
    if (!(p1.x - p0.x > 15)) probs.push(`${keys.right}: screen x ${p0.x.toFixed(0)} → ${p1.x.toFixed(0)}`);
    if (!(v1 > v0 + 1)) probs.push(`${keys.right}: speed ${v0} → ${v1.toFixed(2)}`);
    await settle();
    const p2 = scr(), v2 = R().v;
    down(keys.left);
    await until(() => R().v <= L.vMin + 0.01, 1500);
    await frame(); await frame();
    const p3 = scr(), v3 = R().v;
    up(keys.left);
    if (!(p3.x - p2.x < -15)) probs.push(`${keys.left}: screen x ${p2.x.toFixed(0)} → ${p3.x.toFixed(0)}`);
    if (!(v3 < v2 - 1)) probs.push(`${keys.left}: speed ${v2} → ${v3.toFixed(2)}`);
    await settle();
    // jump: the buggy goes up the screen, then comes back down
    const p4 = scr();
    await tap(keys.jump, 60);
    let top = p4.y;
    await until(() => { top = Math.min(top, scr().y); return R().air && top < p4.y - 25; }, 900);
    if (!(top < p4.y - 25)) probs.push(`${keys.jump}: screen y ${p4.y.toFixed(0)} → ${top.toFixed(0)}`);
    await until(() => !R().air, 2500);
    if (R().air) probs.push(`${keys.jump}: never landed`);
    // zap: both cannons fire
    const shots0 = R().shots.length;
    await tap(keys.fire, 60);
    const fired = await until(() => R().shots.length > shots0, 600);
    if (!fired) probs.push(`${keys.fire}: nothing fired`);
    else if (!(R().shots.some((s) => s.up) && R().shots.some((s) => !s.up))) probs.push(`${keys.fire}: not both cannons`);
    return probs;
  }

  const KEYSETS = [
    { right: 'ArrowRight', left: 'ArrowLeft', jump: 'ArrowUp', fire: 'KeyX' },
    { right: 'KeyD', left: 'KeyA', jump: 'Space', fire: 'KeyZ' },
    { right: 'ArrowRight', left: 'ArrowLeft', jump: 'KeyW', fire: 'KeyF' },
  ];

  // ------------------------------------------------ 1. the title's keys
  game.menu();
  await sleep(200);
  await tap('Digit2');
  check('title: 2 starts Tommy', game.state().mode === 'play' && R().kind === 'tommy');
  await tap('KeyP');
  check('P pauses', game.state().mode === 'pause');
  await tap('KeyQ');
  check('Q goes to the menu', game.state().mode === 'title');
  const lv0 = game.state().level;
  await tap('KeyE');
  check('E switches easy / normal', game.state().level !== lv0);
  if (game.state().level !== 'easy') await tap('KeyE');
  await tap('Digit1');
  check('title: 1 starts Teddy', game.state().mode === 'play' && R().kind === 'teddy');

  // ------------------------------------------------ 2. every direction on every part of the moon, both levels, both brothers
  let n = 0;
  for (const level of ['easy', 'normal']) {
    for (let start = 0; start < 5; start++) {
      const kid = (start + (level === 'normal' ? 1 : 0)) % 2 ? 'tommy' : 'teddy';
      game.start({ players: [kid], level, start });
      const c = game.sim().course.cps[[0, 4, 9, 14, 19][start] + 1];
      await place(c.x + 2);
      const ks = KEYSETS[n++ % KEYSETS.length];
      const probs = await directions(`${level} ${kid} from ${'AEJOT'[start]}`, ks);
      check(`${level} ${kid} at ${'AEJOT'[start]}: → right, ← left, jump up, zap (${ks.right} ${ks.left} ${ks.jump} ${ks.fire})`, !probs.length, probs.join('; '));
    }
  }
  // 2 players: each brother's turn
  for (const level of ['easy', 'normal']) {
    game.start({ players: ['teddy', 'tommy'], level, start: 1 });
    await place(game.sim().course.cps[6].x + 2);
    let probs = await directions('2P Teddy', KEYSETS[0]);
    check(`${level} 2 players, Teddy's turn: directions`, !probs.length && R().kind === 'teddy', probs.join('; '));
    // into a crater on purpose (no jump): the turn passes to Tommy
    const c = R().C.hz.find((h) => h.kind === 'crater' && h.a > R().x + 6);
    c.bridged = false;
    game.place(c.a - 2, R().L.vMin);
    const turned = await until(() => game.sim().phase === 'play' && game.sim().active === 1, 6000);
    check(`${level} 2 players: a crater passes the turn to Tommy`, turned && R().kind === 'tommy');
    await place(R().x + 30);
    probs = await directions('2P Tommy', KEYSETS[1]);
    check(`${level} 2 players, Tommy's turn: directions`, !probs.length && R().kind === 'tommy', probs.join('; '));
    // T is a high five
    await tap('KeyT');
    check(`${level} 2 players: T is a high five`, game.state().hi5 && !game.sim().buddy);
  }

  // ------------------------------------------------ 3. nothing leaves you stuck
  async function controlBack(label) {
    // after trouble: the buggy is driving again within 3 s and → speeds it up
    const back = await until(() => R().state === 'drive' && R().invuln < 1.2, 3500);
    const v0 = R().v;
    down('ArrowRight');
    await sleep(450);
    const v1 = R().v;
    up('ArrowRight');
    return back && v1 > v0 + 0.5 ? null : `${label}: state ${R().state}, speed ${v0.toFixed(1)} → ${v1.toFixed(1)}`;
  }
  // a crater, both levels
  for (const level of ['easy', 'normal']) {
    game.start({ players: ['teddy'], level, start: 0 });
    const c = R().C.hz.find((h) => h.kind === 'crater' && h.a > 30);
    game.place(c.a - 3, R().L.vMin);
    const plopped = await until(() => R().state === 'plop', 2000);
    const p = await controlBack(`${level} crater`);
    check(`${level}: out of a crater and driving again`, plopped && !p, p || (plopped ? '' : 'never plopped'));
  }
  // EASY: a rock is a soft bump: keep rolling, no buggy lost
  {
    game.start({ players: ['tommy'], level: 'easy', start: 0 });
    const h = R().C.hz.find((q) => q.kind !== 'crater' && q.a > 30);
    game.place(h.a - 4, R().L.vCruise);
    const lives = R().lives;
    await until(() => !h.alive, 2500);
    const x0 = R().x;
    await sleep(700);
    check('easy: a rock is a soft bump, the buggy keeps rolling', !h.alive && R().lives === lives && R().x > x0 + 2 && R().state === 'drive', `x ${x0.toFixed(1)} → ${R().x.toFixed(1)}`);
  }
  // NORMAL: a rock bonk, then back on the road
  {
    game.start({ players: ['teddy'], level: 'normal', start: 0 });
    const h = R().C.hz.find((q) => q.kind !== 'crater' && q.a > 30);
    game.place(h.a - 4, R().L.vCruise);
    const bonked = await until(() => R().state === 'bonk', 2000);
    const p = await controlBack('normal rock');
    check('normal: a rock bonk, then driving again', bonked && !p, p || '');
  }
  // EASY: goo makes you sticky for a moment, then you go again
  {
    game.start({ players: ['teddy'], level: 'easy', start: 2 });
    await place(game.sim().course.cps[10].x + 2);
    R().goo.push({ id: 77777, x: R().x + 0.5, y: 3.4, vx: R().v, vy: 0 });
    const stuck = await until(() => R().sticky > 0, 1500);
    await until(() => R().sticky === 0, 2500);
    const p = await controlBack('goo');
    check('easy: sticky goo wears off', stuck && !p, p || '');
  }
  // keys held through a pause, a lost window, and the ? panel never stay stuck down
  {
    game.start({ players: ['teddy'], level: 'easy', start: 0 });
    await place(game.sim().course.cps[1].x + 2);
    down('ArrowRight');
    await sleep(200);
    await tap('KeyP');
    up('ArrowRight');
    await tap('KeyP');
    await sleep(900);
    check('a key held through pause is let go', game.state().mode === 'play' && Math.abs(R().v - R().L.vCruise) < 0.05 && !game.held().length, `v ${R().v}, held ${game.held()}`);
    down('ArrowLeft');
    await sleep(150);
    window.dispatchEvent(new Event('blur'));
    await sleep(900);
    check('a key held when the window loses focus is let go', Math.abs(R().v - R().L.vCruise) < 0.05 && !game.held().length, `v ${R().v}`);
    up('ArrowLeft');
    down('ArrowRight');
    await sleep(150);
    down('Slash', { key: '?', shiftKey: true });
    up('Slash', { key: '?', shiftKey: true });
    await sleep(100);
    const open = Kit.help.isOpen();
    up('ArrowRight');
    await sleep(100);
    down('KeyQ'); up('KeyQ'); // any key closes it
    await sleep(100);
    if (Kit.help.isOpen()) Kit.help.close();
    await sleep(900);
    check('the ? panel opens, closes, and leaves no key stuck', open && !Kit.help.isOpen() && game.state().mode === 'play' && !game.held().length && Math.abs(R().v - R().L.vCruise) < 0.05, `open ${open}, v ${R().v}, held ${game.held()}`);
  }
  // calling your brother mid-jump and in a crater: he comes, bridges, and you keep driving
  {
    game.start({ players: ['tommy'], level: 'normal', start: 0 });
    await place(game.sim().course.cps[1].x + 2);
    await tap('ArrowUp');
    await sleep(150);
    await tap('KeyT');
    const came = await until(() => game.sim().buddy && game.sim().buddy.kind === 'teddy', 500);
    const bridged = await until(() => R().stats.bridges > 0, 4000);
    const c = R().C.hz.find((h) => h.kind === 'crater' && !h.bridged && h.a > R().x + 3);
    game.place(c.a - 2.5, R().L.vMin);
    await until(() => R().state === 'plop', 2000);
    await tap('Enter');
    const p = await controlBack('buddy in crater');
    check('call your brother mid-jump and from a crater: Teddy comes, lays a bridge, driving goes on', came && bridged && !p, p || `came ${came}, bridged ${bridged}`);
  }
  // out of buggies: the results, KEEP GOING (K), PLAY AGAIN (Enter)
  {
    game.start({ players: ['teddy'], level: 'normal', start: 0 });
    game.over();
    const res = await until(() => game.state().mode === 'results', 6000);
    await sleep(900);
    await tap('KeyK');
    const kept = await until(() => game.state().mode === 'play' && R().state === 'drive', 2000);
    const p = await controlBack('keep going');
    game.over();
    await until(() => game.state().mode === 'results', 6000);
    await sleep(1400);
    await tap('Enter');
    const again = await until(() => game.state().mode === 'play' && R().score === 0, 2000);
    check('out of buggies: results, K keeps going, Enter plays again', res && kept && !p && again, p || `results ${res}, kept ${kept}, again ${again}`);
  }
  // a keyboard kid mashing keys for a while: the buggy always comes back to the road and keeps going
  {
    game.start({ players: ['tommy'], level: 'easy', start: 0 });
    const codes = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'Space', 'KeyX', 'KeyT', 'KeyD', 'KeyA', 'KeyZ'];
    let rnd = 7;
    const r = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
    const x0 = R().x;
    let worst = 0, notDrive = 0, last = performance.now();
    const t0 = performance.now();
    while (performance.now() - t0 < 9000) {
      const c = codes[Math.floor(r() * codes.length)];
      down(c);
      await sleep(40 + r() * 260);
      up(c);
      const now = performance.now();
      if (R().state !== 'drive') notDrive += now - last; else notDrive = 0;
      worst = Math.max(worst, notDrive);
      last = now;
    }
    for (const c of codes) up(c);
    check('a keyboard kid mashing keys for 9 s: never stuck, still rolling', R().x > x0 + 20 && worst < 3000 && game.state().mode === 'play', `x ${x0.toFixed(0)} → ${R().x.toFixed(0)}, longest off the road ${worst.toFixed(0)} ms`);
  }

  // ------------------------------------------------ 4. touch: the buttons do what they show
  if (touch) {
    const btn = (id) => document.getElementById(id);
    const pd = (el, type) => el.dispatchEvent(new PointerEvent(type, { pointerId: 5, bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true }));
    const press = async (id, ms) => { pd(btn(id), 'pointerdown'); await sleep(ms); pd(btn(id), 'pointerup'); await frame(); };
    for (const level of ['easy', 'normal']) {
      game.start({ players: ['teddy'], level, start: 0 });
      await place(game.sim().course.cps[1].x + 2);
      const probs = [];
      const shown = ['slowBtn', 'fastBtn', 'jumpBtn', 'zapBtn', 'budBtn'].filter((id) => btn(id).getBoundingClientRect().width < 50);
      if (shown.length) probs.push('hidden: ' + shown.join(','));
      const L = R().L;
      const p0 = scr();
      pd(btn('fastBtn'), 'pointerdown');
      await until(() => R().v >= L.vMax - 0.01, 1500);
      const p1 = scr();
      pd(btn('fastBtn'), 'pointerup');
      if (!(p1.x - p0.x > 15)) probs.push(`▶ moved ${(p1.x - p0.x).toFixed(0)} px`);
      await settle();
      const p2 = scr();
      pd(btn('slowBtn'), 'pointerdown');
      await until(() => R().v <= L.vMin + 0.01, 1500);
      const p3 = scr();
      pd(btn('slowBtn'), 'pointerup');
      if (!(p3.x - p2.x < -15)) probs.push(`◀ moved ${(p3.x - p2.x).toFixed(0)} px`);
      await settle();
      const y0 = scr().y;
      await press('jumpBtn', 60);
      let top = y0;
      await until(() => { top = Math.min(top, scr().y); return top < y0 - 25; }, 900);
      if (!(top < y0 - 25)) probs.push('jump button: no jump');
      await until(() => !R().air, 2500);
      const s0 = R().shots.length;
      await press('zapBtn', 60);
      if (!(await until(() => R().shots.length > s0, 600))) probs.push('zap button: nothing');
      await press('budBtn', 60);
      if (!(await until(() => !!game.sim().buddy, 600))) probs.push('face button: no brother');
      // a finger that slides off (cancel) lets go
      pd(btn('fastBtn'), 'pointerdown');
      await sleep(200);
      pd(btn('fastBtn'), 'pointercancel');
      await sleep(900);
      if (Math.abs(R().v - L.vCruise) > 0.05) probs.push('a cancelled ▶ stays held');
      check(`touch ${level}: ▶ right, ◀ left, jump, zap, his face, cancel lets go`, !probs.length, probs.join('; '));
    }
  }

  // ------------------------------------------------ 5. break it on purpose: these checks must fail
  const sabotage = [];
  {
    game.start({ players: ['teddy'], level: 'easy', start: 0 });
    await place(game.sim().course.cps[1].x + 2);
    game.mirror(true);
    const probs = await directions('mirrored', KEYSETS[0]);
    game.mirror(false);
    sabotage.push({ name: 'mirrored ← →', caught: probs.length > 0, info: probs.join('; ') });
  }
  {
    game.start({ players: ['teddy'], level: 'normal', start: 0 });
    game.sim().sab.add('stuckPlop');
    const c = R().C.hz.find((h) => h.kind === 'crater' && h.a > 30);
    game.place(c.a - 3, R().L.vMin);
    await until(() => R().state === 'plop', 2000);
    const p = await controlBack('stuck crater');
    sabotage.push({ name: 'a crater you never come out of', caught: !!p, info: p || '' });
  }
  game.menu();
  return { ok: !fails && sabotage.every((s) => s.caught), passed: checks.length - fails, of: checks.length, checks: checks.filter((c) => !c.ok).concat(checks.filter((c) => c.ok).map((c) => ({ name: c.name, ok: true }))), sabotage };
}
