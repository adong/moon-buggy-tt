/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: MB.TITLE, // the name lives in js/title.js
  keys: [
    ['faster', '→ or D'],
    ['slower', '← or A'],
    ['jump', '↑ or Space or W'],
    ['zap (front and top cannons)', 'X or Z or F'],
    ['call your brother · high five', 'T or Enter'],
    ['pause · sound', 'P or Esc · M'],
    ['title: Teddy · Tommy · both · easy · start point', '1 2 3 E S'],
  ],
  note: 'Jump the craters and the little rocks, zap the big boulders ahead and the space jellies overhead. Two players take turns: a bump or a new part of the moon passes the buggy. Call your brother as often as you like: he lays a bridge over the next crater.',
  touch: '◀ slows down, ▶ speeds up; the big button jumps, the sparkle zaps, and your brother\'s face calls him in.',
});
