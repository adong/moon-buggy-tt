/* The 中文 tour (run by tools/shoot.js with tools/lang-tour.json): switch to 中文, visit every screen and toast, and collect
   Kit.lang.untranslated() everywhere; then back in English, look for any Chinese left on the page. */
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const found = new Set();
  const grab = async (where) => { await wait(80); for (const s of Kit.lang.untranslated()) found.add(`${where}: ${s}`); };
  game.keepAwake(true);
  Kit.lang.set('zh');
  game.menu(); game.step(0.5); await grab('title');
  Kit.help.open(); await grab('? panel'); Kit.help.close();
  // 1 player: GO, checkpoint, crater, buddy (treat, says, bridge, bye), sticky goo, stage end
  game.start({ players: ['teddy'], level: 'easy', start: 0 });
  game.step(1.2); await grab('play GO');
  const S = game.sim(), R = S.R;
  game.place(R.C.cps[1].x - 3, 7); game.step(0.8); await grab('checkpoint');
  game.buddy(); game.step(1.8); await grab('buddy treat');
  game.step(1.2); await grab('buddy says');
  game.step(3); await grab('buddy bye');
  R.goo.push({ id: 5555, x: R.x + 0.5, y: 3, vx: R.v, vy: 0 }); R.invuln = 0; game.step(0.5); await grab('sticky');
  const c = R.C.hz.find((h) => h.kind === 'crater' && !h.bridged && h.a > R.x + 5);
  game.place(c.a - 2, 4); game.step(0.6); await grab('crater');
  game.step(2);
  for (const h of R.C.hz) if (h.a > R.x && h.a < R.C.cps[5].x) { if (h.kind === 'crater') h.bridged = true; else h.alive = false; }
  game.place(R.C.cps[4].x - 3, 7); game.step(0.8); await grab('stage');
  game.pause(); await grab('pause'); game.resume();
  // the end: no more craters, the finish, the win results
  const last = R.C.hz.filter((h) => h.kind === 'crater'); for (const h of last) h.bridged = true;
  game.buddy(); game.step(3); await grab('no craters');
  for (const h of R.C.hz) h.alive = false;
  game.place(R.C.cps[25].x - 3, 7); game.step(5); await grab('win results');
  // out of buggies: results with KEEP GOING
  game.start({ players: ['tommy'], level: 'normal', start: 0 }); game.over(); game.step(4); await grab('lose results');
  // 2 players: turn banner, out of buggies, high five, winner
  game.start({ players: ['teddy', 'tommy'], level: 'normal', start: 0 });
  game.buddy(); game.step(0.3); await grab('high five');
  const S2 = game.sim(); const c2 = S2.R.C.hz.find((h) => h.kind === 'crater');
  game.place(c2.a - 2, 6); game.step(2.2); await grab('turn');
  S2.runs[0].lives = 0; S2.runs[0].state = 'out';
  S2.R.lives = 1; S2.R.bonk(null, 'goo'); game.step(5); await grab('2P results');
  Kit.lang.set('en');
  game.menu(); game.step(0.5); await wait(100);
  // (the closed ? panel keeps its last language until it opens again, and the language button names the other language
  // on purpose: those are the kit's; the panel is checked open)
  const cjk = [];
  const HAN = /[㐀-鿿]/;
  const scan = (where) => {
    const it = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = it.nextNode())) {
      if (/^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName) || (!Kit.help.isOpen() && n.parentNode.closest('#kit-help'))) continue;
      if (HAN.test(n.nodeValue)) cjk.push(`${where}: ${n.nodeValue.trim().slice(0, 40)}`);
    }
    for (const el of document.querySelectorAll('[title],[aria-label]')) {
      if (el.closest('#kit-help') && !Kit.help.isOpen()) continue;
      for (const a of ['title', 'aria-label']) { const v = el.getAttribute(a) || ''; if (HAN.test(v) && !/^(中文|English \/ 中文)$/.test(v)) cjk.push(`${where} ${a}: ${v}`); }
    }
  };
  const visits = [['title', () => game.menu()], ['play', () => game.start({ players: ['teddy', 'tommy'] })], ['pause', () => game.pause()], ['results', () => { game.resume(); game.over(); game.step(5); }]];
  for (const [where, go] of visits) { go(); game.step(0.3); await wait(100); scan(where); }
  Kit.help.open(); await wait(100); scan('? panel'); Kit.help.close();
  return JSON.stringify({ untranslated: [...found], chineseInEnglish: cjk, sfx: game.sfx });
})()
