/* TT Moon Buggy: everything you see, built from boxes, balls and canvas drawings (no image files).
   The rules' x runs along the moon to the right and y is up; the 3D world uses the same x and y, with the road at z = 0
   and the fixed arcade camera out in front on +z (js/game.js). */
(function () {
  'use strict';
  const T = THREE;
  const G = Kit.gfx;
  const MB = (window.MB = window.MB || {});
  const INK = '#14121f';

  const geos = {};
  const cached = (k, make) => geos[k] || (geos[k] = make());
  const mat = (color, o = {}) => G.std(color, Object.assign({ roughness: 0.55, metalness: 0.05 }, o));
  function add(geo, m, x, y, z, parent) {
    const o = new T.Mesh(geo, m);
    o.position.set(x, y, z);
    if (parent) parent.add(o);
    return o;
  }
  const box = (w, h, d) => cached(`box${w},${h},${d}`, () => new T.BoxGeometry(w, h, d));

  // ---------------------------------------------------------------- canvas drawings

  function canvasTex(w, h, draw, repeat) {
    const [c, g] = G.makeCanvas(w, h);
    draw(g, w, h);
    const t = G.toTexture(c);
    t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  const spriteOf = (map, size, o = {}) => {
    const s = new T.Sprite(new T.SpriteMaterial(Object.assign({ map, transparent: true, depthWrite: false }, o)));
    s.scale.set(size, size, 1);
    return s;
  };

  // faces: sleepy rocks, grumpy-cute boulders, jellies with big shiny eyes
  function face(kind) {
    return canvasTex(256, 256, (g) => {
      g.lineCap = 'round';
      g.strokeStyle = INK;
      g.fillStyle = 'rgba(255, 110, 150, 0.55)';
      for (const x of [62, 194]) { g.beginPath(); g.ellipse(x, 160, 26, 16, 0, 0, Math.PI * 2); g.fill(); }
      if (kind === 'rock') {
        g.lineWidth = 13;
        for (const x of [84, 172]) { g.beginPath(); g.arc(x, 110, 24, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
        g.lineWidth = 10;
        g.beginPath(); g.ellipse(128, 178, 13, 16, 0, 0, Math.PI * 2); g.fillStyle = '#7a2440'; g.fill(); g.stroke();
      } else if (kind === 'boulder') {
        // big round eyes, worried eyebrows ("oh no, a cannon!")
        for (const x of [86, 170]) {
          g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, 118, 30, 0, Math.PI * 2); g.fill();
          g.lineWidth = 8; g.stroke();
          g.fillStyle = INK; g.beginPath(); g.arc(x + 4, 124, 14, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + 9, 118, 5, 0, Math.PI * 2); g.fill();
        }
        g.lineWidth = 11;
        g.beginPath(); g.moveTo(58, 70); g.lineTo(108, 80); g.stroke();
        g.beginPath(); g.moveTo(198, 70); g.lineTo(148, 80); g.stroke();
        g.beginPath(); g.moveTo(104, 190); g.quadraticCurveTo(128, 172, 152, 190); g.stroke();
      } else {
        // a jelly: shiny eyes and a happy little mouth
        for (const x of [92, 164]) {
          g.fillStyle = INK; g.beginPath(); g.ellipse(x, 120, 17, 22, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + 6, 111, 7, 0, Math.PI * 2); g.fill();
        }
        g.lineWidth = 10;
        g.beginPath(); g.arc(128, 160, 22, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
      }
    });
  }
  function sparkleTex() {
    return canvasTex(64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#ffffff';
      g.beginPath(); g.moveTo(32, 2); g.lineTo(36, 28); g.lineTo(62, 32); g.lineTo(36, 36); g.lineTo(32, 62); g.lineTo(28, 36); g.lineTo(2, 32); g.lineTo(28, 28); g.closePath(); g.fill();
    });
  }
  function puffTex() {
    return canvasTex(128, 128, (g) => {
      g.fillStyle = 'rgba(255,255,255,0.92)';
      for (const [x, y, r] of [[64, 70, 34], [40, 62, 24], [88, 60, 26], [62, 44, 26], [80, 84, 22], [44, 86, 20]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    });
  }
  // a word burst ("POOF!", "+50") in the game's chunky letters
  const words = {};
  function wordTex(text, fill) {
    const key = text + fill;
    if (words[key]) return words[key];
    const [c, g] = G.makeCanvas(512, 160);
    g.font = `64px ${G.FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 16;
    g.strokeStyle = INK;
    g.strokeText(text, 256, 84, 480);
    g.fillStyle = fill;
    g.fillText(text, 256, 80, 480);
    return (words[key] = G.toTexture(c));
  }
  const emojiTex = (e) => cached(`emoji${e}`, () => G.emojiTexture(e));
  const emojiSprite = (e, size) => spriteOf(emojiTex(e), size);

  let TEX = null;
  function initTextures() {
    if (TEX) return TEX;
    TEX = { rock: face('rock'), boulder: face('boulder'), jelly: face('jelly'), sparkle: sparkleTex(), puff: puffTex() };
    return TEX;
  }

  // ---------------------------------------------------------------- the brothers' buggies

  const BUGGY = {
    teddy: { body: '#3f86e8', trim: '#ffd400', dark: '#27335c', hub: '#ffd400', flag: '#ff5d6c', shot: '#ffe066' },
    tommy: { body: '#3fcf9f', trim: '#ff8fb8', dark: '#22524a', hub: '#ff8fb8', flag: '#ffb02e', shot: '#9ff2ff' },
  };
  const WHEEL_X = [-1.1, 0, 1.1], WHEEL_R = 0.42;

  // A Kit person from the waist up (legs tucked inside), turned three quarters toward you and to the right.
  function addKid(parent, id, s, at, turn = -2.45) {
    const p = Kit.people.build(Kit.roster.get(id).look);
    p.legL.visible = p.legR.visible = false;
    p.head.scale.setScalar(1.45);
    const holder = new T.Group();
    holder.position.set(at[0], at[1], at[2]);
    holder.rotation.y = turn;
    parent.add(holder);
    holder.add(p.root);
    p.root.scale.setScalar(s);
    p.root.position.y = -0.88 * s;
    // a bubble helmet: it's the moon
    const helmet = add(cached('helmet', () => new T.SphereGeometry(0.42, 20, 14)), new T.MeshStandardMaterial({ color: '#dff6ff', transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0.1, depthWrite: false }), 0, 0.3, 0, p.head);
    helmet.renderOrder = 5;
    return { p, holder, s, helmet };
  }

  function wheel(C) {
    const g = new T.Group();
    const tire = add(cached('tire', () => new T.CylinderGeometry(WHEEL_R, WHEEL_R, 0.34, 18)), mat('#2b2838', { roughness: 0.9 }), 0, 0, 0, g);
    tire.rotation.x = Math.PI / 2;
    const hub = add(cached('hub', () => new T.CylinderGeometry(0.2, 0.2, 0.38, 10)), mat(C.hub, { metalness: 0.2 }), 0, 0, 0, g);
    hub.rotation.x = Math.PI / 2;
    // two bars so you can see it spin
    for (const r of [0, Math.PI / 2]) {
      const bar = add(box(0.62, 0.08, 0.36), mat('#ffffff'), 0, 0, 0, g);
      bar.rotation.z = r;
    }
    return g;
  }

  // A bouncy six-wheeled toy buggy. `root` sits on the ground at the rules' x; `body` tilts and bounces on its springs;
  // each wheel's spring follows the ground under it.
  function buildBuggy(kind) {
    const C = BUGGY[kind] || BUGGY.teddy;
    const root = new T.Group();
    const body = new T.Group();
    root.add(body);
    const M = { body: mat(C.body, { roughness: 0.4 }), trim: mat(C.trim), dark: mat(C.dark), white: mat('#ffffff'), metal: mat('#c9d3e8', { metalness: 0.4, roughness: 0.35 }) };
    add(box(3.0, 0.3, 1.36), M.dark, 0, 0.72, 0, body); // chassis
    add(box(2.5, 0.62, 1.42), M.body, -0.12, 1.12, 0, body); // the tub
    add(box(2.54, 0.12, 1.46), M.trim, -0.12, 1.47, 0, body); // its rim
    const nose = add(box(0.7, 0.5, 1.3), M.body, 1.25, 1.02, 0, body);
    nose.rotation.z = -0.35;
    add(box(2.0, 0.12, 0.02), M.white, -0.05, 1.08, 0.72, body); // racing stripe
    add(box(0.24, 0.24, 1.5), M.trim, 1.55, 0.78, 0, body); // bumpers
    add(box(0.24, 0.24, 1.5), M.trim, -1.55, 0.78, 0, body);
    // headlight
    add(cached('lamp', () => new T.SphereGeometry(0.13, 10, 8)), new T.MeshBasicMaterial({ color: '#fff6b0' }), 1.62, 0.98, 0.45, body);
    // the front cannon (pointing the way you drive) and the top cannon (pointing at the sky)
    const front = add(cached('gunF', () => new T.CylinderGeometry(0.12, 0.15, 0.7, 12)), M.metal, 1.6, 0.98 + 0.12, -0.25, body);
    front.rotation.z = -Math.PI / 2;
    add(cached('gunTip', () => new T.TorusGeometry(0.13, 0.05, 6, 12)), M.trim, 1.95, 1.1, -0.25, body).rotation.y = Math.PI / 2;
    const turret = add(cached('turret', () => new T.SphereGeometry(0.3, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2)), M.dark, 0.45, 1.52, -0.2, body);
    void turret;
    add(cached('gunU', () => new T.CylinderGeometry(0.1, 0.12, 0.6, 12)), M.metal, 0.45, 1.85, -0.2, body);
    add(cached('gunTipU', () => new T.TorusGeometry(0.11, 0.045, 6, 12)), M.trim, 0.45, 2.15, -0.2, body).rotation.x = Math.PI / 2;
    // antenna with a little flag
    add(cached('ant', () => new T.CylinderGeometry(0.03, 0.03, 1.2, 6)), M.white, -1.2, 2.05, -0.45, body);
    const flag = add(cached('flag', () => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, -0.55, -0.16, 0, 0, -0.32, 0], 3)); g.computeVertexNormals(); return g; }), new T.MeshBasicMaterial({ color: C.flag, side: T.DoubleSide }), -1.2, 2.62, -0.45, body);
    add(cached('antBall', () => new T.SphereGeometry(0.08, 8, 6)), M.trim, -1.2, 2.66, -0.45, body);
    // a steering wheel for small hands
    const steer = add(cached('steer', () => new T.TorusGeometry(0.17, 0.04, 6, 14)), M.dark, 0.3, 1.6, 0.2, body);
    steer.rotation.y = Math.PI / 2; steer.rotation.x = 0.5;
    // the wheels on their springs
    const wheels = [];
    for (const wx of WHEEL_X) for (const wz of [0.78, -0.78]) {
      const w = wheel(C);
      w.position.set(wx, WHEEL_R, wz);
      root.add(w);
      wheels.push({ g: w, x: wx, z: wz, off: 0, vel: 0 });
    }
    const kid = addKid(body, kind, 0.72, [-0.45, 1.5, 0.1]);
    // muzzle flashes
    const flashF = spriteOf(TEX.sparkle, 1.0, { blending: T.AdditiveBlending, color: C.shot });
    flashF.position.set(2.15, 1.1, -0.25); flashF.visible = false; body.add(flashF);
    const flashU = spriteOf(TEX.sparkle, 0.9, { blending: T.AdditiveBlending, color: C.shot });
    flashU.position.set(0.45, 2.35, -0.2); flashU.visible = false; body.add(flashU);
    let ball = null;
    if (kind === 'teddy') { ball = emojiSprite('🏀', 0.5); ball.visible = false; kid.p.head.add(ball); ball.position.set(0, 1.0, 0); }
    return { root, body, wheels, kid, flag, flashF, flashU, ball, kind, color: C, phase: 0, roll: 0, tilt: 0, bounce: 0, bounceV: 0 };
  }

  // the other brother's little rocket: nose to the right, flame at the back, him standing up in the middle
  function buildRocket(kind, scale) {
    const C = BUGGY[kind] || BUGGY.teddy;
    const root = new T.Group();
    const body = new T.Group();
    root.add(body);
    const tube = add(cached('rkt', () => new T.CylinderGeometry(0.42, 0.42, 1.8, 16)), mat('#ffffff', { roughness: 0.35 }), 0, 0, 0, body);
    tube.rotation.z = Math.PI / 2;
    const nose = add(cached('rktNose', () => new T.ConeGeometry(0.42, 0.8, 16)), mat(C.flag), 1.3, 0, 0, body);
    nose.rotation.z = -Math.PI / 2;
    const band = add(cached('rktBand', () => new T.CylinderGeometry(0.44, 0.44, 0.24, 16)), mat(C.body), 0.4, 0, 0, body);
    band.rotation.z = Math.PI / 2;
    for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
      const fin = add(box(0.5, 0.06, 0.5), mat(C.trim), -0.85, Math.cos(a) * 0.45, Math.sin(a) * 0.45, body);
      fin.rotation.x = a;
    }
    const flame = spriteOf(TEX.sparkle, 1.0, { blending: T.AdditiveBlending, color: '#ffb02e' });
    flame.position.set(-1.25, 0, 0);
    body.add(flame);
    const kid = addKid(body, kind, 0.95 * scale, [-0.1, 0.3, 0], -2.6);
    let ball = null;
    if (kind === 'teddy') { ball = emojiSprite('🏀', 0.5); ball.visible = false; kid.p.head.add(ball); ball.position.set(0, 1.0, 0); }
    return { root, body, flame, kid, ball, kind, phase: 0 };
  }

  // ---------------------------------------------------------------- things on the moon

  const ROCK_COLORS = ['#ff9f6b', '#c792ff', '#ff86b4', '#8fd0ff'];
  function lumpGeo(r, seed, sy) {
    const g = new T.IcosahedronGeometry(r, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = 1 + 0.12 * Math.sin(x * 7 + seed) * Math.cos(z * 5 + seed * 2) + 0.06 * Math.sin(y * 9 + seed);
      p.setXYZ(i, x * n, y * n * sy, z * n);
    }
    g.computeVertexNormals();
    return g;
  }
  function buildRock(kind, seed) {
    const big = kind === 'boulder';
    const root = new T.Group();
    const color = ROCK_COLORS[seed % ROCK_COLORS.length];
    const r = big ? 0.95 : 0.52, h = big ? 1.6 : 0.75;
    const geo = cached(`rock${kind}${seed % 3}`, () => lumpGeo(r, seed % 3, h / (2 * r)));
    const m = add(geo, mat(color, { flatShading: true, roughness: 0.75 }), 0, h / 2, 0, root);
    const f = new T.Mesh(cached(`face${kind}`, () => new T.PlaneGeometry(r * 1.5, r * 1.5)), new T.MeshBasicMaterial({ map: big ? TEX.boulder : TEX.rock, transparent: true, depthWrite: false }));
    f.position.set(0.05, h * 0.5, r * 0.92);
    root.add(f);
    return { root, mesh: m, face: f, kind, color, h };
  }

  const JELLY_COLORS = ['#ff7ab8', '#6fe3c4', '#ffe066', '#9fb8ff'];
  function buildJelly(ci) {
    const color = JELLY_COLORS[ci % JELLY_COLORS.length];
    const root = new T.Group();
    const dome = add(cached('jdome', () => new T.SphereGeometry(0.8, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2)), new T.MeshStandardMaterial({ color, transparent: true, opacity: 0.82, roughness: 0.2, emissive: color, emissiveIntensity: 0.25 }), 0, 0, 0, root);
    add(cached('jbase', () => new T.CircleGeometry(0.8, 20)), new T.MeshStandardMaterial({ color: G.shade(color, -0.15), side: T.DoubleSide, transparent: true, opacity: 0.85 }), 0, 0, 0, root).rotation.x = Math.PI / 2;
    const legs = [];
    for (let k = 0; k < 5; k++) {
      const leg = add(cached('jleg', () => { const g = new T.CylinderGeometry(0.07, 0.04, 0.8, 6); g.translate(0, -0.4, 0); return g; }), mat(color, { transparent: true, opacity: 0.9 }), -0.5 + k * 0.25, 0, Math.sin(k * 2.1) * 0.25, root);
      legs.push(leg);
    }
    const f = new T.Mesh(cached('jface', () => new T.PlaneGeometry(0.95, 0.95)), new T.MeshBasicMaterial({ map: TEX.jelly, transparent: true, depthWrite: false }));
    f.position.set(0, 0.35, 0.72);
    root.add(f);
    // a shiny spot
    add(cached('jshine', () => new T.SphereGeometry(0.12, 8, 6)), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }), -0.3, 0.55, 0.45, root);
    return { root, dome, legs, face: f, color };
  }
  function buildGoo() {
    const root = new T.Group();
    add(cached('goo', () => new T.SphereGeometry(0.28, 12, 10)), new T.MeshStandardMaterial({ color: '#9dff6a', emissive: '#4fd12b', emissiveIntensity: 0.35, roughness: 0.15, transparent: true, opacity: 0.9 }), 0, 0, 0, root);
    add(cached('gooShine', () => new T.SphereGeometry(0.07, 6, 5)), new T.MeshBasicMaterial({ color: '#ffffff' }), -0.1, 0.12, 0.2, root);
    return { root };
  }
  function buildShot(up, color) {
    const s = spriteOf(TEX.sparkle, up ? 0.75 : 0.85, { blending: T.AdditiveBlending, color });
    const g = new T.Group();
    g.add(s);
    const core = add(cached('shotCore', () => new T.SphereGeometry(0.13, 8, 6)), new T.MeshBasicMaterial({ color: '#ffffff' }), 0, 0, 0, g);
    void core;
    if (!up) s.scale.set(1.2, 0.6, 1);
    return g;
  }

  // a checkpoint: a striped post with the letter on a flag, and a starry ribbon on the ground
  function letterTex(letter, color) {
    return canvasTex(256, 256, (g) => {
      g.fillStyle = color;
      G.roundRect(g, 8, 8, 240, 240, 46); g.fill();
      g.lineWidth = 14; g.strokeStyle = INK; g.stroke();
      g.font = `170px ${G.FONT}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 18; g.lineJoin = 'round'; g.strokeText(letter, 128, 140);
      g.fillStyle = '#ffffff'; g.fillText(letter, 128, 136);
    });
  }
  function buildCheckpoint(letter, color, big) {
    const root = new T.Group();
    const pole = add(cached('cpPole', () => new T.CylinderGeometry(0.09, 0.09, 4.2, 8)), mat('#ffffff'), 0, 2.1, -1.6, root);
    void pole;
    for (let k = 0; k < 4; k++) add(cached('cpBand', () => new T.CylinderGeometry(0.1, 0.1, 0.4, 8)), mat(color), 0, 0.6 + k * 0.95, -1.6, root);
    const sign = new T.Mesh(cached('cpSign', () => new T.PlaneGeometry(1.6, 1.6)), new T.MeshBasicMaterial({ map: letterTex(letter, color), transparent: true }));
    sign.position.set(0.85, 3.7, -1.6);
    root.add(sign);
    if (big) sign.scale.setScalar(1.3);
    // a chequered strip across the road
    const strip = add(cached('cpStrip', () => new T.PlaneGeometry(0.6, 6.6)), new T.MeshBasicMaterial({ map: cached('chk', () => canvasTex(32, 256, (g) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#ffffff' : INK; g.fillRect(x * 16, y * 16, 16, 16); } })) }), 0, 0.02, -1, root);
    strip.rotation.x = -Math.PI / 2;
    return { root, sign };
  }

  // the brother's bridge: rainbow planks across the crater, laid one by one
  const PLANK = ['#ff5d6c', '#ffb02e', '#ffd400', '#5fd36b', '#3fb7ff', '#9b7bff'];
  function buildBridge(a, b) {
    const root = new T.Group();
    const w = b - a + 1.2;
    const n = Math.max(4, Math.round(w / 0.55));
    const planks = [];
    for (let k = 0; k < n; k++) {
      const p = add(box(w / n - 0.05, 0.16, 2.6), mat(PLANK[k % PLANK.length]), a - 0.6 + (k + 0.5) * (w / n), -0.06, 0, root);
      p.visible = false;
      planks.push(p);
    }
    for (const x of [a - 0.6, b + 0.6]) for (const z of [1.3, -1.3]) add(cached('brPost', () => new T.CylinderGeometry(0.06, 0.06, 0.8, 6)), mat('#ffffff'), x, 0.3, z, root);
    const rope = mat('#ffd400');
    for (const z of [1.3, -1.3]) add(box(w, 0.05, 0.05), rope, (a + b) / 2, 0.62, z, root);
    return { root, planks, t: 0 };
  }

  // ---------------------------------------------------------------- the ground: one piece per section, craters cut in

  // stages A–E, E–J, J–O, O–T, T–Z each have their own moon colours
  const PALETTES = [
    { top: '#c9b8ff', side: '#9a83e6', deep: '#6f58c4', speck: '#ffffff', sign: '#7c5cff' },
    { top: '#a6f0d8', side: '#5fc4a4', deep: '#3a9a7f', speck: '#ffffff', sign: '#24b38a' },
    { top: '#ffd0b0', side: '#f09a6a', deep: '#c96d3f', speck: '#fff3e6', sign: '#ff7a3d' },
    { top: '#b8dcff', side: '#7aaaf0', deep: '#4f7fd0', speck: '#ffffff', sign: '#3f86e8' },
    { top: '#ffe89a', side: '#f0c04a', deep: '#c99520', speck: '#ffffff', sign: '#ff9f1c' },
  ];
  const groundMats = [];
  function groundMat(stage) {
    if (groundMats[stage]) return groundMats[stage];
    const P = PALETTES[stage];
    const cap = canvasTex(256, 256, (g) => {
      // rock layers with pebbles: the side of the moon you see
      const bands = [P.side, G.shade(P.side, -0.06), P.side, G.shade(P.side, -0.12), G.shade(P.side, -0.04), P.deep];
      for (let k = 0; k < 8; k++) { g.fillStyle = bands[k % bands.length]; g.fillRect(0, k * 32, 256, 32); }
      for (let k = 0; k < 40; k++) {
        g.fillStyle = `rgba(255,255,255,${0.12 + 0.18 * ((k * 37) % 7) / 7})`;
        g.beginPath(); g.ellipse((k * 97) % 256, (k * 53) % 256, 4 + (k % 5) * 2, 3 + (k % 3) * 2, 0, 0, Math.PI * 2); g.fill();
      }
    }, [1 / 7, 1 / 7]);
    const top = canvasTex(256, 256, (g) => {
      g.fillStyle = G.shade(P.top, -0.1); g.fillRect(0, 0, 256, 256);
      for (let k = 0; k < 60; k++) {
        g.fillStyle = k % 3 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.35)';
        g.beginPath(); g.arc((k * 89) % 256, (k * 61) % 256, 2 + (k % 4) * 2.5, 0, Math.PI * 2); g.fill();
      }
    }, [1 / 5, 1 / 5]);
    return (groundMats[stage] = [mat('#ffffff', { map: cap, roughness: 0.9 }), mat('#ffffff', { map: top, roughness: 0.85 })]);
  }
  const Z_BACK = -4.5, DEPTH = 7, BASE = -7;
  // one stretch of ground from x0 to x1 with these craters (sorted)
  function buildGround(x0, x1, craters, stage) {
    const s = new T.Shape();
    s.moveTo(x0, BASE);
    s.lineTo(x0, 0);
    for (const c of craters) {
      const w = c.b - c.a, d = Math.min(1.7, 0.42 * w + 0.4);
      s.lineTo(c.a - 0.35, 0);
      s.lineTo(c.a - 0.1, 0.12); // a little rim
      for (let k = 0; k <= 12; k++) {
        const th = (Math.PI * k) / 12;
        s.lineTo(c.a + (w * (1 - Math.cos(th))) / 2, -d * Math.sin(th));
      }
      s.lineTo(c.b + 0.1, 0.12);
      s.lineTo(c.b + 0.35, 0);
    }
    s.lineTo(x1, 0);
    s.lineTo(x1, BASE);
    s.lineTo(x0, BASE);
    const geo = new T.ExtrudeGeometry(s, { depth: DEPTH, bevelEnabled: false, steps: 1 });
    const m = new T.Mesh(geo, groundMat(stage));
    m.position.z = Z_BACK;
    return m;
  }
  // little moon crystals and pebbles at the back of the road (never on it), for fun
  function buildDecor(x0, x1, stage, seed) {
    const g = new T.Group();
    const P = PALETTES[stage];
    let r = seed;
    const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let x = x0 + 3; x < x1 - 3; x += 6 + rnd() * 10) {
      const kind = rnd();
      if (kind < 0.4) {
        // a shiny half-buried moon bubble
        const b = add(cached('bub', () => new T.SphereGeometry(0.4, 14, 10)), mat(rnd() < 0.5 ? '#ffffff' : P.sign, { roughness: 0.25, emissive: P.sign, emissiveIntensity: 0.12 }), x, -0.05, Z_BACK + 0.5 + rnd() * 0.6, g);
        b.scale.setScalar(0.6 + rnd() * 0.7);
      } else {
        const p = add(cached('peb', () => new T.IcosahedronGeometry(0.3, 0)), mat(G.shade(P.top, -0.15), { flatShading: true }), x, 0.1, Z_BACK + 0.5 + rnd() * 1.2, g);
        p.scale.set(1 + rnd(), 0.5, 1);
      }
    }
    return g;
  }

  // ---------------------------------------------------------------- space behind: stars, a smiley Earth, far hills

  function makeBackdrop(scene) {
    const group = new T.Group();
    scene.add(group);
    scene.background = canvasTex(4, 256, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#0d0a2e'); gr.addColorStop(0.55, '#2a1a66'); gr.addColorStop(1, '#5a2f8f');
      g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    });
    // stars: one big sheet far away, which slides along with the camera (they barely move: they're very far)
    const N = 700, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 420;
      pos[i * 3 + 1] = -10 + Math.random() * 130;
      pos[i * 3 + 2] = -150;
      const c = new T.Color(['#ffffff', '#ffe9a8', '#bfe3ff', '#ffc8ec'][i % 4]);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const sg = new T.BufferGeometry();
    sg.setAttribute('position', new T.BufferAttribute(pos, 3));
    sg.setAttribute('color', new T.BufferAttribute(col, 3));
    const stars = new T.Points(sg, new T.PointsMaterial({ size: 1.1, map: TEX.sparkle, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    group.add(stars);
    // the Earth, smiling
    const earth = spriteOf(canvasTex(256, 256, (g) => {
      const gr = g.createRadialGradient(100, 90, 10, 128, 128, 120);
      gr.addColorStop(0, '#7fd4ff'); gr.addColorStop(1, '#2a6fd0');
      g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5fd36b';
      for (const [x, y, rx, ry] of [[80, 90, 40, 26], [170, 150, 46, 34], [110, 190, 30, 18], [190, 70, 20, 14]]) { g.beginPath(); g.ellipse(x, y, rx, ry, 0.4, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.75)';
      for (const [x, y, rx] of [[150, 60, 34], [70, 160, 28]]) { g.beginPath(); g.ellipse(x, y, rx, 9, -0.2, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = INK; g.lineWidth = 9; g.lineCap = 'round';
      g.fillStyle = INK;
      for (const x of [100, 156]) { g.beginPath(); g.ellipse(x, 116, 9, 13, 0, 0, Math.PI * 2); g.fill(); }
      g.beginPath(); g.arc(128, 140, 34, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
      g.fillStyle = 'rgba(255,110,150,0.6)';
      for (const x of [78, 178]) { g.beginPath(); g.ellipse(x, 146, 15, 9, 0, 0, Math.PI * 2); g.fill(); }
    }), 22);
    earth.position.set(40, 40, -140);
    group.add(earth);
    // far hills: two rows of soft bumps, tiled along the course
    const rows = [];
    for (const [z, color, hgt, seed] of [[-70, '#4b3a93', 16, 3], [-38, '#6a54b8', 9, 7]]) {
      const W = 240;
      const sh = new T.Shape();
      sh.moveTo(0, -30);
      let r = seed;
      const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
      const pts = [];
      for (let x = 0; x <= W; x += 6) pts.push([x, hgt * (0.35 + 0.5 * Math.abs(Math.sin(x * 0.035 + seed)) + 0.15 * rnd())]);
      pts[pts.length - 1][1] = pts[0][1];
      for (const [x, y] of pts) sh.lineTo(x, y);
      sh.lineTo(W, -30);
      const geo = new T.ShapeGeometry(sh);
      const m = new T.MeshBasicMaterial({ color });
      const copies = [0, 1, 2, 3].map(() => { const o = new T.Mesh(geo, m); o.position.z = z; scene.add(o); return o; });
      rows.push({ copies, W });
    }
    return {
      update(camX, camY) {
        group.position.x = camX * 0.96;
        group.position.y = camY * 0.5;
        for (const r of rows) {
          const k0 = Math.floor((camX - r.W * 1.5) / r.W);
          r.copies.forEach((o, i) => { o.position.x = (k0 + i) * r.W; });
        }
      },
    };
  }

  // ---------------------------------------------------------------- effects: stardust, puffs, word bursts, confetti

  function makeFx(scene) {
    const live = [];
    const pools = {};
    const confGeo = new T.PlaneGeometry(0.24, 0.14);
    function take(kind, make) {
      const p = pools[kind] || (pools[kind] = []);
      const o = p.pop() || make();
      o.userData.kind = kind;
      o.visible = true;
      scene.add(o);
      return o;
    }
    function spawn(o, u) {
      Object.assign(o.userData, { vx: 0, vy: 0, vz: 0, g: 0, life: 1, max: 1, s0: 1, s1: 1, spin: 0, drag: 0, fade: true }, u);
      o.userData.max = o.userData.life;
      live.push(o);
      return o;
    }
    function stardust(x, y, n = 14, color = '#ffffff', spread = 5) {
      for (let k = 0; k < n; k++) {
        const s = take('sp', () => spriteOf(TEX.sparkle, 1, { blending: T.AdditiveBlending }));
        s.material.color.set(k % 3 ? color : '#ffffff');
        s.position.set(x, y, 0.6);
        const a = Math.random() * Math.PI * 2, v = spread * (0.3 + Math.random() * 0.8);
        spawn(s, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: (Math.random() - 0.5) * 2, life: 0.5 + Math.random() * 0.5, s0: 0.4 + Math.random() * 0.5, s1: 0.05, drag: 2.5 });
      }
    }
    function puff(x, y, n = 5, size = 1.2) {
      for (let k = 0; k < n; k++) {
        const s = take('pf', () => spriteOf(TEX.puff, 1));
        s.position.set(x + (Math.random() - 0.5) * 0.8, y + Math.random() * 0.5, 0.8);
        const a = Math.random() * Math.PI;
        spawn(s, { vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.2, life: 0.6 + Math.random() * 0.3, s0: size * 0.6, s1: size * 1.4, drag: 2 });
      }
    }
    function word(x, y, text, fill = '#ffd400', size = 3) {
      const tex = wordTex(Kit.lang.t(text), fill);
      const s = take('wd', () => spriteOf(tex, 1));
      s.material.map = tex;
      s.material.needsUpdate = true;
      s.position.set(x, y, 2);
      s.renderOrder = 20;
      s.material.depthTest = false;
      spawn(s, { life: 1.0, s0: size * 0.55, s1: size, vy: 2.2, aspect: 160 / 512 });
    }
    function confetti(x, y, n = 40, spread = 8) {
      const colors = ['#ff5d6c', '#ffd400', '#5dffc4', '#6fd8ff', '#ff8fc8', '#b99bff'];
      for (let k = 0; k < n; k++) {
        const c = take('cf', () => new T.Mesh(confGeo, new T.MeshBasicMaterial({ color: '#ffffff', side: T.DoubleSide, transparent: true })));
        c.material.color.set(colors[k % colors.length]);
        c.position.set(x, y, 1);
        const a = Math.random() * Math.PI, v = spread * (0.3 + Math.random() * 0.8);
        c.rotation.set(Math.random() * 6, Math.random() * 6, 0);
        spawn(c, { vx: Math.cos(a) * v, vy: Math.sin(a) * v + 3, vz: (Math.random() - 0.5) * 3, g: 7, life: 1.6 + Math.random() * 0.8, spin: 9, drag: 1.2, s0: 1.3, s1: 1.1 });
      }
    }
    function splat(x, y, color = '#9dff6a') {
      for (let k = 0; k < 7; k++) {
        const s = take('gb', () => new T.Mesh(cached('gooBit', () => new T.SphereGeometry(0.12, 6, 5)), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true })));
        s.material.color.set(color);
        s.position.set(x, y + 0.1, 0.4);
        const a = 0.3 + Math.random() * (Math.PI - 0.6), v = 2 + Math.random() * 3;
        spawn(s, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 12, life: 0.5, s0: 1, s1: 0.5 });
      }
    }
    function emoji(e, x, y, o = {}) {
      const s = take(`em${e}`, () => spriteOf(emojiTex(e), 1));
      s.position.set(x, y, 2);
      return spawn(s, Object.assign({ life: 1, s0: 0.9, s1: 0.9 }, o));
    }
    function update(dt) {
      for (let k = live.length - 1; k >= 0; k--) {
        const o = live[k], u = o.userData;
        u.life -= dt;
        if (u.life <= 0) {
          live.splice(k, 1);
          scene.remove(o);
          o.visible = false;
          (pools[u.kind] || (pools[u.kind] = [])).push(o);
          continue;
        }
        const f = Math.exp(-u.drag * dt);
        u.vx *= f; u.vz *= f; u.vy = u.vy * f - u.g * dt;
        o.position.x += u.vx * dt;
        o.position.y += u.vy * dt;
        o.position.z += u.vz * dt;
        const k01 = 1 - u.life / u.max;
        const s = u.s0 + (u.s1 - u.s0) * k01;
        if (o.isSprite) o.scale.set(s, s * (u.aspect || 1), 1);
        else { o.scale.setScalar(s); o.rotation.x += u.spin * dt; o.rotation.y += u.spin * 0.7 * dt; }
        if (u.fade && o.material) o.material.opacity = Math.min(1, (u.life / u.max) * 2.2);
      }
    }
    function clear() {
      for (const o of live) { scene.remove(o); o.visible = false; (pools[o.userData.kind] || (pools[o.userData.kind] = [])).push(o); }
      live.length = 0;
    }
    return { stardust, puff, word, confetti, splat, emoji, update, clear, count: () => live.length };
  }

  MB.art = {
    initTextures, buildBuggy, buildRocket, buildRock, buildJelly, buildGoo, buildShot, buildCheckpoint, buildBridge,
    buildGround, buildDecor, makeBackdrop, makeFx, emojiSprite, PALETTES, BUGGY, WHEEL_R, WHEEL_X, Z_BACK,
  };
})();
