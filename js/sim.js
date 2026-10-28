/* TT Moon Buggy: the rules, with no drawing (they run in the page and in node for the headless check).
   The course is one long strip of moon, checkpoints A to Z. Distances are metres along the ground (x) and up (y).
   The rules tick at a fixed 120 Hz, counted in whole units of 1/360000 s, so 30, 60 and 120 fps give the same game. */
(function () {
  'use strict';
  const MB = (window.MB = window.MB || {});

  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const HZ = 120, DT = 1 / HZ;
  const UNIT = 360000, TICK = UNIT / HZ;
  const STAGE_LEN = 5; // a stage is 5 sections: A to E, E to J, J to O, O to T, T to Z
  const STAGE_ENDS = [4, 9, 14, 19]; // E J O T (Z is the finish)

  // 🐣 EASY is for Tommy (5): a slower scroll, a longer floatier jump, rocks only give a soft bump, goo only makes you
  // sticky, and 5 lives. 🔥 NORMAL is for Teddy (8).
  const LEVELS = {
    easy: {
      vMin: 4, vCruise: 7, vMax: 10, accel: 6, brake: 8, jumpV: 7.5, g: 10, lives: 5, softRocks: true, softGoo: true, edge: 0.9,
      section: 110, gap: [16, 30], craterW: [2.4, 4.2], boulderHp: 1, jellyEvery: [4.5, 6.5], jellyDrops: 2, jellies: [0, 0, 1, 1, 2], parPad: 5,
    },
    normal: {
      vMin: 6, vCruise: 10, vMax: 15, accel: 8, brake: 10, jumpV: 7, g: 14, lives: 3, softRocks: false, softGoo: false, edge: 0.6,
      section: 140, gap: [13, 27], craterW: [2.6, 5.6], boulderHp: 2, jellyEvery: [2.8, 4.2], jellyDrops: 3, jellies: [0, 0, 2, 2, 3], parPad: 4,
    },
  };
  const BUGGY_HALF = 1.15; // the bumpers, front and back, from the middle
  const ROCK = { rock: { w: 1.0, h: 0.75 }, boulder: { w: 1.8, h: 1.6 } };
  const FRONT_RANGE = 24, FRONT_SPEED = 26, UP_SPEED = 24;
  const FIRE_CD = 0.22, FIRE_REPEAT = 0.32;
  const BONK_T = 1.3;
  const GOO_G = 7; // goo falls gently (it's the moon)

  function rng32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------------------------------------------------------- the course

  // Every level has one fixed course (so the check can drive all of it). o.sab: 'wideCrater' makes one EASY crater too wide.
  function buildCourse(level, o = {}) {
    const L = LEVELS[level];
    const rnd = rng32(level === 'easy' ? 20261027 : 7041969);
    const r = (a, b) => a + rnd() * (b - a);
    const cps = [], hz = [], jellyAt = [];
    for (let i = 0; i < 26; i++) cps.push({ i, letter: LETTERS[i], x: i * L.section, par: i ? L.section / L.vCruise + L.parPad + 0.5 : 0 });
    for (let i = 0; i < 25; i++) {
      const stage = Math.floor(i / STAGE_LEN);
      const x0 = cps[i].x, x1 = cps[i + 1].x;
      if (o.empty) continue;
      let p = x0 + r(20, 26);
      const end = x1 - 14;
      for (let guard = 0; guard < 40; guard++) {
        // what comes next: craters and little rocks from A, boulders from E, wider craters later on
        const roll = rnd();
        let kind;
        if (stage === 0) kind = roll < 0.58 ? 'crater' : 'rock';
        else kind = roll < 0.48 ? 'crater' : roll < 0.74 ? 'rock' : 'boulder';
        let h;
        if (kind === 'crater') {
          const wide = Math.min(1, 0.45 + stage * 0.14);
          const w = r(L.craterW[0], L.craterW[0] + (L.craterW[1] - L.craterW[0]) * wide);
          h = { kind, a: p, b: p + w };
        } else {
          const R = ROCK[kind];
          h = { kind, a: p, b: p + R.w, x: p + R.w / 2, w: R.w, h: R.h, hp: kind === 'boulder' ? L.boulderHp : 1 };
        }
        if (h.b > end) break;
        hz.push(h);
        const tight = 1 - stage * 0.08;
        p = h.b + r(L.gap[0], L.gap[0] + (L.gap[1] - L.gap[0]) * tight);
      }
      // space jellies float in over some sections (from J on)
      const nj = L.jellies[stage];
      for (let k = 0; k < nj; k++) jellyAt.push(x0 + 12 + k * ((x1 - x0 - 30) / Math.max(1, nj)));
    }
    if (o.sab && o.sab.includes('wideCrater') && level === 'easy') {
      const c = hz.find((h) => h.kind === 'crater' && h.a > cps[3].x);
      if (c) c.b = c.a + 9;
    }
    hz.forEach((h, i) => (h.i = i));
    // where you come back after a bump: before the hazard, after the one behind it, never before its checkpoint
    hz.forEach((h, i) => {
      const prevEnd = i ? hz[i - 1].b : -1e9;
      h.resp = Math.max(prevEnd + 2.5 + BUGGY_HALF, h.a - 14);
    });
    return { level, L, cps, hz, jellyAt, length: cps[25].x };
  }

  // a fresh copy of the course's changing bits (rocks zapped, craters bridged) for one player's run
  function copyCourse(C) {
    return Object.assign({}, C, { hz: C.hz.map((h) => Object.assign({ alive: true, bridged: false, passed: false }, h)) });
  }

  // ---------------------------------------------------------------- one player's drive

  let nextId = 1;
  const blankInput = () => ({ left: false, right: false, jump: false, jumpPress: false, fire: false, firePress: false });

  class Run {
    constructor(sim, kind, idx, start) {
      this.sim = sim;
      this.kind = kind;
      this.idx = idx;
      this.L = sim.L;
      this.C = copyCourse(sim.course);
      this.rnd = rng32(9001 + idx * 77 + start * 13);
      this.lives = this.L.lives;
      this.score = 0;
      this.cp = start - 1; // the last checkpoint passed (you roll up to the starting one)
      this.startCp = start;
      this.x = this.C.cps[start].x - 8;
      this.y = 0; this.vy = 0; this.air = false;
      this.v = this.L.vCruise;
      this.state = 'drive'; this.stateT = 0;
      this.sectionT = 0;
      this.jumpBuf = 0; this.fireCd = 0; this.fireHeld = 0;
      this.sticky = 0; this.invuln = 0; this.bumpT = 0;
      this.shots = []; this.jellies = []; this.goo = [];
      this.nextJelly = this.C.jellyAt.findIndex((j) => j > this.x);
      if (this.nextJelly < 0) this.nextJelly = this.C.jellyAt.length;
      this.cause = null;
      this.hp = 0; // the first hazard that can still matter (they're in order along the course)
      this.seek();
      this.stats = { jumps: 0, zaps: 0, pops: 0, bridges: 0, best: start, lost: 0 };
    }
    seek() {
      const hz = this.C.hz;
      if (this.hp > 0 && hz[this.hp - 1].b > this.x - 30) this.hp = 0;
      while (this.hp < hz.length && hz[this.hp].b < this.x - 30) this.hp++;
    }
    get dead() { return this.state === 'out' || this.state === 'done'; }
    ev(type, o = {}) { this.sim.events.push(Object.assign({ type, run: this.idx, kind: this.kind, x: this.x }, o)); }
    add(n) { this.score += n; }
    // the hazard just ahead (or under you), skipping zapped rocks and bridged craters
    ahead(from = this.x - BUGGY_HALF) {
      const hz = this.C.hz;
      for (let k = this.hp; k < hz.length; k++) { const h = hz[k]; if (h.b > from && (h.kind === 'crater' ? !h.bridged : h.alive)) return h; }
      return null;
    }

    step(inp, dt) {
      const L = this.L, sab = this.sim.sab;
      this.stateT += dt;
      if (this.state === 'plop' || this.state === 'bonk') {
        // a soft BOING out of the crater / a dizzy spin: then back on the road before the trouble spot
        if (this.state === 'bonk' && this.stateT < 0.6) this.x += this.v * dt * (1 - this.stateT / 0.6);
        this.sectionT += dt;
        if (this.stateT >= BONK_T && !(sab.has('stuckPlop'))) this.afterBonk();
        this.stepThings(dt);
        return;
      }
      if (this.state !== 'drive') { this.stepThings(dt); return; }

      // speed: → faster, ← slower, nothing = cruise
      let target = inp.right && !inp.left ? L.vMax : inp.left && !inp.right ? L.vMin : L.vCruise;
      if (this.sticky > 0) { target = Math.min(target, L.vMin); this.sticky = Math.max(0, this.sticky - dt); }
      if (sab.has('stuckBump') && this.sticky === Infinity) target = 0;
      if (this.v < target) this.v = Math.min(target, this.v + L.accel * dt);
      else this.v = Math.max(target, this.v - L.brake * dt);

      // jump (a press counts for 0.15 s, so a tap just before landing still jumps)
      if (inp.jumpPress) this.jumpBuf = 0.15;
      if (!this.air && this.jumpBuf > 0) {
        let jv = L.jumpV;
        if (sab.has('shortJump') && L.softRocks) jv = 6.5;
        this.air = true; this.vy = jv; this.jumpBuf = 0; this.stats.jumps++;
        this.ev('jump');
      }
      this.jumpBuf = Math.max(0, this.jumpBuf - dt);

      // fire: both cannons at once, the front one along the ground and the top one straight up
      this.fireCd = Math.max(0, this.fireCd - dt);
      if (inp.firePress) { this.fire(); this.fireHeld = 0; } else if (inp.fire) {
        this.fireHeld += dt;
        if (this.fireHeld >= FIRE_REPEAT) { this.fireHeld -= FIRE_REPEAT; this.fire(); }
      } else this.fireHeld = 0;

      // move
      this.x += this.v * dt;
      if (this.air) {
        const g = sab.has('shortJump') && L.softRocks ? 14 : L.g;
        this.vy -= g * dt;
        this.y += this.vy * dt;
        if (this.y <= 0 && this.vy < 0) { this.y = 0; this.vy = 0; this.air = false; this.ev('land'); }
      }
      this.sectionT += dt;
      this.invuln = Math.max(0, this.invuln - dt);
      this.bumpT = Math.max(0, this.bumpT - dt);

      // craters (on the ground only; a bridged one is just road), rocks, points for jumping over things
      this.seek();
      const hz = this.C.hz;
      for (let k = this.hp; k < hz.length; k++) {
        const h = hz[k];
        if (h.a > this.x + 4) break;
        if (h.b < this.x - 4) continue;
        if (h.kind === 'crater') {
          if (!this.air && !h.bridged && this.x > h.a + L.edge && this.x < h.b - L.edge) { this.plop(h); return; }
        } else if (h.alive && Math.abs(this.x - h.x) < BUGGY_HALF + h.w / 2 - 0.1 && this.y < h.h - 0.08) {
          if (L.softRocks) {
            h.alive = false;
            this.v = Math.min(this.v, L.vMin);
            if (sab.has('stuckBump')) { this.sticky = Infinity; this.v = 0; }
            if (!this.air) { this.air = true; this.vy = 3.2; }
            this.bumpT = 0.5;
            this.ev('softBump', { hz: h.i, rock: h.kind });
          } else { this.bonk(h, 'rock'); return; }
        }
      }
      for (let k = this.hp; k < hz.length; k++) {
        const h = hz[k];
        if (h.passed || h.b + BUGGY_HALF > this.x) { if (h.a > this.x) break; continue; }
        h.passed = true;
        if (h.kind === 'crater' ? !h.bridged : h.alive) { this.add(20); this.ev('cleared', { hz: h.i, pts: 20 }); }
      }
      // checkpoints
      const nx = this.C.cps[this.cp + 1];
      if (nx && this.x >= nx.x) this.checkpoint(nx);
      this.stepThings(dt);
    }

    checkpoint(c) {
      this.cp = c.i;
      this.stats.best = Math.max(this.stats.best, c.i);
      if (c.i === this.startCp) { this.sectionT = 0; this.ev('go', { letter: c.letter }); return; }
      const t = this.sectionT;
      const bonus = this.sim.sab.has('noBonus') ? 100 : MB.sim.bonus(t, c.par);
      this.add(bonus);
      this.sectionT = 0;
      this.ev('checkpoint', { letter: c.letter, cp: c.i, t, par: c.par, bonus });
      if (c.i === 25) {
        this.add(500);
        this.state = 'done'; this.stateT = 0;
        for (const j of this.jellies) if (j.state !== 'pop') j.state = 'leave';
        this.ev('finish', { pts: 500 });
      } else if (STAGE_ENDS.includes(c.i)) { this.ev('stage', { letter: c.letter, cp: c.i }); this.sim.stageTurn(); }
    }

    fire() {
      if (this.fireCd > 0) return;
      this.fireCd = FIRE_CD;
      const sab = this.sim.sab;
      let f = 0, u = 0;
      for (const s of this.shots) if (s.up) u++; else f++;
      if (f < 2) this.shots.push({ id: nextId++, up: false, x: this.x + 1.5, y: this.y + 0.85, vx: this.v + FRONT_SPEED, vy: 0, x0: this.x + 1.5 });
      if (u < 3) this.shots.push({ id: nextId++, up: true, x: this.x + 0.35 - (sab.has('upOffset') ? 2.2 : 0), y: this.y + 1.95, vx: this.v, vy: UP_SPEED });
      this.ev('fire');
    }

    plop(h) {
      this.state = 'plop'; this.stateT = 0; this.cause = { hz: h.i, why: 'crater' };
      this.x = clamp(this.x, h.a + 0.3, h.b - 0.3);
      this.lives--; this.stats.lost++;
      this.air = false; this.y = 0; this.vy = 0;
      for (const j of this.jellies) if (j.state !== 'pop') j.state = 'leave';
      this.ev('plop', { hz: h.i, a: h.a, b: h.b });
    }
    bonk(h, why) {
      this.state = 'bonk'; this.stateT = 0; this.cause = { hz: h ? h.i : -1, why };
      this.lives--; this.stats.lost++;
      this.air = false; this.y = 0; this.vy = 0;
      for (const j of this.jellies) if (j.state !== 'pop') j.state = 'leave';
      this.ev('bonk', { why, hz: h ? h.i : -1 });
    }
    // back on the road a little before the trouble spot (or out of lives)
    afterBonk() {
      this.goo.length = 0;
      this.shots.length = 0;
      if (this.lives <= 0) { this.state = 'out'; this.stateT = 0; this.ev('out'); return; }
      const h = this.ahead(this.x - BUGGY_HALF - 0.01) || null;
      const target = this.cause && this.cause.hz >= 0 ? this.C.hz[this.cause.hz] : h;
      let x = target ? target.resp : this.x;
      if (!target) x = this.x;
      this.x = x; this.y = 0; this.vy = 0; this.air = false;
      this.seek();
      this.v = this.L.vMin;
      this.sticky = 0; this.jumpBuf = 0; this.fireHeld = 0;
      this.invuln = 1.5;
      this.state = 'drive'; this.stateT = 0;
      this.cause = null;
      this.ev('respawn');
      this.sim.afterLife(this);
    }

    // shots, jellies and goo
    stepThings(dt) {
      const L = this.L, sab = this.sim.sab;
      // shots
      for (let k = this.shots.length - 1; k >= 0; k--) {
        const s = this.shots[k];
        s.x += s.vx * dt; s.y += s.vy * dt;
        let gone = s.up ? s.y > 16 : s.x - s.x0 > FRONT_RANGE;
        if (!gone && !s.up && !sab.has('blindFront')) {
          for (let q = this.hp; q < this.C.hz.length; q++) {
            const h = this.C.hz[q];
            if (h.a > s.x + 2) break;
            if (h.kind === 'crater' || !h.alive) continue;
            if (Math.abs(s.x - h.x) < h.w / 2 + 0.2 && s.y < h.h + 0.15) {
              gone = true;
              h.hp--;
              this.stats.zaps++;
              if (h.hp > 0) {
                // a big boulder cracks into a little rock first (NORMAL)
                Object.assign(h, ROCK.rock, { kind: 'rock', cracked: true });
                this.add(50);
                this.ev('crack', { hz: h.i, pts: 50, hx: h.x });
              } else {
                h.alive = false;
                const pts = h.kind === 'boulder' ? 100 : 50;
                this.add(pts);
                this.ev('zap', { hz: h.i, pts, rock: h.kind, hx: h.x, hh: h.h });
              }
              break;
            }
          }
        }
        if (!gone && s.up) {
          for (const j of this.jellies) {
            if (j.state === 'pop' || j.state === 'gone') continue;
            if (Math.hypot(s.x - j.x, s.y - j.y) < 0.95) {
              gone = true; j.state = 'pop'; j.t = 0;
              this.stats.pops++;
              this.add(100);
              this.ev('pop', { jelly: j.id, pts: 100, jx: j.x, jy: j.y, color: j.color });
              break;
            }
          }
          if (!gone) for (let g = this.goo.length - 1; g >= 0; g--) {
            const d = this.goo[g];
            if (Math.hypot(s.x - d.x, s.y - d.y) < 0.55) {
              gone = true; this.goo.splice(g, 1);
              this.add(20);
              this.ev('gooPop', { pts: 20, gx: d.x, gy: d.y });
              break;
            }
          }
        }
        if (gone) this.shots.splice(k, 1);
      }
      // new jellies
      const driving = this.state === 'drive';
      while (driving && this.nextJelly < this.C.jellyAt.length && this.x >= this.C.jellyAt[this.nextJelly]) {
        if (this.x - this.C.jellyAt[this.nextJelly++] > 20) continue; // (only one you just drove under, not ones far behind)
        this.jellies.push({
          id: nextId++, x: this.x + 16, y: 10, vx: this.v, t: 0, state: 'in', ph: this.rnd() * 6.28, off: 1 + this.rnd() * 3,
          offT: 2 + this.rnd() * 2, dropT: 1.6 + this.rnd(), drops: 0, charge: 0, color: Math.floor(this.rnd() * 4),
        });
        this.ev('jelly');
      }
      // jellies wobble along above you and drop goo when they're over you
      for (let k = this.jellies.length - 1; k >= 0; k--) {
        const j = this.jellies[k];
        j.t += dt;
        if (j.state === 'pop') { if (j.t > 0.6) this.jellies.splice(k, 1); continue; }
        if (j.state === 'leave') {
          j.y += 5 * dt; j.x += (this.v + 3) * dt;
          if (j.y > 17) this.jellies.splice(k, 1);
          continue;
        }
        if (j.state === 'in' && j.t > 1.2) j.state = 'hover';
        const ty = 7 + Math.sin(j.t * 1.7 + j.ph) * 0.7;
        j.y += (ty - j.y) * Math.min(1, 2.2 * dt);
        if (j.charge > 0) {
          // a wobbly "uh-oh" before the goo comes: it stays put over you (you can see it coming: slow down or zap it)
          j.vx = this.v;
          j.x += j.vx * dt;
          j.charge -= dt;
          if (j.charge <= 0) {
            j.charge = 0;
            if (driving) {
              this.goo.push({ id: nextId++, x: j.x, y: j.y - 0.6, vx: this.v, vy: 0 });
              j.drops++;
              this.ev('drop', { jelly: j.id });
            }
            j.dropT = L.jellyEvery[0] + this.rnd() * (L.jellyEvery[1] - L.jellyEvery[0]);
            if (j.drops >= L.jellyDrops) { j.state = 'leave'; j.t = 0; }
          }
          continue;
        }
        j.offT -= dt;
        if (j.offT <= 0) { j.off = -1.5 + this.rnd() * 6.5; j.offT = 2 + this.rnd() * 2; }
        const tx = this.x + j.off;
        j.vx = this.v + clamp((tx - j.x) * 1.4, -5, 5);
        j.x += j.vx * dt;
        j.dropT -= dt;
        const dx = j.x - this.x;
        if (j.dropT <= 0 && driving && dx > -0.5 && dx < 2.5) { j.charge = 0.6; this.ev('wobble', { jelly: j.id }); }
      }
      // goo falls; a splat on the ground is harmless, a splat on the buggy is sticky
      for (let k = this.goo.length - 1; k >= 0; k--) {
        const d = this.goo[k];
        d.vy -= GOO_G * dt;
        d.x += d.vx * dt; d.y += d.vy * dt;
        if (driving && this.invuln <= 0 && Math.abs(d.x - this.x) < 1.3 && d.y > this.y && d.y < this.y + 1.9) {
          this.goo.splice(k, 1);
          if (L.softGoo) { this.sticky = 1.2; this.ev('sticky', { gx: d.x }); } else { this.bonk(null, 'goo'); return; }
          continue;
        }
        if (d.y <= 0) { this.goo.splice(k, 1); this.ev('splat', { gx: d.x }); }
      }
    }
  }

  // ---------------------------------------------------------------- the game: one or two players taking turns

  class Sim {
    // o: { level, players: ['teddy'] | ['tommy'] | ['teddy', 'tommy'], start (checkpoint index), buddyFor, sab: [] }
    constructor(o = {}) {
      this.level = o.level === 'normal' ? 'normal' : 'easy';
      this.L = LEVELS[this.level];
      this.sab = new Set(o.sab || []);
      this.course = o.course || buildCourse(this.level, { sab: o.sab, empty: o.empty });
      this.buddyFor = o.buddyFor || ((id) => (id === 'tommy' ? 'teddy' : 'tommy'));
      this.events = [];
      this.kinds = (o.players || ['teddy']).slice(0, 2);
      this.start = o.start || 0;
      this.runs = this.kinds.map((k, i) => new Run(this, k, i, this.start));
      this.active = 0;
      this.phase = 'play'; this.phaseT = 0;
      this.t = 0; this.ticks = 0; this.acc = 0;
      this.input = blankInput();
      this.buddy = null; this.treats = 0;
      this.hi5 = null;
      this.turnTo = -1;
    }
    get two() { return this.runs.length === 2; }
    get R() { return this.runs[this.active]; }

    // advance by a real frame of dt seconds (whole ticks only; the rest waits for the next frame)
    advance(dt) {
      this.acc += Math.round(dt * UNIT);
      if (this.sab.has('perFrame') && this.phase === 'play') {
        const R = this.R;
        if (R.state === 'drive') R.v += (R.L.vCruise - R.v) * 0.05; // a frame-rate drag: the bug the check must catch
      }
      while (this.acc >= TICK) {
        this.acc -= TICK;
        this.tick();
      }
    }

    tick() {
      this.t += DT; this.ticks++; this.phaseT += DT;
      const inp = this.input;
      if (this.phase === 'play') {
        const R = this.R;
        R.step(inp, DT);
        inp.jumpPress = false; inp.firePress = false;
        this.stepBuddy(DT);
        if (this.hi5) { this.hi5.t += DT; if (this.hi5.t > 1.6) this.hi5 = null; }
        if (R.state === 'done' || R.state === 'out') this.nextTurn(true);
      } else if (this.phase === 'turn') {
        inp.jumpPress = false; inp.firePress = false;
        if (this.phaseT >= 1.6) { this.active = this.turnTo; this.turnTo = -1; this.phase = 'play'; this.phaseT = 0; this.ev('turnGo', { kind: this.R.kind }); }
      } else {
        inp.jumpPress = false; inp.firePress = false;
        for (const R of this.runs) R.stepThings(DT);
        this.stepBuddy(DT);
      }
    }
    ev(type, o = {}) { this.events.push(Object.assign({ type }, o)); }

    // after a lost life: in 2 players it's the other brother's turn (if he still has buggies)
    afterLife(R) { if (this.two) this.nextTurn(false); }
    nextTurn(ended) {
      const other = this.runs[1 - this.active];
      if (this.two && !other.dead) {
        if (ended && this.phase === 'turn') return;
        this.phase = 'turn'; this.phaseT = 0; this.turnTo = 1 - this.active;
        this.ev('turn', { kind: other.kind });
        return;
      }
      if (this.R.dead) {
        if (this.phase === 'over') return;
        this.phase = 'over'; this.phaseT = 0;
        const won = this.runs.some((R) => R.state === 'done');
        this.ev('over', { won, winner: this.winner() });
      }
    }
    winner() {
      const rs = this.runs.slice().sort((a, b) => b.stats.best - a.stats.best || b.score - a.score);
      if (this.two && rs[0].stats.best === rs[1].stats.best && rs[0].score === rs[1].score) return -1;
      return rs[0].idx;
    }
    // KEEP GOING: everyone out of buggies gets them all back, where they were
    keepGoing() {
      if (this.phase !== 'over') return false;
      let any = false;
      for (const R of this.runs) if (R.state === 'out') { R.lives = R.L.lives; R.state = 'drive'; R.stateT = 0; R.invuln = 1.5; R.v = R.L.vMin; any = true; }
      if (!any) return false;
      this.active = this.runs.findIndex((R) => !R.dead);
      this.phase = 'play'; this.phaseT = 0;
      this.ev('keepGoing');
      return true;
    }
    // stage end (E, J, O, T): in 2 players the other brother drives the next stage
    stageTurn() { if (this.two && this.phase === 'play' && !this.runs[1 - this.active].dead) this.nextTurn(false); }

    // ------------------------------------------------ companion: the other brother flies over in his little rocket
    callBuddy() {
      if (this.phase !== 'play') return false;
      const R = this.R;
      if (R.dead) return false;
      if (this.two) {
        if (this.hi5) return false;
        this.hi5 = { t: 0, kind: this.runs[1 - this.active].kind };
        R.add(50);
        this.ev('highFive', { kind: this.hi5.kind, pts: 50 });
        return true;
      }
      let b = this.buddy;
      if (!b) b = this.buddy = { kind: this.buddyFor(R.kind), t: 0, phase: 'in', bridges: 0, calls: 0, x: R.x - 16, y: 10, tx: 0, target: -1 };
      else if (b.phase !== 'in') { b.phase = 'hello'; b.t = 0; }
      b.bridges++;
      b.calls++;
      this.ev('buddyCall', { kind: b.kind, calls: b.calls });
      return true;
    }
    stepBuddy(dt) {
      const b = this.buddy;
      if (!b) return;
      const R = this.R;
      b.t += dt;
      const hover = () => {
        const hx = R.x - 1.6, hy = 4.8;
        b.x += (hx - b.x) * Math.min(1, 5 * dt) + R.v * dt;
        b.y += (hy - b.y) * Math.min(1, 5 * dt);
      };
      switch (b.phase) {
        case 'in':
          hover();
          if (b.t >= 0.7) { b.phase = 'hello'; b.t = 0; this.ev('buddyHello', { kind: b.kind }); }
          break;
        case 'hello': // his signature move
          hover();
          if (b.t >= 1.0) {
            b.phase = 'treat'; b.t = 0;
            const k = this.treats++ % 6;
            R.add(50);
            this.ev('treat', { kind: b.kind, treat: k, pts: 50 });
          }
          break;
        case 'treat':
          hover();
          if (b.t >= 0.5) { b.phase = 'go'; b.t = 0; this.ev('buddySays', { kind: b.kind }); }
          break;
        case 'go': {
          if (b.bridges <= 0) { b.phase = 'bye'; b.t = 0; break; }
          const c = R.C.hz.find((h) => h.kind === 'crater' && !h.bridged && h.a > R.x + 1.5);
          b.bridges--;
          if (!c) { b.bridges = 0; b.phase = 'bye'; b.t = 0; this.ev('noCrater', { kind: b.kind }); break; }
          c.bridged = true;
          R.stats.bridges++;
          b.target = c.i; b.tx = (c.a + c.b) / 2;
          b.phase = 'lay'; b.t = 0;
          this.ev('bridge', { kind: b.kind, hz: c.i, a: c.a, b: c.b, rx: R.x });
          break;
        }
        case 'lay': // zoom over and lay the planks
          b.x += (b.tx - b.x) * Math.min(1, 9 * dt);
          b.y += (2.6 - b.y) * Math.min(1, 9 * dt);
          if (b.t >= 0.8) { b.phase = 'go'; b.t = 0; }
          break;
        case 'bye':
          b.x += R.v * dt;
          if (b.t >= 0.9) { b.phase = 'leave'; b.t = 0; this.ev('buddyBye', { kind: b.kind }); }
          break;
        case 'leave':
          b.x += (R.v + 7) * dt; b.y += 8 * dt;
          if (b.y > 18) { this.buddy = null; this.ev('buddyGone', { kind: b.kind }); }
          break;
      }
    }
  }

  MB.sim = {
    LEVELS, LETTERS, HZ, DT, UNIT, TICK, STAGE_LEN, BUGGY_HALF, ROCK, FRONT_RANGE,
    STARTS: [0, 4, 9, 14, 19], // A E J O T: where a game can start
    STAGE_ENDS,
    GOO_G,
    Sim, Run, buildCourse, blankInput, rng32,
    // the time bonus at a checkpoint: 100, plus 10 for every whole second under the section's par time
    bonus: (t, par) => 100 + 10 * Math.max(0, Math.floor(par - t + 1e-9)),
    jumpTime: (L) => (2 * L.jumpV) / L.g,
  };
})();
