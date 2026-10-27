/* 中文 for TT Moon Buggy: the words on the page, the toasts, the banners and the ? panel (Kit.lang, from kit/lang.js).
   The word bursts drawn in 3D (POOF!, POP!...) go through Kit.lang.t() in js/art.js.
   The kids' names and the checkpoint letters stay as they are; the game's name becomes 月球车 (the brief's own Chinese name). */
(function () {
  const L = Kit.lang;
  L.keep(['TEDDY', 'TOMMY', 'Teddy', 'Tommy', 'TEDDY & TOMMY', 'TEDDY + TOMMY', 'TT', 'Claude Code', 'Esc', 'P · Esc · M']);

  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', JUICE: '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };

  L.add({
    // the name
    [MB.TITLE]: MB.ZH, 'MOON BUGGY': MB.ZH,

    // title screen
    'Bounce across the moon! Jump the craters, zap the boulders and pop the space jellies, from A to Z.':
      '开着月球车蹦蹦跳跳！跳过陨石坑，打碎大石头，戳破太空果冻，从 A 一直开到 Z！',
    '1 player · key 1': '单人 · 按 1', '1 player · key 2': '单人 · 按 2', '2 players take turns · key 3': '双人轮流玩 · 按 3',
    Difficulty: '难度',
    '🐣 EASY': '🐣 简单', 'slow, long jumps, soft rocks': '慢慢开，跳得远，石头软软的',
    '🔥 NORMAL': '🔥 普通', 'for big kids': '大孩子玩',
    'START AT': '出发点', 'Start at': '出发点', 'Reach this letter to start here': '先开到这个字母，才能从这里出发',
    'faster · slower': '加速 · 减速', 'zap (both cannons)': '发射（两门炮一起）', 'easy or normal': '简单或普通', 'start point': '出发点',
    '◀ slows down and ▶ speeds up. The big button jumps, the sparkle zaps (the front cannon and the top cannon), and your brother\'s face calls him in.':
      '◀ 减速，▶ 加速。大按钮是跳，闪闪的按钮是发射（前面的炮和上面的炮一起打），点兄弟的头像就能叫他来帮忙。',
    'LOADING…': '加载中…',

    // the HUD and touch buttons
    'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)', 'HIGH FIVE': '击掌',
    SLOWER: '减速', FASTER: '加速', ZAP: '发射', JUMP: '跳',

    // pause
    '↻ START AGAIN': '↻ 重新开始',
    'P · Esc · Space to go on · R start again · Q menu · M sound': 'P · Esc · 空格 继续 · R 重新开始 · Q 菜单 · M 声音',

    // results
    'GREAT DRIVING!': '开得真棒！', 'YOU MADE IT TO Z!': '你开到 Z 啦！', 'WHAT A TIE!': '平局！', 'NEW HI-SCORE!': '新的最高分！',
    'HI-SCORE': '最高分', '↻ PLAY AGAIN': '↻ 再玩一次', '▶ KEEP GOING': '▶ 继续开',
    'Enter play again · K keep going · Esc menu': 'Enter 再玩一次 · K 继续开 · Esc 菜单',

    // toasts, banners and word bursts
    'STICKY GOO! SLOW...': '黏黏的果冻！变慢啦…', 'OOPS! INTO A CRATER': '哎呀！掉进陨石坑啦', 'HIGH FIVE!': '击掌！',
    'GET READY': '准备好！', 'KEEP GOING!': '继续加油！', 'GO!': '出发！',
    'POOF!': '噗！', 'POP!': '啵！', 'BOING!': '嘣！', 'BONK!': '咚！', 'SPLAT!': '啪叽！',

    // the ? panel
    faster: '加速', slower: '减速', 'zap (front and top cannons)': '发射（前炮和顶炮）',
    'title: Teddy · Tommy · both · easy · start point': '标题页：Teddy · Tommy · 一起 · 简单 · 出发点',
    '→ or D': '→ 或 D', '← or A': '← 或 A', '↑ or Space or W': '↑ 或 空格 或 W', 'X or Z or F': 'X 或 Z 或 F', 'T or Enter': 'T 或 回车', 'P or Esc · M': 'P 或 Esc · M',
    'Jump the craters and the little rocks, zap the big boulders ahead and the space jellies overhead. Two players take turns: a bump or a new part of the moon passes the buggy. Call your brother as often as you like: he lays a bridge over the next crater.':
      '跳过陨石坑和小石头，用炮打碎前面的大石头和头顶上的太空果冻。两个人轮流开：撞一下或者开到月球的新地方，就换另一个人开。想叫兄弟几次都行：他会在下一个陨石坑上搭一座桥。',
    '◀ slows down, ▶ speeds up; the big button jumps, the sparkle zaps, and your brother\'s face calls him in.':
      '◀ 减速，▶ 加速；大按钮是跳，闪闪的按钮是发射，点兄弟的头像叫他来帮忙。',
  });

  L.rule(/^POINT ([A-Z])$/, '检查点 $1');
  L.rule(/^TIME (\d+)$/, '时间 $1');
  L.rule(/^TIME (\d+) · BONUS \+(\d+)$/, '用时 $1 秒 · 奖励 +$2');
  L.rule(/^HI-SCORE (\d+)$/, '最高分 $1');
  L.rule(/^HI-SCORE 🐣 (\d+) · 🔥 (\d+)$/, '最高分 🐣 $1 · 🔥 $2');
  L.rule(/^Start at ([A-Z])$/, '从 $1 出发');
  L.rule(/^ON TO ([A-Z])!$/, '向 $1 出发！');
  L.rule(/^CALL (TEDDY|TOMMY)$/, '叫 $1');
  L.rule(/^(TEDDY|TOMMY)'S TURN!$/, '轮到 $1 啦！');
  L.rule(/^(TEDDY|TOMMY) WINS!$/, '$1 赢啦！');
  L.rule(/^(TEDDY|TOMMY) IS OUT OF BUGGIES$/, '$1 的月球车用完啦');
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE|COOKIE|WATERMELON|BANANA) FROM (TEDDY|TOMMY)!$/, (m, e, item, who) => `${e} ${who} 送来的${TREAT[item]}！`);
  L.rule(/^(TEDDY|TOMMY) SAYS: BRIDGE COMING!$/, '$1 说：桥来啦！');
  L.rule(/^(TEDDY|TOMMY) SAYS: NO MORE CRATERS!$/, '$1 说：前面没有陨石坑啦！');
  L.rule(/^BYE BYE, (TEDDY|TOMMY)!$/, '拜拜，$1！');
  L.rule(/^(.+) · NEW HI-SCORE!$/, (m, a) => `${L.t(a)} · 新的最高分！`);
})();
