'use strict';
// JOB BRAWL — CPU の操作
function cpuInput(p, o) {
  const inp = { dx: 0, dy: 0, atk: false, sp: false, face: null };
  const tcx = CX - p.x, tcy = CY - p.y, dc = Math.hypot(tcx, tcy);
  // 崖際・場外ならとにかく中央へ
  if (dc > STAGE_R - 40 || o.dying) { inp.dx = tcx; inp.dy = tcy; return inp; }

  const ai = p.ai;
  if (--ai.t <= 0) { ai.t = 8 + (Math.random() * 12 | 0); ai.strafe = Math.random() < 0.5 ? 1 : -1; }
  const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy);
  const pref = p.job.aiRange;
  let mv;
  if (d > pref + 15) mv = norm(dx, dy);
  else if (d < pref - 40) mv = norm(-dx, -dy);
  else mv = norm(-dy * ai.strafe, dx * ai.strafe); // 相手の周りを回る
  // 端に寄るほど中央へ引き戻す
  const pull = (dc / STAGE_R) ** 2 * 1.5, c = norm(tcx, tcy);
  inp.dx = mv.x + c.x * pull; inp.dy = mv.y + c.y * pull;

  if (!p.action && p.hitstun === 0) {
    const face = norm(dx, dy);
    if (d < pref + 20 && Math.random() < 0.12) { inp.atk = true; inp.face = face; }
    if (p.cd === 0) {
      const k = p.job.special.kind;
      let chance = d < pref + 30 ? 0.03 : 0;
      if (k === 'guard') chance = o.action && d < 130 ? 0.06 : 0;
      if (k === 'nova') chance = d < 110 ? 0.08 : 0;
      if (k === 'dash') chance = d < 200 ? 0.04 : 0;
      if (Math.random() < chance) { inp.sp = true; inp.face = face; }
    }
  }
  return inp;
}
