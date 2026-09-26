'use strict';
// JOB BRAWL — ふっとばし・被弾・飛び道具・落下と残機
// ============================================================
// ふっとばし力の計算（スマブラらしさの肝）
//   hit.base        : 技の固定ふっとばし（jobs.js）
//   hit.growth      : 蓄積ダメージでの伸び率（jobs.js）
//   hit.dmg         : 技のダメージ
//   defender.damage : 被弾後の蓄積ダメージ(%)
//   defender.weight : 重さ（1.0 が標準。大きいほど飛びにくい）
// 戻り値: ふっとばしの初速（px/frame）
//   摩擦 0.92 なので飛距離 ≈ 初速 × 12.5
//   ステージ中央から場外まで 235px → 初速 およそ 19 以上で中央からでも落ちる
//   目安: 戦士の大回転斬りで相手 100% → 中央からでも場外まで飛ぶ
// ============================================================
const KB_MAX = 36;
function computeKnockback(hit, defender) {
  const raw = hit.base + defender.damage * hit.growth;
  // 重さは半分だけ効かせる（重い職業でも高 % なら落ちるように）
  const weightMul = 1 / (0.5 + 0.5 * defender.weight);
  return Math.min(KB_MAX, raw * weightMul);
}

// ---------- 被弾 ----------
function hit(att, def, m, dir) {
  if (def.guarding) {
    // カウンター成立：受付を打ち切り、近くにいる攻撃者へ反撃
    const g = def.action;
    g.t = g.move.startup + g.move.active;
    def.guarding = false;
    game.rings.push({ x: def.x, y: def.y, r: 20, maxR: 90, life: 18, max: 18, color: '#7fd8ff' });
    game.texts.push({ x: def.x, y: def.y - 44, text: 'COUNTER!', life: 50, max: 50, color: '#7fd8ff', size: 22 });
    if (dist(att, def) < 160 && canBeHit(att)) applyDamage(def, att, def.job.special, dirTo(def, att));
    else game.hitstop = 6;
    return;
  }
  applyDamage(att, def, m, dir);
}

function applyDamage(att, def, m, dir) {
  def.damage = Math.min(999, def.damage + m.dmg);
  const kb = computeKnockback(m, def);
  def.kbx = dir.x * kb; def.kby = dir.y * kb;
  def.hitstun = Math.min(50, Math.round(8 + kb * 1.5));
  def.action = null; def.buffer = null; def.guarding = false;
  game.hitstop = Math.min(14, Math.round(3 + kb * 0.35));
  game.shake = Math.max(game.shake, Math.min(18, kb * 0.7));
  const n = 8 + Math.min(24, kb | 0);
  for (let k = 0; k < n; k++) {
    const a = Math.atan2(dir.y, dir.x) + (Math.random() - 0.5) * 1.6;
    const s = 2 + Math.random() * (3 + kb * 0.3);
    spawnParticle(def.x, def.y, Math.cos(a) * s, Math.sin(a) * s, att.job.color, 3 + Math.random() * 3, 20 + Math.random() * 15);
  }
}

// ---------- 飛び道具 ----------
function fire(p, m) {
  const n = m.count || 1, spread = (m.spread || 0) * Math.PI / 180;
  const base = Math.atan2(p.fy, p.fx);
  for (let k = 0; k < n; k++) {
    const ang = base + (n === 1 ? 0 : (k - (n - 1) / 2) * spread);
    const c = Math.cos(ang), s = Math.sin(ang);
    game.projectiles.push({
      owner: p, m, x: p.x + c * (PLAYER_R + 4), y: p.y + s * (PLAYER_R + 4),
      vx: c * m.speed, vy: s * m.speed, life: m.life, r: m.radius,
    });
  }
}

function updateProjectiles() {
  for (const pr of game.projectiles) {
    pr.x += pr.vx; pr.y += pr.vy; pr.life--;
    if (pr.m.shape === 'fire' && game.frame % 2 === 0) {
      spawnParticle(pr.x, pr.y, (Math.random() - 0.5), (Math.random() - 0.5), 'rgba(255,140,40,0.7)', 6, 16);
    }
    const o = game.players[1 - pr.owner.i];
    if (canBeHit(o) && dist(pr, o) < pr.r + PLAYER_R) {
      pr.life = 0;
      if (pr.m.explode && !o.guarding) explode(pr);
      else hit(pr.owner, o, pr.m, norm(pr.vx, pr.vy));
    } else if (pr.life <= 0 && pr.m.explode) {
      explode(pr);
    }
  }
  game.projectiles = game.projectiles.filter(pr => pr.life > 0);
}

// 近接攻撃の判定内にある相手の弾を斬り落とす（遠距離職への対抗手段）
function cutProjectiles(p, m) {
  for (const pr of game.projectiles) {
    if (pr.owner === p || pr.life <= 0 || !inArc(p, pr, m)) continue;
    pr.life = 0;
    for (let k = 0; k < 6; k++) {
      const a = Math.random() * Math.PI * 2;
      spawnParticle(pr.x, pr.y, Math.cos(a) * 2.5, Math.sin(a) * 2.5, '#fff6c8', 3, 14);
    }
  }
}

function explode(pr) {
  game.rings.push({ x: pr.x, y: pr.y, r: 10, maxR: pr.m.explode, life: 16, max: 16, color: '#ff9a3c' });
  for (let k = 0; k < 18; k++) {
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 4;
    spawnParticle(pr.x, pr.y, Math.cos(a) * s, Math.sin(a) * s, '#ffb347', 4 + Math.random() * 4, 24);
  }
  game.shake = Math.max(game.shake, 5);
  const o = game.players[1 - pr.owner.i];
  if (canBeHit(o) && dist(pr, o) < pr.m.explode + PLAYER_R) {
    hit(pr.owner, o, pr.m, norm(o.x - pr.x + pr.vx * 2, o.y - pr.y + pr.vy * 2));
  }
}

// ---------- 落下・残機 ----------
function startDying(p) {
  p.dying = DYING_FRAMES; p.action = null; p.hitstun = 0;
  p.kbx *= 0.3; p.kby *= 0.3;
  game.shake = Math.max(game.shake, 10);
  game.texts.push({ x: p.x, y: p.y - 30, text: 'FALL!', life: 60, max: 60, color: '#ffdd55', size: 26 });
}

function loseStock(p) {
  p.stocks--;
  if (p.stocks <= 0) {
    game.winner = game.players[1 - p.i];
    game.scene = 'result';
    return;
  }
  Object.assign(p, {
    x: p.spawnX, y: CY, kbx: 0, kby: 0, damage: 0, hitstun: 0, edgeT: 0,
    action: null, buffer: null, cd: 0, inv: 120,
  });
}

function separate() {
  const [a, b] = game.players;
  if (a.dying || b.dying) return;
  const d = dist(a, b), min = PLAYER_R * 2;
  if (d > 0 && d < min) {
    const n = dirTo(a, b), push = (min - d) / 2;
    a.x -= n.x * push; a.y -= n.y * push;
    b.x += n.x * push; b.y += n.y * push;
  }
}
