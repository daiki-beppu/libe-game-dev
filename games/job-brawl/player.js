'use strict';
// JOB BRAWL — プレイヤーの移動と技の進行
function updatePlayer(p, inp) {
  if (p.dying > 0) {
    p.x += p.kbx; p.y += p.kby; p.kbx *= KB_FRICTION; p.kby *= KB_FRICTION;
    if (--p.dying === 0) loseStock(p);
    return;
  }
  if (p.inv > 0) p.inv--;
  if (p.cd > 0) p.cd--;

  const len = Math.hypot(inp.dx, inp.dy);
  const mx = len > 0 ? inp.dx / len : 0, my = len > 0 ? inp.dy / len : 0;
  if (inp.atk) p.buffer = { which: 'attack', t: 8 };
  if (inp.sp) p.buffer = { which: 'special', t: 8 };

  let moveMul = 1;
  p.guarding = false;
  if (p.hitstun > 0) {
    p.hitstun--;
    moveMul = 0.15; // ふっとび中もわずかに方向をずらせる
  } else {
    if (!p.action) {
      if (len > 0) { p.fx = mx; p.fy = my; }
      if (inp.face) { p.fx = inp.face.x; p.fy = inp.face.y; }
      if (p.buffer && tryStart(p, p.buffer.which)) p.buffer = null;
    }
    if (p.action) { moveMul = MOVE_MUL[p.action.move.kind]; updateAction(p); }
  }
  if (p.buffer && --p.buffer.t <= 0) p.buffer = null;

  const sp = p.job.speed * moveMul;
  p.x += mx * sp + p.kbx;
  p.y += my * sp + p.kby;
  p.kbx *= KB_FRICTION; p.kby *= KB_FRICTION;
  if (Math.hypot(p.kbx, p.kby) > 5 && game.frame % 2 === 0) {
    spawnParticle(p.x, p.y, 0, 0, 'rgba(255,255,255,0.5)', 5, 18);
  }

  const out = Math.hypot(p.x - CX, p.y - CY) > STAGE_R;
  if (out) { if (++p.edgeT > EDGE_GRACE) startDying(p); }
  else p.edgeT = 0;
}

function tryStart(p, which) {
  const m = p.job[which];
  if (which === 'special' && p.cd > 0) return false;
  p.action = { which, move: m, t: 0, hit: new Set(), total: m.startup + (m.active || 1) + m.recovery };
  if (which === 'special') p.cd = m.cooldown || 0;
  return true;
}

function updateAction(p) {
  const a = p.action, m = a.move;
  a.t++;
  const activeStart = m.startup + 1, activeEnd = m.startup + (m.active || 1);
  const isActive = a.t >= activeStart && a.t <= activeEnd;
  const o = game.players[1 - p.i];

  switch (m.kind) {
    case 'melee':
      if (isActive) cutProjectiles(p, m);
      if (isActive && !a.hit.has(o) && canBeHit(o) && inArc(p, o, m)) {
        a.hit.add(o); hit(p, o, m, dirTo(p, o));
      }
      break;
    case 'projectile':
      if (a.t === activeStart) fire(p, m);
      break;
    case 'dash':
      if (isActive) {
        p.x += p.fx * m.dashSpeed; p.y += p.fy * m.dashSpeed;
        spawnParticle(p.x, p.y, 0, 0, hexA(p.job.color, 0.5), PLAYER_R, 12);
        if (!a.hit.has(o) && canBeHit(o) && dist(p, o) < m.radius + PLAYER_R) {
          a.hit.add(o);
          const d = dirTo(p, o);
          hit(p, o, m, norm(d.x + p.fx, d.y + p.fy));
        }
      }
      break;
    case 'nova':
      if (a.t === activeStart) {
        p.damage = Math.max(0, p.damage - (m.heal || 0));
        game.rings.push({ x: p.x, y: p.y, r: 10, maxR: m.radius, life: 20, max: 20, color: '#ffe38a' });
        if (m.heal) game.texts.push({ x: p.x, y: p.y - 40, text: `-${m.heal}%`, life: 40, max: 40, color: '#8dffb0', size: 16 });
        if (canBeHit(o) && dist(p, o) < m.radius + PLAYER_R) hit(p, o, m, dirTo(p, o));
      }
      break;
    case 'guard':
      if (isActive) p.guarding = true;
      break;
  }
  if (a.t >= a.total && p.action === a) p.action = null;
}

function inArc(p, o, m) {
  const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy);
  if (d > m.range + PLAYER_R) return false;
  if (m.arc >= 180) return true;
  const ang = Math.atan2(dy, dx) - Math.atan2(p.fy, p.fx);
  const diff = Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang)));
  return diff <= m.arc * Math.PI / 180 + Math.atan2(PLAYER_R, Math.max(d, 1));
}
