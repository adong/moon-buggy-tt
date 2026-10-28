/* TT Moon Buggy: the game. Sets up Three.js, runs the rules (js/sim.js) in fixed ticks, turns the rules' events into
   the buggy, rocks, jellies, sparkles, sounds, toasts and the HUD, and handles menus, keys and touch.
   Test hooks live on window.game (at the bottom of this file, and in the README). */
(function () {
  'use strict';
  const T = THREE;
  const G = Kit.gfx;
  const A = MB.art;
  const M = MB.sim;
  const SFX = MB.sfx;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const NAMES = { teddy: 'TEDDY', tommy: 'TOMMY' };
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  const HELPER = 'BRIDGE COMING!'; // what the brother says when he flies off to lay a bridge
  const ASPECT = 1.9; // the play area's shape
  const sig = (kind, which) => Kit.roster.signature(Kit.roster.get(kind), which);
  const sigList = (kind) => Kit.roster.get(kind).signature || ['wave'];

  // ---------------------------------------------------------------- storage

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  };
  const settings = Object.assign({ level: 'easy', lastPlayers: ['teddy'], start: 0 }, store.get('moonBuggyTT.settings', {}));
  const best = Object.assign({ easy: 0, normal: 0 }, store.get('moonBuggyTT.best', {}));
  const reached = Object.assign({ easy: 0, normal: 0 }, store.get('moonBuggyTT.reached', {})); // how many start points are open (index into M.STARTS)
  const saveSettings = () => store.set('moonBuggyTT.settings', settings);

  // ---------------------------------------------------------------- renderer, scene, camera

  const canvas = $('view');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.setPixelRatio(clamp(window.devicePixelRatio || 1, 1.5, 2));
  const scene = new T.Scene();
  // the fixed arcade camera: side on, a little above the road; it only slides along with the buggy
  const CAM = { fov: 36, dist: 20.5, y: 4.8, lookY: 4.0 };
  const camera = new T.PerspectiveCamera(CAM.fov, ASPECT, 0.5, 400);
  scene.add(new T.HemisphereLight('#ffffff', '#6a58b8', 0.95));
  const sun = new T.DirectionalLight('#fff4e6', 1.0);
  sun.position.set(-8, 14, 12);
  scene.add(sun);
  const rim = new T.DirectionalLight('#9fd0ff', 0.35);
  rim.position.set(10, 6, -12);
  scene.add(rim);
  const halfW = () => CAM.dist * Math.tan((CAM.fov * Math.PI) / 360) * ASPECT;

  A.initTextures();
  const backdrop = A.makeBackdrop(scene);
  const fx = A.makeFx(scene);
  const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || /[?&]touch=1/.test(location.search);
  if (touch) document.body.classList.add('touch');
  const faces = Kit.portraits(['teddy', 'tommy'].map((id) => Kit.roster.get(id)), { size: 152 });

  // ---------------------------------------------------------------- state

  const st = {
    mode: 'loading', modeT: 0, time: 0, sim: null, demo: false,
    players: ['teddy'], level: settings.level === 'normal' ? 'normal' : 'easy', startIdx: settings.start | 0,
    frozen: false, keepAwake: false, toasts: [], banner: null, results: null, overAt: 0,
    camX: 0, viewed: -1, celebrate: null, kidPose: null, inputMirror: false,
  };
  let rect = { x: 0, y: 0, w: 100, h: 100 };

  // ---------------------------------------------------------------- the moon: ground, checkpoints, decorations

  let world = null;
  const stageOf = (i) => Math.min(4, Math.floor(i / M.STAGE_LEN));
  function buildWorld(C) {
    if (world && world.course === C) return;
    if (world) for (const o of world.objs) scene.remove(o);
    const objs = [], chunks = [];
    const spans = [[-120, 0, 0]];
    for (let i = 0; i < 25; i++) spans.push([C.cps[i].x, C.cps[i + 1].x, stageOf(i)]);
    spans.push([C.cps[25].x, C.cps[25].x + 200, 4]);
    spans.forEach(([x0, x1, stage], k) => {
      const cs = C.hz.filter((h) => h.kind === 'crater' && h.a >= x0 && h.b <= x1);
      const g = new T.Group();
      g.add(A.buildGround(x0, x1, cs, stage));
      g.add(A.buildDecor(x0, x1, stage, 1000 + k * 77));
      scene.add(g);
      objs.push(g);
      chunks.push({ g, x0, x1 });
    });
    for (const c of C.cps) {
      const v = A.buildCheckpoint(c.letter, A.PALETTES[stageOf(Math.min(24, c.i))].sign, M.STAGE_ENDS.includes(c.i) || c.i === 0 || c.i === 25);
      v.root.position.x = c.x;
      scene.add(v.root);
      objs.push(v.root);
      chunks.push({ g: v.root, x0: c.x - 2, x1: c.x + 2 });
    }
    world = { course: C, objs, chunks };
  }
  function cullWorld() {
    if (!world) return;
    const lo = st.camX - 40, hi = st.camX + 40;
    for (const c of world.chunks) c.g.visible = c.x1 > lo && c.x0 < hi;
  }

  // ---------------------------------------------------------------- views of the things on the road

  const buggyViews = {}, rocketViews = {};
  function buggyView(kind) {
    if (!buggyViews[kind]) {
      const v = A.buildBuggy(kind);
      v.shadow = new T.Mesh(new T.CircleGeometry(1.7, 24), new T.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.25, depthWrite: false }));
      v.shadow.rotation.x = -Math.PI / 2;
      v.shadow.scale.set(1, 0.45, 1);
      scene.add(v.shadow);
      v.root.visible = false;
      scene.add(v.root);
      buggyViews[kind] = v;
    }
    return buggyViews[kind];
  }
  function rocketView(kind) {
    if (!rocketViews[kind]) {
      const v = A.buildRocket(kind, Kit.roster.get(kind).buddyScale || 0.8);
      const tag = G.nameTag(NAMES[kind], Kit.roster.get(kind).tag || '#ffb02e');
      tag.position.set(0, 2.1, 0);
      tag.material.depthTest = false;
      tag.renderOrder = 9;
      v.root.add(tag);
      v.root.visible = false;
      scene.add(v.root);
      rocketViews[kind] = v;
    }
    return rocketViews[kind];
  }
  const rockViews = new Map(), bridgeViews = new Map(), jellyViews = new Map(), gooViews = new Map(), shotViews = new Map();
  const pools = {};
  const fromPool = (key, make) => (pools[key] && pools[key].pop()) || make();
  const toPool = (key, v) => { scene.remove(v.root); (pools[key] || (pools[key] = [])).push(v); };
  function clearViews() {
    for (const [, v] of rockViews) toPool(v.key, v);
    rockViews.clear();
    for (const [, v] of bridgeViews) scene.remove(v.root);
    bridgeViews.clear();
    for (const [, v] of jellyViews) toPool(v.key, v);
    jellyViews.clear();
    for (const [, v] of gooViews) toPool('goo', v);
    gooViews.clear();
    for (const [, v] of shotViews) toPool(v.key, v);
    shotViews.clear();
    for (const v of Object.values(buggyViews)) { v.root.visible = false; v.shadow.visible = false; }
    for (const v of Object.values(rocketViews)) v.root.visible = false;
    fx.clear();
  }

  // how deep the ground is under x (down in a crater's bowl, unless it's bridged)
  function groundAt(R, x) {
    const hz = R.C.hz;
    for (let k = R.hp; k < hz.length; k++) {
      const h = hz[k];
      if (h.a > x) break;
      if (h.kind !== 'crater' || h.bridged || x >= h.b) continue;
      const w = h.b - h.a, d = Math.min(1.7, 0.42 * w + 0.4);
      return -d * Math.sin((Math.PI * (x - h.a)) / w);
    }
    return 0;
  }

  function syncHazards(R, dt) {
    const lo = st.camX - 24, hi = st.camX + 26;
    for (const [i, v] of rockViews) {
      const h = R.C.hz[i];
      if (!h.alive || h.b < lo || h.a > hi || v.kind !== h.kind) { toPool(v.key, v); rockViews.delete(i); }
    }
    for (const [i, v] of bridgeViews) {
      const h = R.C.hz[i];
      if (!h.bridged || h.b < lo - 10 || h.a > hi + 10) { scene.remove(v.root); bridgeViews.delete(i); }
    }
    const hz = R.C.hz;
    for (let k = R.hp; k < hz.length; k++) {
      const h = hz[k];
      if (h.a > hi) break;
      if (h.b < lo) continue;
      if (h.kind === 'crater') {
        if (h.bridged && !bridgeViews.has(h.i)) {
          const v = A.buildBridge(h.a, h.b);
          v.t = st.bridgeNew === h.i ? 0 : 99; // a new one is laid plank by plank; one you come back to is already there
          scene.add(v.root);
          bridgeViews.set(h.i, v);
        }
      } else if (h.alive && !rockViews.has(h.i)) {
        const key = `${h.kind}-${h.i % 12}`;
        const v = fromPool(key, () => A.buildRock(h.kind, h.i % 12));
        v.key = key;
        v.root.position.set(h.x, 0, 0);
        v.root.scale.setScalar(1);
        scene.add(v.root);
        rockViews.set(h.i, v);
      }
    }
    for (const [i, v] of rockViews) {
      const s = 1 + Math.sin(st.time * 2.2 + i) * 0.03;
      v.mesh.scale.set(1 / s, s, 1 / s);
    }
    for (const [, v] of bridgeViews) {
      v.t += dt;
      const n = v.planks.length;
      const shown = Math.min(n, Math.floor((v.t / 0.45) * n));
      for (let k = 0; k < n; k++) {
        if (!v.planks[k].visible && k < shown) { v.planks[k].visible = true; if (v.t < 1) SFX.plank(k % 6); }
      }
    }
  }

  function syncThings(R) {
    // jellies
    const seen = new Set();
    for (const j of R.jellies) {
      seen.add(j.id);
      let v = jellyViews.get(j.id);
      if (!v) {
        const key = `jelly${j.color}`;
        v = fromPool(key, () => A.buildJelly(j.color));
        v.key = key;
        scene.add(v.root);
        jellyViews.set(j.id, v);
      }
      v.root.visible = j.state !== 'pop';
      v.root.position.set(j.x, j.y, 0.3);
      const wob = j.charge > 0 ? Math.sin(st.time * 30) * 0.12 : Math.sin(st.time * 4 + j.id) * 0.05;
      v.root.scale.set(1 + wob, 1 - wob, 1 + wob);
      v.legs.forEach((l, k) => { l.rotation.z = Math.sin(st.time * 5 + k * 1.3 + j.id) * 0.35; });
      v.root.rotation.z = j.state === 'leave' ? Math.sin(st.time * 6) * 0.2 : 0;
    }
    for (const [id, v] of jellyViews) if (!seen.has(id)) { toPool(v.key, v); jellyViews.delete(id); }
    // goo
    seen.clear();
    for (const g of R.goo) {
      seen.add(g.id);
      let v = gooViews.get(g.id);
      if (!v) { v = fromPool('goo', () => A.buildGoo()); scene.add(v.root); gooViews.set(g.id, v); }
      v.root.position.set(g.x, g.y, 0.3);
      const s = 1 + Math.min(0.4, -g.vy * 0.04);
      v.root.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
    }
    for (const [id, v] of gooViews) if (!seen.has(id)) { toPool('goo', v); gooViews.delete(id); }
    // shots
    seen.clear();
    const col = A.BUGGY[R.kind].shot;
    for (const s of R.shots) {
      seen.add(s.id);
      let v = shotViews.get(s.id);
      if (!v) {
        const key = `${s.up ? 'u' : 'f'}${R.kind}`;
        v = fromPool(key, () => ({ root: A.buildShot(s.up, col) }));
        v.key = key;
        scene.add(v.root);
        shotViews.set(s.id, v);
      }
      v.root.position.set(s.x, s.y, s.up ? -0.2 : -0.25);
    }
    for (const [id, v] of shotViews) if (!seen.has(id)) { toPool(v.key, v); shotViews.delete(id); }
  }

  // the buggy: on its springs over the ground, tilting, bouncing, the kid steering, jumping, dizzy or celebrating
  function syncBuggy(R, dt, o = {}) {
    const v = buggyView(R.kind);
    v.root.visible = true;
    v.shadow.visible = true;
    let y = R.y, spin = 0;
    const t = R.stateT;
    if (R.state === 'plop') {
      const d = -groundAt(R, R.x) * 0.8 || 0.8;
      if (t < 0.35) y = -d * (t / 0.35);
      else if (t < 0.95) y = -d;
      else { const u = t - 0.95; y = -d + 9 * u - 12 * u * u; } // BOING back out
    } else if (R.state === 'bonk') {
      if (t < 0.7) { y = 2.2 * Math.sin((Math.PI * t) / 0.7); spin = (t / 0.7) * Math.PI * 2; } else spin = Math.sin(t * 12) * 0.08;
    }
    if (R.state === 'drive' && R.invuln > 1.2) y += ((R.invuln - 1.2) / 0.3) * 3; // drops back onto the road
    v.root.position.set(R.x, y, 0);
    const blink = R.state === 'drive' && R.invuln > 0 && R.invuln < 1.2 && Math.floor(st.time * 10) % 3 === 0;
    v.body.visible = !blink;
    // wheels on springs
    const rolling = R.state === 'drive' || R.state === 'done';
    if (rolling) v.roll += (R.v * dt) / A.WHEEL_R;
    let front = 0, back = 0;
    for (const w of v.wheels) {
      const target = R.air || R.state !== 'drive' ? -0.14 : clamp(groundAt(R, R.x + w.x) - y + R.y, -0.45, 0);
      w.vel += ((target - w.off) * 220 - w.vel * 16) * dt;
      w.off += w.vel * dt;
      w.g.position.y = A.WHEEL_R + w.off;
      w.g.rotation.z = -v.roll;
      w.g.visible = !blink;
      if (w.x > 0.5) front += w.off / 2; else if (w.x < -0.5) back += w.off / 2;
    }
    v.bounceV += (-v.bounce * 140 - v.bounceV * 9) * dt;
    v.bounce += v.bounceV * dt;
    const pitch = R.air ? clamp(R.vy * 0.03, -0.22, 0.22) : (front - back) / 2.2;
    v.tilt += (pitch - v.tilt) * Math.min(1, dt * 12);
    const bob = rolling && !R.air ? Math.sin(st.time * 18) * 0.015 * (R.v / 8) : 0;
    v.body.position.y = (front + back) * 0.3 + v.bounce + bob;
    v.body.rotation.z = v.tilt + spin;
    v.flag.rotation.y = Math.sin(st.time * 8) * 0.3;
    v.shadow.position.set(R.x, Math.max(groundAt(R, R.x), -1.6) + 0.03, 0);
    const sh = clamp(1 - Math.max(0, y) / 6, 0.3, 1);
    v.shadow.scale.set(sh, 0.45 * sh, 1);
    v.shadow.material.opacity = 0.25 * sh;
    // flashes
    v.flashF.visible = st.time - (v.firedAt || -9) < 0.08;
    v.flashU.visible = v.flashF.visible;
    // the kid
    let mode = 'grab';
    if (R.state === 'bonk' || R.state === 'plop') mode = 'fall';
    else if (o.party) { const s = sigList(R.kind); mode = s[Math.floor(st.time / 1.3) % s.length]; }
    else if (st.kidPose && st.kidPose.kind === R.kind && st.time < st.kidPose.until) mode = st.kidPose.mode;
    else if (R.air && R.vy > 0) mode = 'jump';
    v.phase += dt * 6;
    Kit.people.pose(v.kid.p, v.phase, mode, 1 - Math.exp(-14 * dt));
    const up = o.party ? 1 : 0;
    v.kid.holder.position.y += ((1.5 + up * 0.9) - v.kid.holder.position.y) * Math.min(1, dt * 8);
    v.kid.p.root.scale.setScalar(v.kid.s * (1 + up * 0.35));
    if (v.ball) v.ball.visible = mode === 'jumpshot';
    // goo on the buggy while it's sticky
    if (R.sticky > 0 && st.time - (v.gooAt || 0) > 0.25) { v.gooAt = st.time; fx.splat(R.x + G.rand(-1, 1), y + 1.5, '#9dff6a'); }
  }

  // the other brother in his rocket (1 player), or popping in for a high five (2 players)
  function syncBuddy(S, dt) {
    for (const v of Object.values(rocketViews)) v.root.visible = false;
    const R = S.R;
    let kind = null, x = 0, y = 0, mode = 'jet', tilt = 0;
    const b = S.buddy;
    if (b) {
      kind = b.kind; x = b.x; y = b.y + Math.sin(st.time * 3) * 0.12;
      if (b.phase === 'hello') { const s = sigList(kind); mode = s[(b.calls - 1) % s.length]; }
      else if (b.phase === 'treat') mode = 'give';
      else if (b.phase === 'lay') { mode = 'grab'; tilt = -0.25; }
      else if (b.phase === 'bye') mode = 'wave';
      else if (b.phase === 'leave') tilt = 0.5;
    } else if (S.hi5) {
      kind = S.hi5.kind;
      const t = S.hi5.t;
      const k = t < 0.3 ? t / 0.3 : t > 1.25 ? Math.max(0, 1 - (t - 1.25) / 0.35) : 1;
      x = R.x + 0.4 - (1 - k) * 8; y = 3.6 + (1 - k) * 6;
      mode = 'wave';
    }
    if (!kind) return;
    const v = rocketView(kind);
    v.root.visible = true;
    v.root.position.set(x, y, 1.4);
    v.body.rotation.z += (tilt - v.body.rotation.z) * Math.min(1, dt * 6);
    v.flame.scale.setScalar(0.8 + Math.sin(st.time * 40) * 0.25);
    v.phase += dt * 6;
    Kit.people.pose(v.kid.p, v.phase, mode, 1 - Math.exp(-14 * dt));
    if (v.ball) v.ball.visible = mode === 'jumpshot';
  }

  function syncViews(dt) {
    const S = st.sim;
    if (!S) return;
    const idx = st.viewed >= 0 ? st.viewed : S.active;
    const R = S.runs[idx];
    if (st.shownRun !== R) { // a new turn: the other brother's moon (his rocks, his bridges)
      for (const [, v] of rockViews) toPool(v.key, v);
      rockViews.clear();
      for (const [, v] of bridgeViews) scene.remove(v.root);
      bridgeViews.clear();
      for (const v of Object.values(buggyViews)) { v.root.visible = false; v.shadow.visible = false; }
      st.shownRun = R;
      st.camSnap = true;
    }
    // the camera: the faster you go, the further right the buggy sits on the screen
    const L = R.L;
    const sp = clamp((R.v - L.vMin) / (L.vMax - L.vMin), 0, 1);
    const target = R.x + (0.5 - (0.2 + 0.16 * sp)) * 2 * halfW();
    if (st.camSnap || Math.abs(target - st.camX) < 2.5) st.camX = target;
    else st.camX += (target - st.camX) * Math.min(1, dt * 7);
    st.camSnap = false;
    camera.position.set(st.camX, CAM.y, CAM.dist);
    camera.lookAt(st.camX, CAM.lookY, 0);
    backdrop.update(st.camX, 0);
    cullWorld();
    syncHazards(R, dt);
    syncThings(R);
    syncBuggy(R, dt, { party: !!(st.celebrate && st.celebrate.run === R.idx) });
    syncBuddy(S, dt);
  }

  function render() { renderer.render(scene, camera); }

  // ---------------------------------------------------------------- events from the rules

  const toScreen = (x, y, z = 0) => {
    const p = new T.Vector3(x, y, z).project(camera);
    return { x: rect.x + ((p.x + 1) / 2) * rect.w, y: rect.y + ((1 - p.y) / 2) * rect.h };
  };
  function onEvent(e, S) {
    if (st.demo) {
      if (e.type === 'zap' || e.type === 'pop') fx.stardust(e.hx || e.jx, e.hh ? e.hh / 2 : e.jy, 12, '#ffd400');
      return;
    }
    const R = e.run != null ? S.runs[e.run] : S.R;
    const v = R ? buggyView(R.kind) : null;
    const name = (k) => NAMES[k] || '';
    switch (e.type) {
      case 'go':
        SFX.go();
        banner(`POINT ${e.letter}<small>GO!</small>`, 1.4);
        break;
      case 'jump': SFX.jump(); fx.puff(R.x - 1, 0.2, 3, 0.9); break;
      case 'land': SFX.land(); if (v) v.bounceV -= 2.2; fx.puff(R.x, 0.15, 2, 0.8); break;
      case 'fire': SFX.zap(); if (v) v.firedAt = st.time; break;
      case 'crack': SFX.crack(); fx.stardust(e.hx, 0.8, 10, '#ffffff', 4); fx.word(e.hx, 2.4, '+50', '#ffffff', 2.2); break;
      case 'zap':
        SFX.poof(e.rock === 'boulder');
        fx.stardust(e.hx, e.hh / 2, e.rock === 'boulder' ? 22 : 14, '#ffd400', 6);
        fx.puff(e.hx, 0.4, 4, e.rock === 'boulder' ? 1.6 : 1.1);
        fx.word(e.hx, e.hh + 1.4, 'POOF!', '#ffd400', 4.2);
        fx.word(e.hx, e.hh + 0.3, `+${e.pts}`, '#ffffff', 2.8);
        break;
      case 'pop':
        SFX.pop();
        fx.stardust(e.jx, e.jy, 18, ['#ff7ab8', '#6fe3c4', '#ffe066', '#9fb8ff'][e.color] || '#ffffff', 6);
        fx.confetti(e.jx, e.jy, 12, 5);
        fx.word(e.jx, e.jy + 1.3, 'POP!', '#9ff2ff', 4);
        fx.word(e.jx, e.jy + 0.3, '+100', '#ffffff', 2.8);
        break;
      case 'gooPop': SFX.gooPop(); fx.splat(e.gx, e.gy); fx.word(e.gx, e.gy + 0.6, '+20', '#9dff6a', 1.6); break;
      case 'wobble': SFX.wobble(); break;
      case 'drop': SFX.drop(); break;
      case 'splat': SFX.splat(); fx.splat(e.gx, 0); break;
      case 'sticky': SFX.sticky(); toast('STICKY GOO! SLOW...', 'oops', R.x, 3.2); break;
      case 'plop':
        SFX.plop();
        fx.puff(R.x, -0.5, 6, 1.6);
        setTimeout(() => fx.word(R.x, 3.2, 'BOING!', '#ff8fc8', 4.4), 600);
        toast('OOPS! INTO A CRATER', 'oops', R.x, 4.2);
        break;
      case 'bonk':
        SFX.bonk();
        fx.word(R.x, 3.6, e.why === 'goo' ? 'SPLAT!' : 'BONK!', e.why === 'goo' ? '#9dff6a' : '#ffd400', 4.4);
        if (e.why === 'goo') fx.splat(R.x, 1.6);
        for (let k = 0; k < 3; k++) fx.emoji('💫', R.x - 0.6 + k * 0.6, 2.6, { life: 1.2, vy: 0.6, s0: 0.7, s1: 0.4 });
        break;
      case 'softBump':
        SFX.softBump();
        fx.stardust(R.x + 1.4, 0.6, 12, '#ffffff', 4);
        fx.word(R.x + 1, 3, 'BOING!', '#ffd400', 4);
        break;
      case 'cleared': SFX.over20(); fx.word(R.x, 3.6, '+20', '#ffffff', 2.4); break;
      case 'checkpoint':
        SFX.checkpoint();
        setTimeout(() => { for (let k = 0; k < 5; k++) setTimeout(() => SFX.bonus(k), k * 70); }, 300);
        fx.confetti(R.x + 2, 3, 24, 6);
        banner(`POINT ${e.letter}<small>TIME ${Math.floor(e.t)} · BONUS +${e.bonus}</small>`, 1.7);
        break;
      case 'stage':
        SFX.stage();
        noteReached(R);
        if (!S.two) toast(`ON TO ${M.LETTERS[e.cp === 19 ? 25 : e.cp + 5]}!`, 'good', R.x + 4, 5.5, 2.2);
        break;
      case 'finish':
        SFX.win();
        noteReached(R);
        for (let k = 0; k < 4; k++) setTimeout(() => fx.confetti(R.x + G.rand(-3, 6), G.rand(3, 7), 40, 9), k * 350);
        break;
      case 'respawn': SFX.respawn(); break;
      case 'out': if (S.two) toast(`${name(R.kind)} IS OUT OF BUGGIES`, 'oops', R.x, 4.5, 2.2); break;
      case 'turn': {
        SFX.turn();
        const k = e.kind;
        banner(`${name(k)}'S TURN!<small>GET READY</small>`, 1.6);
        break;
      }
      case 'keepGoing': banner('KEEP GOING!', 1.3); SFX.go(); break;
      case 'buddyCall': SFX.rocket(); break;
      case 'treat': {
        SFX.treat();
        const [em, word] = TREATS[e.treat];
        const b = S.buddy;
        if (b) fx.emoji(em, b.x, b.y + 0.6, { life: 0.9, vx: (R.x - b.x) / 0.9 + R.v, vy: 5, g: 11, s0: 0.9, s1: 0.7 });
        st.kidPose = { kind: R.kind, mode: 'wave', until: st.time + 1.2 };
        toast(`${em} ${word} FROM ${name(e.kind)}!`, 'good', R.x, 4.6);
        break;
      }
      case 'buddySays': toast(`${name(e.kind)} SAYS: ${HELPER}`, 'buddy', R.x + 3, 6.5, 2); break;
      case 'bridge': st.bridgeNew = e.hz; SFX.rocket(); break;
      case 'noCrater': toast(`${name(e.kind)} SAYS: NO MORE CRATERS!`, 'buddy', R.x + 3, 6.5, 2); break;
      case 'buddyBye': toast(`BYE BYE, ${name(e.kind)}!`, '', R.x - 1, 6.8, 1.4); break;
      case 'highFive':
        SFX.highFive();
        fx.stardust(R.x + 0.4, 3.4, 18, '#ffd400', 5);
        fx.word(R.x, 5.2, '+50', '#ffffff', 2);
        st.kidPose = { kind: R.kind, mode: 'wave', until: st.time + 1.4 };
        toast('HIGH FIVE!', 'good', R.x, 6.2);
        break;
    }
    if (e.type === 'over' && e.run == null) gameOver(e);
  }

  function noteReached(R) {
    const n = M.STARTS.filter((c) => c <= R.stats.best).length - 1;
    if (n > reached[R.L === M.LEVELS.normal ? 'normal' : 'easy']) {
      reached[R.L === M.LEVELS.normal ? 'normal' : 'easy'] = n;
      store.set('moonBuggyTT.reached', reached);
    }
  }

  // ---------------------------------------------------------------- toasts and banners (they run on the game clock)

  const toastsEl = $('toasts'), bannerEl = $('banner');
  function toast(text, cls = '', wx = 0, wy = 4, dur = 1.8) {
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.textContent = text;
    toastsEl.appendChild(el);
    st.toasts.push({ el, wx, wy, t: 0, dur });
    while (st.toasts.length > 4) { const o = st.toasts.shift(); o.el.remove(); }
  }
  function updateToasts(dt) {
    for (let k = st.toasts.length - 1; k >= 0; k--) {
      const o = st.toasts[k];
      o.t += dt;
      if (o.t > o.dur) { o.el.remove(); st.toasts.splice(k, 1); continue; }
      const p = toScreen(o.wx, o.wy + o.t * 0.8, 1);
      const w = o.el.offsetWidth || 100;
      const x = clamp(p.x - w / 2, rect.x + 6, rect.x + rect.w - w - 6);
      const y = clamp(p.y - k * 4, rect.y + 6, rect.y + rect.h - 40);
      const s = o.t < 0.15 ? 0.6 + (o.t / 0.15) * 0.4 : 1;
      o.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) scale(${s})`;
      o.el.style.opacity = o.t > o.dur - 0.3 ? String((o.dur - o.t) / 0.3) : '1';
    }
  }
  function banner(html, dur = 1.6) {
    bannerEl.innerHTML = html;
    bannerEl.classList.remove('hidden');
    st.banner = { t: 0, dur };
  }
  function updateBanner(dt) {
    if (!st.banner) return;
    st.banner.t += dt;
    const b = st.banner;
    if (b.t > b.dur) { bannerEl.classList.add('hidden'); st.banner = null; return; }
    const s = b.t < 0.18 ? 0.5 + (b.t / 0.18) * 0.5 : b.t > b.dur - 0.2 ? Math.max(0.01, (b.dur - b.t) / 0.2) : 1;
    bannerEl.style.left = `${rect.x + rect.w / 2}px`;
    bannerEl.style.top = `${rect.y + rect.h * 0.36}px`;
    bannerEl.style.transform = `translate(-50%, -50%) scale(${s})`;
  }

  // ---------------------------------------------------------------- layout

  // Where the play area goes: as big as fits, never under the HUD bar, never under the kit's ?, A文 and speaker
  // buttons (the middle of the left edge), and beside or above the touch controls.
  function barBottom() { const r = $('bar').getBoundingClientRect(); return r.height ? r.bottom : 64; }
  function touchLayout() {
    const w = innerWidth, h = innerHeight;
    const D = Math.round(clamp(Math.min(w, h) * 0.24, 80, 140)); // the jump button
    const B = Math.round(clamp(D * 0.72, 60, 104)); // the arrows
    return { D, B, col: Math.max(14 + 2 * B + 10 + 12, 14 + D + 12) };
  }
  function pickRect() {
    const w = innerWidth, h = innerHeight;
    const portrait = h > w * 1.05;
    const top = barBottom() + 8;
    const L = touchLayout();
    const fit = (x0, y0, aw, ah, alignTop) => {
      if (aw < 80 || ah < 60) return { x: 0, y: 0, w: 0, h: 0 };
      let fw = aw, fh = fw / ASPECT;
      if (fh > ah) { fh = ah; fw = fh * ASPECT; }
      return { x: Math.round(x0 + (aw - fw) / 2), y: Math.round(alignTop ? y0 : y0 + (ah - fh) / 2), w: Math.round(fw), h: Math.round(fh) };
    };
    const kitTop = h / 2 - 26;
    const cands = [];
    if (touch && !portrait) {
      // the buttons in columns beside the play area (phones), or in a strip under it (iPads: a bigger play area)
      cands.push(Object.assign(fit(L.col, top, w - 2 * L.col, h - top - 8), { pads: 'side' }));
      cands.push(Object.assign(fit(62, top, w - 124, h - top - 8 - (L.D + 34), true), { pads: 'below' }));
    } else if (touch) cands.push(Object.assign(fit(8, top, w - 16, h - top - 8 - (L.D + L.B + 70), true), { pads: 'portrait' }));
    else {
      cands.push(fit(62, top, w - 124, h - top - 8));
      cands.push(fit(8, top, w - 16, kitTop - 6 - top, true));
    }
    return cands.sort((a, b) => b.w * b.h - a.w * a.h)[0];
  }

  function layout() {
    const w = innerWidth, h = innerHeight;
    const portrait = h > w * 1.05;
    document.body.classList.toggle('portrait', portrait);
    const playing = st.mode === 'play';
    document.body.classList.toggle('playing', playing && touch);
    const two = st.players.length === 2;
    $('card1').classList.toggle('hidden', !two);
    document.body.classList.toggle('two', two);
    rect = pickRect();
    renderer.setSize(Math.max(1, rect.w), Math.max(1, rect.h), false);
    Object.assign(canvas.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
    camera.aspect = ASPECT;
    camera.updateProjectionMatrix();
    // the touch controls
    const L = touchLayout(), D = L.D, B = L.B, Z = Math.round(D * 0.74), F = Math.round(D * 0.7);
    const place = (id, x, y, s, show = true) => {
      const el = $(id);
      el.classList.toggle('show', show && touch && playing);
      Object.assign(el.style, { left: `${Math.round(x)}px`, top: `${Math.round(y)}px`, width: `${Math.round(s)}px`, height: `${Math.round(s)}px` });
    };
    const yTop = barBottom() + 10;
    if (rect.pads === 'below') {
      // one strip along the bottom: slower and faster on the left; his face, zap and jump on the right
      const yb = h - 16;
      place('slowBtn', 14, yb - B, B);
      place('fastBtn', 14 + B + 12, yb - B, B);
      place('jumpBtn', w - 14 - D, yb - D, D);
      place('zapBtn', w - 14 - D - 16 - Z, yb - Z, Z);
      place('budBtn', w - 14 - D - 16 - Z - 16 - F, yb - F, F, !two);
    } else if (!portrait) {
      // left column: slower and faster along the bottom (under the kit's buttons); right column: jump, zap, his face
      place('slowBtn', 14, h - 14 - B, B);
      place('fastBtn', 14 + B + 10, h - 14 - B, B);
      const rc = w - L.col / 2;
      const yJ = h - 16 - D, yZ = yJ - 22 - Z;
      place('jumpBtn', rc - D / 2, yJ, D);
      place('zapBtn', rc - Z / 2, yZ, Z);
      place('budBtn', rc - F / 2, Math.max(yTop, yZ - 24 - F), F, !two);
    } else {
      place('slowBtn', 14, h - 16 - B, B);
      place('fastBtn', 14 + B + 12, h - 16 - B, B);
      place('jumpBtn', w - 14 - D, h - 16 - D, D);
      place('zapBtn', w - 14 - D - 14 - Z, h - 16 - Z, Z);
      place('budBtn', w - 14 - F, h - 16 - D - 26 - F, F, !two);
    }
    updateBanner(0);
  }

  // ---------------------------------------------------------------- input

  const held = new Set();
  const press = { jump: false, fire: false };
  const tHeld = { slow: false, fast: false, fire: false };
  const KEYS = { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], jump: ['ArrowUp', 'KeyW', 'Space'], fire: ['KeyX', 'KeyZ', 'KeyF'] };
  const GAME_KEYS = new Set(Object.values(KEYS).flat());
  const anyHeld = (codes) => codes.some((c) => held.has(c));

  function readInput() {
    const S = st.sim;
    if (!S || st.demo) return;
    const inp = S.input;
    let left = anyHeld(KEYS.left) || tHeld.slow, right = anyHeld(KEYS.right) || tHeld.fast;
    if (st.inputMirror) [left, right] = [right, left]; // a sabotage for the play check (it must catch it)
    inp.left = left;
    inp.right = right;
    inp.jump = anyHeld(KEYS.jump);
    inp.fire = anyHeld(KEYS.fire) || tHeld.fire;
    if (press.jump) { inp.jumpPress = true; press.jump = false; }
    if (press.fire) { inp.firePress = true; press.fire = false; }
  }
  function clearInput() {
    held.clear();
    press.jump = press.fire = false;
    tHeld.slow = tHeld.fast = tHeld.fire = false;
    for (const id of ['slowBtn', 'fastBtn', 'zapBtn', 'jumpBtn']) $(id).classList.remove('down');
    const S = st.sim;
    if (S) Object.assign(S.input, M.blankInput());
  }

  const firstGesture = () => { Kit.sound.init(); if (st.mode === 'title') Kit.sound.music('title'); };

  window.addEventListener('keydown', (e) => {
    firstGesture();
    const c = e.code;
    if (c === 'KeyM') { toggleMute(); return; }
    if (st.mode === 'play') {
      if (GAME_KEYS.has(c)) {
        e.preventDefault();
        held.add(c);
        if (!e.repeat) {
          if (KEYS.jump.includes(c)) press.jump = true;
          if (KEYS.fire.includes(c)) press.fire = true;
        }
        return;
      }
      if ((c === 'KeyT' || c === 'Enter' || c === 'NumpadEnter') && !e.repeat) { e.preventDefault(); callBuddy(); return; }
      if (c === 'KeyP' || c === 'Escape') { pause(); return; }
      return;
    }
    if (st.mode === 'pause') {
      if (c === 'KeyP' || c === 'Escape' || c === 'Space' || c === 'Enter') { e.preventDefault(); resume(); }
      else if (c === 'KeyR') startGame(st.players);
      else if (c === 'KeyQ') toMenu();
      return;
    }
    if (st.mode === 'title') {
      if (c === 'Digit1' || c === 'Numpad1') startGame(['teddy']);
      else if (c === 'Digit2' || c === 'Numpad2') startGame(['tommy']);
      else if (c === 'Digit3' || c === 'Numpad3') startGame(['teddy', 'tommy']);
      else if (c === 'KeyE') setLevel(st.level === 'easy' ? 'normal' : 'easy');
      else if (c === 'KeyS') setStart((st.startIdx + 1) % (reached[st.level] + 1));
      else if (c === 'Enter' || c === 'Space') { e.preventDefault(); startGame(settings.lastPlayers || ['teddy']); }
      return;
    }
    if (st.mode === 'results') {
      if ((c === 'Enter' || c === 'Space') && st.modeT > 1.2) { e.preventDefault(); startGame(st.players); }
      else if (c === 'KeyK' && st.modeT > 0.8) keepGoing();
      else if (c === 'Escape' && st.modeT > 0.5) toMenu();
    }
  });
  window.addEventListener('keyup', (e) => { held.delete(e.code); });
  window.addEventListener('blur', clearInput);
  // (the ? panel takes taps while it's open: a finger lifted then would leave a button held)
  setInterval(() => { if (Kit.help.isOpen() && (tHeld.slow || tHeld.fast || tHeld.fire)) clearInput(); }, 200);

  function bindButton(el, down, up) {
    el.addEventListener('pointerdown', (e) => {
      firstGesture();
      e.preventDefault();
      e.stopPropagation();
      el.classList.add('down');
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* old browser, or a test's pointer */ }
      down();
    });
    const end = () => { el.classList.remove('down'); if (up) up(); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  }
  const playing = () => st.mode === 'play' && !st.demo;
  bindButton($('slowBtn'), () => { if (playing()) tHeld.slow = true; }, () => { tHeld.slow = false; });
  bindButton($('fastBtn'), () => { if (playing()) tHeld.fast = true; }, () => { tHeld.fast = false; });
  bindButton($('jumpBtn'), () => { if (playing()) press.jump = true; });
  bindButton($('zapBtn'), () => { if (playing()) { press.fire = true; tHeld.fire = true; } }, () => { tHeld.fire = false; });
  bindButton($('budBtn'), () => callBuddy());
  bindButton($('budPill'), () => callBuddy());

  function callBuddy() {
    if (!playing() || !st.sim) return;
    st.sim.callBuddy();
  }

  function toggleMute() {
    Kit.sound.init();
    const m = Kit.sound.toggleMute();
    $('muteBtn').textContent = m ? '🔇' : '🔊';
  }
  $('muteBtn').textContent = Kit.sound.isMuted() ? '🔇' : '🔊';
  $('muteBtn').addEventListener('click', toggleMute);
  Kit.sound.onMute((m) => { $('muteBtn').textContent = m ? '🔇' : '🔊'; });
  $('pauseBtn').addEventListener('click', () => (st.mode === 'pause' ? resume() : pause()));

  // ---------------------------------------------------------------- modes

  const SCREENS = ['title', 'pause', 'results'];
  function show(id) { for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id); }

  function setMode(m) {
    st.mode = m;
    st.modeT = 0;
    $('hud').classList.toggle('hidden', m === 'title' || m === 'loading');
    layout();
  }

  function newSim(o) {
    const S = new M.Sim(Object.assign({ buddyFor: (id) => Kit.roster.buddyFor(id) }, o));
    buildWorld(S.course);
    return S;
  }

  function startGame(players, o = {}) {
    firstGesture();
    SFX.click();
    clearViews();
    clearInput();
    for (const t of st.toasts) t.el.remove();
    st.toasts.length = 0;
    st.players = players;
    settings.lastPlayers = players;
    settings.level = st.level;
    settings.start = st.startIdx;
    saveSettings();
    st.demo = false;
    st.results = null; st.overAt = 0; st.celebrate = null; st.viewed = -1; st.kidPose = null; st.shownRun = null;
    const start = M.STARTS[clamp(o.start != null ? o.start : st.startIdx, 0, reached[st.level])];
    st.sim = newSim({ level: st.level, players, start });
    st.camSnap = true;
    show(null);
    setMode('play');
    setupHud();
    Kit.sound.music('play');
  }

  function pause() {
    if (st.mode !== 'play') return;
    clearInput();
    setMode('pause');
    show('pause');
    Kit.sound.music('pause');
  }
  function resume() {
    if (st.mode !== 'pause') return;
    clearInput();
    show(null);
    setMode('play');
    Kit.sound.music('play');
  }
  function toMenu() {
    clearInput();
    for (const t of st.toasts) t.el.remove();
    st.toasts.length = 0;
    bannerEl.classList.add('hidden');
    st.banner = null;
    st.results = null; st.celebrate = null; st.viewed = -1;
    show('title');
    setMode('title');
    refreshTitle();
    startDemo();
    Kit.sound.music('title');
  }
  function startDemo() {
    clearViews();
    st.demo = true;
    st.players = ['teddy'];
    st.sim = newSim({ level: 'easy', players: [Math.random() < 0.5 ? 'teddy' : 'tommy'], start: M.STARTS[Math.floor(Math.random() * 5)] });
    st.shownRun = null; st.viewed = -1; st.celebrate = null;
    st.camSnap = true;
    layout();
  }

  function gameOver(e) {
    const S = st.sim;
    st.celebrate = { run: e.winner >= 0 ? e.winner : S.active, t: 0 };
    st.viewed = st.celebrate.run;
    st.overAt = st.time + (e.won ? 3.2 : 1.8);
    if (!e.won) SFX.over();
    for (const R of S.runs) noteReached(R);
  }
  function showResults() {
    const S = st.sim;
    const lvl = st.level;
    const top = Math.max(...S.runs.map((R) => R.score));
    const newBest = top > best[lvl];
    if (newBest) { best[lvl] = top; store.set('moonBuggyTT.best', best); }
    const won = S.runs.some((R) => R.state === 'done');
    const w = S.winner();
    let title;
    if (S.two) title = w < 0 ? 'WHAT A TIE!' : `${NAMES[S.runs[w].kind]} WINS!`;
    else title = won ? 'YOU MADE IT TO Z!' : 'GREAT DRIVING!';
    setText($('overTitle'), title);
    $('newBest').classList.toggle('hidden', !newBest);
    const rows = S.runs.map((R) => `<span><img alt="" src="${faces[R.kind]}">${NAMES[R.kind]}</span><span>POINT ${M.LETTERS[Math.max(0, R.stats.best)]}</span><span class="v">${R.score}</span>`);
    rows.push(`<span>HI-SCORE</span><span>${lvl === 'easy' ? '🐣' : '🔥'}</span><span class="v">${best[lvl]}</span>`);
    $('tally').innerHTML = rows.join('');
    const keep = S.runs.some((R) => R.state === 'out') && !(won && !S.two);
    $('keepBtn').classList.toggle('hidden', !keep);
    setText($('overHint'), keep ? 'Enter play again · K keep going · Esc menu' : 'Enter play again · Esc menu');
    st.results = { t: 0 };
    show('results');
    setMode('results');
    Kit.sound.music('over');
  }
  function keepGoing() {
    const S = st.sim;
    if (!S || st.mode !== 'results' || !S.keepGoing()) return;
    st.celebrate = null; st.viewed = -1; st.results = null;
    show(null);
    setMode('play');
    Kit.sound.music('play');
  }

  function setLevel(l) {
    st.level = l === 'normal' ? 'normal' : 'easy';
    settings.level = st.level;
    if (st.startIdx > reached[st.level]) st.startIdx = 0;
    saveSettings();
    SFX.click();
    refreshTitle();
  }
  function setStart(i) {
    st.startIdx = clamp(i, 0, reached[st.level]);
    settings.start = st.startIdx;
    saveSettings();
    SFX.click();
    refreshTitle();
  }

  // ---------------------------------------------------------------- HUD

  const textCache = new WeakMap();
  // write text only when it changes (writing the same English every frame would fight the 中文 translation)
  function setText(el, text) {
    if (textCache.get(el) === text) return;
    textCache.set(el, text);
    el.textContent = text;
  }
  function setHtml(el, html) {
    if (textCache.get(el) === html) return;
    textCache.set(el, html);
    el.innerHTML = html;
  }
  function setupHud() {
    const S = st.sim;
    S.runs.forEach((R, i) => {
      const card = $(`card${i}`);
      card.querySelector('img').src = faces[R.kind];
      setText(card.querySelector('.nm'), NAMES[R.kind]);
      card.classList.toggle('tm', R.kind === 'tommy');
    });
    const pics = $('budPill').querySelectorAll('img');
    if (S.two) {
      pics[0].src = faces.teddy; pics[1].src = faces.tommy; pics[1].classList.remove('hidden');
      setText($('budPill').querySelector('.lbl'), 'HIGH FIVE');
    } else {
      const b = Kit.roster.buddyFor(S.runs[0].kind);
      pics[0].src = faces[b]; pics[1].classList.add('hidden');
      setText($('budPill').querySelector('.lbl'), `CALL ${NAMES[b]}`);
      $('budBtn').querySelector('img').src = faces[b];
      setText($('budBtn').querySelector('small'), `CALL ${NAMES[b]}`);
    }
    layout();
  }
  const LEGS = [[0, 4], [4, 9], [9, 14], [14, 19], [19, 25]];
  function updateHud() {
    const S = st.sim;
    if (!S || st.demo) return;
    const R = S.R;
    S.runs.forEach((Q, i) => {
      const card = $(`card${i}`);
      setText(card.querySelector('.lives'), Q.lives > 0 ? '❤️'.repeat(Q.lives) : '·');
      setText(card.querySelector('.sc'), String(Q.score));
      card.classList.toggle('out', Q.state === 'out');
      card.classList.toggle('turn', S.two && Q === R);
      card.classList.toggle('wait', S.two && Q !== R);
    });
    setText($('score'), String(R.score));
    const next = Math.min(25, R.cp + 1);
    const leg = LEGS.find(([a, b]) => next > a && next <= b) || LEGS[0];
    let html = '';
    for (let i = leg[0]; i <= leg[1]; i++) {
      const cls = i <= R.cp ? 'done' : i === next ? 'now' : '';
      html += (i > leg[0] ? '<em></em>' : '') + `<i class="${cls}">${M.LETTERS[i]}</i>`;
    }
    setHtml($('trail'), html);
    setText($('timeTxt'), `TIME ${Math.floor(R.cp >= R.startCp ? R.sectionT : 0)}`);
    setText($('hiTxt'), `HI-SCORE ${Math.max(best[st.level], R.score)}`);
    $('budPill').classList.toggle('on', !!S.buddy || !!S.hi5);
  }

  function refreshTitle() {
    setText($('logo1'), MB.LOGO[0]);
    setText($('logo2'), MB.LOGO[1]);
    document.querySelectorAll('[data-level]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.level === st.level)));
    const sEl = $('starts');
    if (!sEl.children.length) {
      M.STARTS.forEach((c, i) => {
        const b = document.createElement('button');
        b.setAttribute('role', 'radio');
        b.dataset.start = i;
        b.textContent = M.LETTERS[c];
        b.addEventListener('click', () => setStart(i));
        sEl.appendChild(b);
      });
    }
    if (st.startIdx > reached[st.level]) st.startIdx = 0;
    [...sEl.children].forEach((b, i) => {
      b.disabled = i > reached[st.level];
      b.setAttribute('aria-checked', String(i === st.startIdx));
      b.title = i > reached[st.level] ? 'Reach this letter to start here' : `Start at ${M.LETTERS[M.STARTS[i]]}`;
    });
    setText($('hiLine'), `HI-SCORE 🐣 ${best.easy} · 🔥 ${best.normal}`);
  }
  function setupTitle() {
    document.querySelectorAll('[data-face]').forEach((img) => { img.src = faces[img.dataset.face]; });
    document.querySelectorAll('[data-play]').forEach((b) => b.addEventListener('click', () => {
      const p = b.dataset.play;
      startGame(p === 'both' ? ['teddy', 'tommy'] : [p]);
    }));
    document.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => setLevel(b.dataset.level)));
    $('resumeBtn').addEventListener('click', resume);
    $('restartBtn').addEventListener('click', () => startGame(st.players));
    $('quitBtn').addEventListener('click', toMenu);
    $('againBtn').addEventListener('click', () => startGame(st.players));
    $('keepBtn').addEventListener('click', keepGoing);
    $('overMenuBtn').addEventListener('click', toMenu);
    document.title = `${MB.TITLE} · Teddy & Tommy`;
  }

  // ---------------------------------------------------------------- main loop

  function simRuns() { return st.mode === 'play' || st.mode === 'title' || st.mode === 'results'; }

  function tick(dt) {
    st.time += dt;
    st.modeT += dt;
    const S = st.sim;
    if (S && simRuns()) {
      if (st.demo) Object.assign(S.input, M.blankInput(), MB.bot(S.R, { mood: 'show' }));
      else readInput();
      S.advance(dt);
      for (const e of S.events) onEvent(e, S);
      S.events.length = 0;
    }
    if (st.overAt && st.time >= st.overAt && st.mode === 'play') { st.overAt = 0; showResults(); }
    if (st.celebrate) {
      const c = st.celebrate;
      c.t += dt;
      if (c.t < 3 && Math.floor(c.t / 0.8) !== Math.floor((c.t - dt) / 0.8)) {
        const R = S.runs[c.run];
        fx.confetti(R.x + G.rand(-2, 5), G.rand(3, 6), 26, 7);
      }
    }
    if (st.demo && S && (S.R.dead || S.t > 70)) startDemo();
    syncViews(dt);
    fx.update(dt);
    updateHud();
    updateToasts(dt);
    updateBanner(dt);
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (!st.frozen) tick(dt);
    render();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (!st.keepAwake) { pause(); Kit.sound.suspend(); }
    } else Kit.sound.resume();
  });
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 200));

  // ---------------------------------------------------------------- start

  setupTitle();
  $('loading').remove();
  show('title');
  setMode('title');
  startDemo();
  refreshTitle();
  layout();
  requestAnimationFrame(frame);

  // ---------------------------------------------------------------- test hooks

  window.game = {
    // advance the game by `seconds` in 1/60 s frames and draw once (the Browser pane throttles animation while hidden)
    step(seconds = 1 / 60, draw = true) {
      let n = Math.max(1, Math.round(seconds * 60));
      while (n-- > 0) tick(1 / 60);
      if (draw) render();
      return game.state();
    },
    // start a game: { players: ['teddy'] | ['tommy'] | ['teddy', 'tommy'], level: 'easy' | 'normal', start: 0..4 (A E J O T) }
    start(o = {}) {
      if (o.level) st.level = o.level;
      if (o.start != null) { reached[st.level] = Math.max(reached[st.level], o.start); st.startIdx = o.start; }
      startGame(o.players || ['teddy'], { start: o.start });
      return game.state();
    },
    state() {
      const S = st.sim;
      const R = S ? S.R : null;
      return {
        mode: st.mode, demo: st.demo, level: st.level, phase: S ? S.phase : null, active: S ? S.active : 0,
        t: S ? +S.t.toFixed(2) : 0,
        run: R ? { kind: R.kind, state: R.state, x: +R.x.toFixed(2), y: +R.y.toFixed(2), v: +R.v.toFixed(2), air: R.air, lives: R.lives, score: R.score, cp: R.cp, letter: M.LETTERS[Math.max(0, R.cp)], sticky: +R.sticky.toFixed(2), shots: R.shots.length, jellies: R.jellies.length } : null,
        buddy: S && S.buddy ? { kind: S.buddy.kind, phase: S.buddy.phase } : null,
        hi5: !!(S && S.hi5),
      };
    },
    sim: () => st.sim,
    buddy() { callBuddy(); return game.state().buddy; },
    // where the buggy is drawn, in page pixels (for checks that look at the screen)
    buggyScreen() {
      const S = st.sim;
      if (!S) return null;
      const v = buggyViews[S.runs[st.viewed >= 0 ? st.viewed : S.active].kind];
      if (!v) return null;
      v.root.updateMatrixWorld(true);
      const p = new T.Vector3();
      v.body.getWorldPosition(p);
      return toScreen(p.x, p.y + 0.9, p.z);
    },
    // put the buggy somewhere (tests): x along the course, at a speed
    place(x, v) { const R = st.sim.R; R.x = x; if (v != null) R.v = v; R.seek(); st.camSnap = true; },
    check: (o) => MB.check.rules(o),
    checkFails: () => MB.check.sabotage(),
    menu: toMenu,
    pause, resume, keepGoing,
    // out of buggies now (tests): the others are out already, this one has one last bonk
    over() { const S = st.sim; if (!S || S.phase !== 'play') return; for (const R of S.runs) if (R !== S.R) { R.lives = 0; R.state = 'out'; } S.R.lives = 1; S.R.bonk(null, 'goo'); },
    keepAwake(on = true) { st.keepAwake = on; },
    freeze(on = true) { st.frozen = on; },
    mirror(on = true) { st.inputMirror = on; },
    layout,
    rect: () => Object.assign({}, rect),
    held: () => [...held],
    camera, scene, canvas, st, sfx: SFX.log,
  };
})();
