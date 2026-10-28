# TT Moon Buggy

[![TT Moon Buggy title screen](docs/screenshot.jpg)](https://adong.github.io/moon-buggy-tt/)

Press **?** any time (or tap the round **?** button on the left edge) to see the keys. The game waits while you look.
Tap the language button under it (the A文 icon) to switch between English and 中文; the dashboard and every game remember the choice.

**中文：** 月球车：开着蹦蹦跳跳的六轮月球车，从检查点 A 一直开到 Z！按 ↑ 跳过陨石坑和小石头，按 X 用前面的炮打碎大石头、用上面的炮戳破太空果冻（它们会滴黏黏的果冻，慢下来就能躲开）。每到一个检查点都有时间奖励。叫兄弟来，他会坐着小火箭飞过来，在下一个陨石坑上搭一座彩虹桥。

An arcade moon-driving game for Teddy and Tommy, in our own style. You drive a bouncy six-wheeled toy buggy to the right across a candy-coloured moon, with a smiling Earth in the sky. → speeds up, ← slows down, ↑ or Space jumps (a long, floaty moon jump). Jump the craters and the sleepy little rocks, zap the worried-looking boulders ahead with the front cannon, and pop the space jellies overhead with the top cannon: X fires both at once. Checkpoints A to Z each give a time bonus. Nobody gets hurt: a crater is a soft plop and a BOING! back out, a rock is a BONK! and a dizzy spin, boulders go POOF! into stardust and jellies go POP!

It's built with Claude Code from plain JavaScript and Three.js, like Metro Surfer and the other Teddy & Tommy games. There are no image, model or audio files: the buggy, rocks, jellies, rocket and moon are boxes, balls and extruded shapes with canvas faces, Teddy and Tommy come from the shared kit (`kit/`), and every sound is synthesised.

The name lives in one place, [js/title.js](js/title.js) (with its Chinese name, 月球车, for the 中文 logo).

## Play

- **Double-click `index.html`.** It works offline, because Three.js and the kit are copied into `kit/`. Without internet the logo falls back from the Bungee font to Arial Black.
- **Send one file:** `dist/moon-buggy-tt.html` is the whole game in one file. AirDrop or email it, then open it in a browser.
- **Rebuild that file** after any edit: `python3 kit/tools/bundle.py . --name moon-buggy-tt`
- **Get kit updates** from `~/claude-games/kit`: `python3 ../kit/tools/sync.py .`, then rebuild.
- **On the title screen** pick TEDDY, TOMMY or TEDDY + TOMMY (keys 1, 2, 3), 🐣 EASY or 🔥 NORMAL (key E), and where to START AT (key S): A, plus E, J, O and T once you've driven that far on that level. Behind the menu the autopilot drives a demo.
- **The course** is one long strip of moon with 26 checkpoints, A to Z. Every five letters the moon changes colour: lavender (A to E), mint (E to J), peach (J to O), sky blue (O to T) and lemon (T to Z). Craters and little rocks from A, big boulders from E, space jellies from J, and the craters get wider and closer together further on.
- **Checkpoints:** each letter flashes "POINT C · TIME 14 · BONUS +150". The bonus is 100, plus 10 for every whole second under the section's par time (the time at cruising speed plus a few seconds), so driving fast pays. The bar at the top shows the letters of the part you're on.
- **Score:** jumping over a crater or rock 20, a rock zapped 50, a boulder 100, a jelly popped 100, a goo drop popped 20, your brother's treat 50, a high five 50, a checkpoint 100 and up, reaching Z 500.
- **The end:** reach Z and you hop up out of the buggy doing your signature move (Teddy's boxing and 🏀 jump shot, Tommy's ✌️ Y) with confetti, then the results: the letter you reached, the score and the HI-SCORE (⭐ NEW HI-SCORE! when you beat it). Out of buggies, you also get ▶ KEEP GOING: all your buggies back, right where you were, score kept. ↻ PLAY AGAIN starts over; MENU goes back.
- **Saved per browser:** the level, who played last, the start point, the start points you've opened on each level, and the HI-SCORE for each level.

### Levels

| | 🐣 EASY (Tommy, 5) | 🔥 NORMAL (Teddy, 8) |
|---|---|---|
| Buggies | 5 | 3 |
| Speed (slow · cruise · fast) | 4 · 7 · 10 m/s | 6 · 10 · 15 m/s |
| Jump | 1.5 s in the air, 2.8 m high: clears every crater even from the slowest speed | 1.0 s, 1.75 m: a wide crater needs good timing or some speed |
| Rocks and boulders | a soft bump: BOING! over it, slowed down a moment, no buggy lost | a BONK!, one buggy; a boulder takes two zaps (it cracks into a little rock first) |
| Craters | 2.4 to 4.2 m wide, a forgiving edge | 2.6 to 5.6 m wide |
| Space jellies | 1 or 2 per section from J; a drop of goo every 5 or 6 s; goo just makes you sticky and slow for a second | 2 or 3 per section from J, quicker drops; goo is a SPLAT!, one buggy |
| Sections | 110 m | 140 m |

Before it drops goo, a jelly wobbles over you for 0.6 s: slow down and the goo lands in front of you, or zap it (the top cannon pops goo too). After a bump you're put back on the road a little before the trouble spot, rolling slowly, safe from goo for a moment.

### Two players

Teddy + Tommy take turns with one buggy each, each on his own moon (his own rocks zapped and bridges laid), with his own buggies and score. A lost buggy or the end of a part of the moon (E, J, O, T) passes the buggy: "TOMMY'S TURN!". When one brother is out of buggies the other keeps going. The winner is whoever got furthest (then the higher score); he hops up doing his signature move. T (or Enter, or the faces in the bar) is a high five: the other brother zooms in on his rocket, +50.

## Controls

| | Keys |
|---|---|
| faster · slower | → or D · ← or A |
| jump | ↑ or Space or W |
| zap (front and top cannons) | X or Z or F (hold to keep zapping) |
| call your brother · high five | T or Enter |
| pause · sound | P or Esc · M |

The faster you go, the further right the buggy sits on the screen, and slowing down slides it back left, so → really moves it right and ← left. A jump press just before you land still counts.

**Touch:** ◀ SLOWER and ▶ FASTER at the bottom left, the big ⤴ JUMP and the ✨ ZAP button at the bottom right, and in 1 player your brother's face above them (on an iPad they all sit in a strip under the play area, so the moon gets the whole width). In 2 players the two faces in the bar are the high five. The ?, A文 and sound buttons on the left edge never sit on the play area or the touch controls.

## Companion

In 1 player, press T (or Enter, or tap his face) any time, as often as you like. Your brother (Tommy for Teddy, Teddy for Tommy) flies over in his own little rocket with his name over it, does his signature move, and tosses you a treat (🍦 💧 🧃 🍪 🍉 🍌, +50). Then "TOMMY SAYS: BRIDGE COMING!": he zooms ahead and lays a rainbow bridge over the next crater, plank by plank, so you can drive straight over it. Every call is another bridge on the next crater after that. When there are no craters left he says so; when he's done he waves and flies off.

## How it was checked

- **The headless check:** `node tools/check.js --fails` (about 2 s), the same as `game.check()` and `game.checkFails()` in the page. Nine rules from the brief:
  - **a jump on EASY clears every crater:** all 34 EASY craters, jumping from 0 to 2 m before the edge at the slowest, cruising and fastest speeds (510 jumps), never plop;
  - **both cannons hit what they aim at:** the front cannon zaps a rock or boulder 4, 10 and 17 m ahead on both levels (a NORMAL boulder cracks first), but never the rock behind or one 70 m away; the top cannon pops the jelly right overhead at 5.5 and 7.5 m and the goo over you, but not a jelly 5 m to the side;
  - **checkpoint times and bonuses:** the course is A to Z in order; driving a section at cruising speed takes exactly its length ÷ speed (15.71 s EASY, 14.00 s NORMAL) for a bonus of 150 / 140; a slow section takes longer for less, a fast one shorter for more; every bonus is 100 + 10 per whole second under par, and the score is exactly the bonuses;
  - **the same at 30, 60 and 120 fps:** a fixed timeline of keys (speed changes, jumps, zaps, a companion call) on three courses ends with the same position, speed, score, buggies and event list at all three frame rates (the rules tick at 120 Hz in whole units of 1/360000 s);
  - **every course can be passed:** the autopilot drives A to Z on EASY (about 395 s) and NORMAL (about 352 s) without losing a buggy or a single soft bump, through every crater, rock, boulder and jelly; and from every comeback spot after a bump (81 on EASY, 129 on NORMAL), starting slow, it gets past the trouble; craters are never wider than the slowest jump, things never closer than the minimum gap, never on a checkpoint;
  - plus **the companion** (4 calls, 4 bridges, the next crater ahead each time, drive straight over a bridged crater, Teddy for Tommy and Tommy for Teddy, a high five in 2 players), **two players take turns** (after a lost buggy and at E), and **nothing leaves you stuck** (soft bumps keep you rolling, a crater pops you back out, sticky goo wears off, out of buggies ends the game).
- **The fail variant:** eight broken versions each make the check fail: a short EASY jump, a front cannon that misses, a top cannon aimed off to the side, a missing bonus, a speed drag applied once per frame instead of per tick, one too-wide crater, a soft bump that stops the buggy for good, and a crater you never come out of.
- **Played with real keys:** `node tools/play.js` (and `URL=file://…/index.html?touch=1 node tools/play.js` for touch) runs [tools/play-checks.js](tools/play-checks.js) in headless Chrome, muted: real keydown / keyup events on `window` and real pointer events on the buttons, with the game's own animation frames, measured from the picture (the buggy's drawn position through the game's camera). On both levels, from all five start points (each part of the moon), as Teddy and as Tommy, and on each brother's turn in 2 players, with all three key sets: → moves the buggy right on the screen and speeds up, ← moves it left and slows down, the jump goes up the screen and lands, and a zap fires both cannons. Title keys, P, Q and E work. Stuck: a crater on both levels, a NORMAL rock bonk, EASY sticky goo and a soft bump all give the controls back within 3 s; a key held through the pause, a lost window or the ? panel is let go; calling your brother mid-jump and from inside a crater; KEEP GOING and PLAY AGAIN; and 9 s of a keyboard kid mashing keys never leaves the buggy off the road for 3 s. Touch: ▶ moves it right, ◀ left, jump, zap and his face work, and a cancelled touch lets go. Then it breaks the game on purpose and those checks must fail: mirrored ← → and a crater you never come out of, both caught. Last runs: 34 of 34 with keys (1280x800), 36 of 36 with `?touch=1`.
- **中文:** `node tools/shoot.js tools/lang-tour.json` visits every screen, toast, banner and word burst (title, ? panel, GO, checkpoints, the companion, sticky goo, a crater, a stage end, pause, no craters left, the win and the lose results, a high five, a turn, 2P results): `Kit.lang.untranslated()` is `[]` in 中文, and English mode shows no Chinese anywhere (only the kit's own language button says "English / 中文"). Sounds are counted in `game.sfx` while muted.
- **Layouts:** `tools/layout.js` at phone portrait 390x844 and landscape 740x360, iPad 1024x768, 1180x820 and 820x1180, 1P and 2P, with touch: the kit's left-edge buttons never cover the play area or a touch control, no touch control sits on the play area, the bar or another control, nothing scrolls, and the smallest tap target is 60 px (a phone sideways).
- **The single page** `dist/moon-buggy-tt.html` and `index.html` both boot from file:// in headless Chrome, the autopilot drives, and the in-page check passes 9 of 9. No console errors.

## Files

- `index.html`: the page, its look (CSS), the HUD, screens and touch controls, and the tab / home-screen icon (🌕 on moon-night navy, `#22336b`).
- `js/title.js`: the name. `js/sim.js`: the course and the rules (no Three.js, runs in Node too). `js/bot.js`: the autopilot for the demo and the checks. `js/check.js`: the headless check and its fail variant.
- `js/art.js`: the buggy, rocket, rocks, jellies, bridges, checkpoints, the moon, the sky and effects. `js/sfx.js`: the sounds. `js/game.js`: everything on screen, the keys and touch, and the `window.game` test hooks.
- `js/keys.js`: the ? panel. `js/zh.js`: 中文.
- `tools/check.js`, `tools/play.js` + `tools/play-checks.js`, `tools/shoot.js` (screenshots, `tools/shots.json` makes `docs/screenshot.jpg`), `tools/lang-tour.js`, `tools/layout.js`.
- `kit/`: the shared kit, synced from `~/claude-games/kit` (never edited here).

## Not verified

- Sound by ear: every test ran muted (sounds were checked in code only).
- Real fingers on a real phone or iPad, iOS Safari, two kids sharing one iPad, and the frame rate on an older iPad (the play checks ran in headless Chrome with software drawing).
- Whether EASY suits a 5-year-old and NORMAL an 8-year-old: tuned with the autopilot, not with Teddy and Tommy.
- The iPad home-screen icon, and a real Finder double-click.
