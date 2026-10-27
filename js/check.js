/* TT Moon Buggy: the headless check of the rules (no drawing, no keys): MB.check.rules() and MB.check.sabotage().
   It runs in node (node tools/check.js) and in the page (game.check(), game.checkFails()).
   The sabotages break one rule each on purpose; every one of them must make some check fail. */
(function () {
  'use strict';
  const MB = (window.MB = window.MB || {});
  const S = () => MB.sim;
  const DT = () => S().DT;

  function sim(o = {}) { return new (S().Sim)(Object.assign({ level: 'easy', players: ['teddy'] }, o)); }
  // tick one run directly (no frames) with an input function
  function drive(Sm, fn, secs, stop) {
    const n = Math.round(secs * S().HZ);
    for (let i = 0; i < n; i++) {
      const R = Sm.R;
      Object.assign(Sm.input, S().blankInput(), fn ? fn(R, i) : {});
      Sm.tick();
      if (stop && stop(Sm.R, Sm)) return i + 1;
    }
    return n;
  }
  // put the run alone with these hazards: [{ kind, at, w? }]
  function only(R, list) {
    const ROCK = S().ROCK;
    R.C.hz = list.map((o, i) => {
      if (o.kind === 'crater') return { i, kind: 'crater', a: o.at, b: o.at + o.w, alive: true, bridged: false, passed: false, resp: o.at - 14 };
      const r = ROCK[o.kind];
      return { i, kind: o.kind, a: o.at, b: o.at + r.w, x: o.at + r.w / 2, w: r.w, h: r.h, hp: o.hp || (o.kind === 'boulder' ? R.L.boulderHp : 1), alive: true, bridged: false, passed: false, resp: o.at - 14 };
    });
    R.hp = 0;
    R.C.jellyAt = [];
    R.nextJelly = 0;
  }
  const evs = (Sm, type) => Sm.events.filter((e) => e.type === type);

  // ------------------------------------------------ the rules from the brief

  // 1. a jump on EASY clears every crater: take off anywhere up to 2 m before the lip, slowest to fastest
  function easyJump(sab) {
    const C = S().buildCourse('easy', { sab });
    const L = C.L;
    const craters = C.hz.filter((h) => h.kind === 'crater');
    let tries = 0, fails = [];
    for (const c of craters) {
      for (const [v, key] of [[L.vMin, 'left'], [L.vCruise, null], [L.vMax, 'right']]) {
        for (const d of [0.05, 0.5, 1, 1.5, 2]) {
          const Sm = sim({ level: 'easy', sab, empty: true });
          const R = Sm.R;
          only(R, [{ kind: 'crater', at: c.a, w: c.b - c.a }]);
          R.x = c.a + L.edge - d; R.v = v; R.cp = 25; R.seek();
          drive(Sm, (r, i) => ({ jumpPress: i === 0, [key || 'none']: true }), 3, (r) => r.state !== 'drive' || r.x > c.b + 3);
          tries++;
          if (R.state !== 'drive') fails.push(`crater ${c.i} (${(c.b - c.a).toFixed(1)} m) at ${v} m/s, ${d} m early`);
        }
      }
    }
    return { ok: !fails.length && craters.length > 0, info: `${craters.length} craters, ${tries} jumps${fails.length ? '; plopped: ' + fails.slice(0, 3).join(', ') : ''}` };
  }

  // 2. the front cannon hits the rock ahead (and not one behind, or one far past its range); boulders take 1 (EASY) or 2 (NORMAL)
  function frontCannon(sab) {
    const probs = [];
    let n = 0;
    for (const level of ['easy', 'normal']) {
      for (const d of [4, 10, 17]) {
        for (const kind of ['rock', 'boulder']) {
          const Sm = sim({ level, sab, empty: true });
          const R = Sm.R;
          R.x = 50; R.cp = 25;
          only(R, [{ kind: 'rock', at: R.x - 8 }, { kind, at: R.x + 1.15 + d }, { kind: 'rock', at: R.x + 70 }]);
          const target = R.C.hz[1];
          const shots = kind === 'boulder' ? R.L.boulderHp : 1;
          drive(Sm, (r, i) => ({ firePress: i === 0 || (i === 40 && shots > 1), left: true }), 1.2, (r) => !target.alive);
          n++;
          if (target.alive) probs.push(`${level} ${kind} ${d} m ahead not zapped`);
          if (!R.C.hz[0].alive) probs.push(`${level} hit the rock behind`);
          if (!R.C.hz[2].alive) probs.push(`${level} hit the rock 70 m away`);
          if (kind === 'boulder' && level === 'normal' && !evs(Sm, 'crack').length) probs.push('normal boulder did not crack first');
        }
      }
    }
    return { ok: !probs.length, info: `${n} targets${probs.length ? '; ' + probs.slice(0, 3).join(', ') : ''}` };
  }

  // 3. the top cannon pops the jelly right overhead (and its goo), not one off to the side
  function topCannon(sab) {
    const probs = [];
    let n = 0;
    for (const level of ['easy', 'normal']) {
      for (const h of [5.5, 7.5]) {
        const Sm = sim({ level, sab, empty: true });
        const R = Sm.R;
        R.x = 50; R.cp = 25;
        only(R, []);
        const mk = (dx) => ({ id: 900 + dx * 10, x: R.x + dx, y: h, vx: R.v, t: 2, state: 'hover', ph: 0, off: dx, offT: 99, dropT: 99, drops: 0, color: 0 });
        const above = mk(0.35), side = mk(5);
        R.jellies.push(above, side);
        R.goo.push({ id: 999, x: R.x + 0.35, y: 4.5, vx: R.v, vy: 0 });
        drive(Sm, (r, i) => ({ firePress: i === 0 || i === 30 }), 0.7);
        n++;
        if (above.state !== 'pop') probs.push(`${level} jelly overhead at ${h} m not popped`);
        if (side.state === 'pop') probs.push(`${level} popped a jelly 5 m away`);
        if (!evs(Sm, 'gooPop').length) probs.push(`${level} goo overhead not popped`);
      }
    }
    return { ok: !probs.length, info: `${n} volleys${probs.length ? '; ' + probs.slice(0, 3).join(', ') : ''}` };
  }

  // 4. checkpoint times and bonuses: the time from one letter to the next, 100 + 10 for each second under par
  function checkpoints(sab) {
    const probs = [];
    const lines = [];
    for (const level of ['easy', 'normal']) {
      const C = S().buildCourse(level);
      if (C.cps.length !== 26 || C.cps.map((c) => c.letter).join('') !== S().LETTERS) probs.push('not A to Z');
      if (C.cps.some((c, i) => i && c.x <= C.cps[i - 1].x)) probs.push('checkpoints out of order');
      const Sm = sim({ level, sab, empty: true });
      const L = Sm.L;
      // cruise to B, crawl to C, zoom to D
      const plan = [null, null, 'left', 'right'];
      drive(Sm, (r) => (plan[r.cp + 1] ? { [plan[r.cp + 1]]: true } : {}), 120, (r) => r.cp >= 3);
      const cps = evs(Sm, 'checkpoint');
      const go = evs(Sm, 'go');
      if (!go.length || go[0].letter !== 'A') probs.push(`${level}: no GO at A`);
      if (cps.map((e) => e.letter).join('') !== 'BCD') probs.push(`${level}: checkpoints ${cps.map((e) => e.letter).join('')}`);
      for (const e of cps) {
        const want = 100 + 10 * Math.max(0, Math.floor(e.par - e.t + 1e-9));
        if (e.bonus !== want) probs.push(`${level} ${e.letter}: bonus ${e.bonus}, want ${want}`);
        lines.push(`${level[0].toUpperCase()}${e.letter} ${e.t.toFixed(2)}s +${e.bonus}`);
      }
      const b = cps[0];
      if (b && Math.abs(b.t - L.section / L.vCruise) > 2 * DT()) probs.push(`${level} B at cruise took ${b.t.toFixed(3)} s`);
      if (b && b.bonus !== 100 + 10 * L.parPad) probs.push(`${level} cruise bonus ${b.bonus}`);
      if (cps.length === 3 && !(cps[1].t > cps[0].t && cps[2].t < cps[0].t && cps[1].bonus < cps[0].bonus && cps[2].bonus > cps[0].bonus)) probs.push(`${level}: slow/fast sections don't change the bonus`);
      // the score is exactly the bonuses (nothing else on an empty course)
      const sum = cps.reduce((a, e) => a + e.bonus, 0);
      if (Sm.R.score !== sum) probs.push(`${level} score ${Sm.R.score} != bonuses ${sum}`);
    }
    return { ok: !probs.length, info: lines.join(' · ') + (probs.length ? '; ' + probs.slice(0, 3).join(', ') : '') };
  }

  // 5. the same inputs give the same game at 30, 60 and 120 frames a second
  function frames(sab) {
    const probs = [];
    const runs = [];
    for (const [level, start, secs] of [['easy', 0, 40], ['normal', 9, 40], ['normal', 19, 30]]) {
      const out = [];
      for (const fps of [30, 60, 120]) {
        const Sm = sim({ level, sab, start });
        const steps = Math.round(secs * fps);
        // a fixed timeline: speed changes and presses at whole 1/30 s
        const at = (k) => k / fps;
        for (let f = 0; f < steps; f++) {
          const t0 = at(f), t1 = at(f + 1);
          const q = Math.floor(t0 * 30);
          const inp = Sm.input;
          inp.right = q % 90 < 25; inp.left = q % 90 > 70;
          inp.fire = q % 120 > 100;
          for (let p = Math.ceil(t0 * 30 - 1e-9); p < t1 * 30 - 1e-9; p++) {
            if (p % 37 === 5) inp.jumpPress = true;
            if (p % 23 === 3) inp.firePress = true;
            if (p % 400 === 200) Sm.callBuddy();
          }
          Sm.advance(t1 - t0);
        }
        const R = Sm.R;
        out.push({ fps, sig: [R.x.toFixed(6), R.y.toFixed(6), R.v.toFixed(6), R.score, R.lives, R.cp, Sm.events.length, Sm.ticks].join(' '), ev: Sm.events.map((e) => e.type).join(',') });
      }
      runs.push(`${level}@${S().LETTERS[start]}: ${out[0].sig.split(' ').slice(3, 6).join('/')}`);
      if (out[1].sig !== out[0].sig || out[2].sig !== out[0].sig) probs.push(`${level}: ${out.map((o) => o.fps + 'fps ' + o.sig).join(' | ')}`);
      else if (out[1].ev !== out[0].ev || out[2].ev !== out[0].ev) probs.push(`${level}: events differ`);
    }
    return { ok: !probs.length, info: runs.join(' · ') + (probs.length ? '; ' + probs[0] : '') };
  }

  // 6. every course can be passed: the autopilot drives A to Z on both levels without losing a buggy,
  //    and from every spot you come back to after a bump it gets past that trouble spot
  function passable(sab) {
    const probs = [];
    const lines = [];
    for (const level of ['easy', 'normal']) {
      const Sm = sim({ level, sab });
      const L = Sm.L;
      const C = Sm.course;
      // the shape of the course: craters the slowest jump clears, room between things, safe spots before letters
      const T = S().jumpTime(L);
      for (const h of C.hz) {
        if (h.kind === 'crater' && (h.b - h.a - 2 * L.edge) > L.vMin * T - 1.5) probs.push(`${level} crater ${h.i} too wide (${(h.b - h.a).toFixed(1)} m)`);
        const prev = C.hz[h.i - 1];
        if (prev && h.a - prev.b < L.gap[0] - 0.01) probs.push(`${level} hazards ${prev.i} and ${h.i} too close`);
        if (C.cps.some((c) => c.x > h.a - 12 && c.x < h.b + 6)) probs.push(`${level} hazard ${h.i} on top of a checkpoint`);
      }
      const secs = drive(Sm, (R) => MB.bot(R), 900, (R) => R.dead || R.stats.lost > 0);
      const R = Sm.R;
      const soft = evs(Sm, 'softBump').length;
      lines.push(`${level}: ${R.state === 'done' ? 'A→Z' : 'stuck at ' + S().LETTERS[Math.max(0, R.cp)]} in ${(secs / S().HZ).toFixed(0)} s, ${R.stats.lost} lost, ${soft} bumps, ${R.score} pts`);
      if (R.state !== 'done') probs.push(`${level}: autopilot did not reach Z (at x ${R.x.toFixed(0)}, ${R.state}, lost ${R.stats.lost})`);
      if (soft) probs.push(`${level}: ${soft} soft bumps`);
      // come back after a bump: from each hazard's comeback spot, at the slow comeback speed
      let bad = 0;
      for (const h of C.hz) {
        const Q = sim({ level, sab });
        const Rq = Q.R;
        Rq.x = h.resp; Rq.v = L.vMin; Rq.cp = C.cps.filter((c) => c.x <= h.resp).length - 1; Rq.nextJelly = C.jellyAt.findIndex((j) => j > h.resp); if (Rq.nextJelly < 0) Rq.nextJelly = C.jellyAt.length;
        Rq.seek();
        if (h.resp < (h.i ? C.hz[h.i - 1].b + S().BUGGY_HALF : -1e9)) { bad++; continue; }
        drive(Q, (r) => MB.bot(r), 8, (r) => r.x > h.b + 4 || r.stats.lost > 0 || r.dead);
        if (Rq.stats.lost > 0 || Rq.x <= h.b + 4) bad++;
      }
      lines.push(`${level}: ${C.hz.length - bad}/${C.hz.length} comebacks`);
      if (bad) probs.push(`${level}: ${bad} comeback spots fail`);
    }
    return { ok: !probs.length, info: lines.join(' · ') + (probs.length ? '; ' + probs.slice(0, 3).join(', ') : '') };
  }

  // 7. the companion: each call lays a bridge over the next crater (drive straight over it); in 2 players it's a high five
  function companion(sab) {
    const probs = [];
    const Sm = sim({ level: 'normal', sab, players: ['teddy'], buddyFor: () => 'tommy' });
    const R = Sm.R;
    Sm.callBuddy();
    drive(Sm, (r) => MB.bot(r), 2.6, () => evs(Sm, 'bridge').length > 0);
    const b1 = evs(Sm, 'bridge')[0];
    if (!b1 || !R.C.hz[b1.hz].bridged || b1.a < b1.rx + 1.5 || R.C.hz.some((h) => h.kind === 'crater' && h.a > b1.rx + 1.5 && h.a < b1.a)) probs.push('the next crater was not bridged');
    if (!evs(Sm, 'treat').length) probs.push('no treat');
    if (!Sm.buddy || Sm.buddy.kind !== 'tommy') probs.push('buddy is not Tommy');
    // three more calls, quickly: three more bridges
    for (let k = 0; k < 3; k++) { Sm.callBuddy(); drive(Sm, (r) => MB.bot(r), 0.3); }
    drive(Sm, (r) => MB.bot(r), 8, () => evs(Sm, 'bridge').length >= 4);
    if (evs(Sm, 'bridge').length < 4) probs.push(`${evs(Sm, 'bridge').length} bridges after 4 calls`);
    // drive across without jumping
    const Q = sim({ level: 'normal', sab, buddyFor: () => 'teddy', players: ['tommy'] });
    const c = Q.R.C.hz.find((h) => h.kind === 'crater');
    Q.callBuddy();
    drive(Q, (r) => (r.x < c.a - 8 ? MB.bot(r) : {}), 30, (r) => r.x > c.b + 2 || r.state !== 'drive');
    if (Q.R.state !== 'drive' || !c.bridged) probs.push('fell into the bridged crater');
    if (!Q.buddy && !evs(Q, 'buddyGone').length) probs.push('no buddy');
    else if ((Q.buddy || {}).kind && Q.buddy.kind !== 'teddy') probs.push('Tommy\'s buddy is not Teddy');
    // 2 players: a high five, no bridge
    const two = sim({ level: 'easy', sab, players: ['teddy', 'tommy'] });
    two.callBuddy();
    if (!evs(two, 'highFive').length || two.buddy) probs.push('2P call is not a high five');
    return { ok: !probs.length, info: `4 calls → ${evs(Sm, 'bridge').length} bridges${probs.length ? '; ' + probs.join(', ') : ''}` };
  }

  // 8. two players take turns: a lost buggy or the end of a stage passes the turn
  function turns(sab) {
    const probs = [];
    const Sm = sim({ level: 'normal', sab, players: ['teddy', 'tommy'] });
    drive(Sm, () => ({}), 30, () => Sm.phase === 'turn');
    if (Sm.phase !== 'turn' || Sm.active !== 0) probs.push('no turn after a lost buggy');
    drive(Sm, () => ({}), 2, () => Sm.phase === 'play');
    if (Sm.active !== 1) probs.push('Tommy did not get his turn');
    const E = sim({ level: 'easy', sab, players: ['teddy', 'tommy'] });
    drive(E, (R) => MB.bot(R), 120, () => E.phase === 'turn');
    if (E.runs[0].cp !== 4) probs.push(`stage turn at ${E.runs[0].cp}`);
    return { ok: !probs.length, info: probs.join(', ') };
  }

  // 9. nothing leaves you stuck: a soft bump keeps you rolling, a crater pops you back out, sticky goo wears off, the game ends
  function stuck(sab) {
    const probs = [];
    const E = sim({ level: 'easy', sab, empty: true });
    only(E.R, [{ kind: 'boulder', at: 10 }, { kind: 'rock', at: 30 }]);
    drive(E, () => ({}), 8);
    if (E.R.x < 38) probs.push(`EASY bumps stopped the buggy (x ${E.R.x.toFixed(1)})`);
    const P = sim({ level: 'normal', sab, empty: true });
    only(P.R, [{ kind: 'crater', at: 20, w: 4 }]);
    drive(P, () => ({}), 6, (r) => r.state === 'drive' && r.stats.lost > 0 && r.stateT > 0.5);
    if (P.R.state !== 'drive' || !P.R.stats.lost) probs.push(`after a crater: ${P.R.state}`);
    const x0 = P.R.x;
    drive(P, () => ({ right: true }), 1);
    if (P.R.x - x0 < 5) probs.push('no driving after the crater');
    const G = sim({ level: 'easy', sab, empty: true });
    only(G.R, []);
    G.R.x = 40; G.R.goo.push({ id: 1, x: 40.5, y: 3, vx: G.R.v, vy: 0 });
    drive(G, () => ({}), 0.6);
    if (!evs(G, 'sticky').length) probs.push('goo did not stick on EASY');
    drive(G, () => ({}), 3);
    if (Math.abs(G.R.v - G.L.vCruise) > 0.01) probs.push('still sticky after 3 s');
    const O = sim({ level: 'normal', sab, empty: true });
    only(O.R, [20, 60, 100, 140].map((a) => ({ kind: 'crater', at: a, w: 4 })));
    drive(O, () => ({}), 40, () => O.phase === 'over');
    if (O.phase !== 'over') probs.push('out of buggies but no game over');
    return { ok: !probs.length, info: probs.join(', ') };
  }

  const RULES = [
    ['a jump on EASY clears every crater', easyJump],
    ['the front cannon hits the rock it aims at', frontCannon],
    ['the top cannon pops the jelly overhead', topCannon],
    ['checkpoint times and bonuses', checkpoints],
    ['the same at 30, 60 and 120 fps', frames],
    ['every course can be passed', passable],
    ['the companion lays bridges', companion],
    ['two players take turns', turns],
    ['nothing leaves you stuck', stuck],
  ];
  const SABOTAGE = ['shortJump', 'blindFront', 'upOffset', 'noBonus', 'perFrame', 'wideCrater', 'stuckBump', 'stuckPlop'];

  function rules(o = {}) {
    const sab = o.sab || [];
    const out = [];
    for (const [name, fn] of RULES) {
      if (o.only && !o.only.includes(name)) continue;
      let r;
      try { r = fn(sab); } catch (e) { r = { ok: false, info: 'threw ' + (e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e) }; }
      out.push({ name, ok: !!r.ok, info: r.info || '' });
    }
    return out;
  }
  function sabotage() {
    return SABOTAGE.map((name) => {
      const r = rules({ sab: [name] });
      return { name, caught: r.some((x) => !x.ok), probs: r.filter((x) => !x.ok).map((x) => x.name) };
    });
  }
  MB.check = { rules, sabotage, SABOTAGE, RULES: RULES.map((r) => r[0]) };
})();
