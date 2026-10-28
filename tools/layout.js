/* Layout check (tools/shoot.js tools/layout.json, at each screen size, with ?touch=1): the play area, the touch buttons and
   the kit's ?, A文 and speaker buttons never overlap, everything is on the screen, and the tap targets are big. */
(async () => {
  game.keepAwake(true);
  const out = {};
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, id: el.id || el.className }; };
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const visible = (el) => el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
  for (const players of [['teddy'], ['teddy', 'tommy']]) {
    game.start({ players, level: 'easy' });
    game.step(0.3);
    game.layout();
    await new Promise((r) => setTimeout(r, 600)); // the kit moves and hides its buttons a moment later
    const probs = [];
    const r = game.rect();
    const play = { x: r.x - 4, y: r.y - 4, w: r.w + 8, h: r.h + 8, id: 'play' };
    const kit = [document.getElementById('kit-help-btn'), document.getElementById('kit-lang-btn'), Kit.sound.button()].filter(visible).map(box);
    const pads = ['slowBtn', 'fastBtn', 'jumpBtn', 'zapBtn', 'budBtn'].map((id) => document.getElementById(id)).filter(visible).map(box);
    const bar = box(document.getElementById('bar'));
    for (const k of kit) { if (hit(k, play)) probs.push(`kit ${k.id} over the play area`); for (const p of pads) if (hit(k, p)) probs.push(`kit ${k.id} over ${p.id}`); }
    for (const p of pads) {
      if (hit(p, play)) probs.push(`${p.id} over the play area`);
      if (hit(p, bar)) probs.push(`${p.id} under the bar`);
      if (p.x < 0 || p.y < 0 || p.x + p.w > innerWidth || p.y + p.h > innerHeight) probs.push(`${p.id} off screen`);
      for (const q of pads) if (p !== q && hit(p, q)) probs.push(`${p.id} on ${q.id}`);
    }
    if (hit(bar, play)) probs.push('bar over the play area');
    if (bar.y + bar.h > innerHeight * 0.4) probs.push(`the bar is ${bar.h.toFixed(0)} px tall`);
    if (document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1) probs.push('the page scrolls');
    const smallest = pads.length ? Math.min(...pads.map((p) => Math.min(p.w, p.h))) : 0;
    if (pads.length && smallest < 56) probs.push(`smallest tap target ${smallest.toFixed(0)} px`);
    out[players.length + 'P'] = { play: `${r.w}x${r.h}`, pads: pads.length, smallest: Math.round(smallest), probs };
  }
  return JSON.stringify({ size: `${innerWidth}x${innerHeight}`, touch: document.body.classList.contains('touch'), ...out });
})()
