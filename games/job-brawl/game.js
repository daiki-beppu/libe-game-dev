'use strict';
// ============================================================
// JOB BRAWL — 見下ろし型 2D 対戦。相手をステージ（円）の外へ落としたら勝ち
// ============================================================
const W = 960, H = 640;
const CX = W / 2, CY = 270, STAGE_R = 235;
const PLAYER_R = 18;
const KB_FRICTION = 0.92;   // ふっとばし速度の毎フレーム減衰率
const EDGE_GRACE = 24;      // 場外にいても落ちないフレーム数（この間に戻れば復帰）
const DYING_FRAMES = 50;
const STOCKS = 3;
const P_COLORS = ['#ff5a5a', '#4aa8ff'];
const MOVE_MUL = { melee: 0.35, projectile: 0.5, dash: 0, nova: 0.15, guard: 0 };

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
// ============================================================
function computeKnockback(hit, defender) {
  // TODO: 蓄積ダメージが増えるほど大きく飛ぶようにする（今は % が効かない仮実装）
  return hit.base;
}

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ---------- 入力 ----------
const keys = new Set();
const pressed = new Set();
const CONTROLS = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', atk: 'KeyC', sp: 'KeyV' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', atk: 'Period', sp: 'Slash' },
];
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Slash', 'Period'].includes(e.code)) e.preventDefault();
  if (!keys.has(e.code)) pressed.add(e.code);
  keys.add(e.code);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

// ---------- 状態 ----------
const game = {
  scene: 'select', // select | countdown | play | result
  sel: [{ idx: 0, ready: false }, { idx: 1, ready: false }],
  p2cpu: true,
  players: [], projectiles: [], particles: [], rings: [], texts: [],
  hitstop: 0, shake: 0, timer: 0, winner: null, frame: 0,
};

const stars = Array.from({ length: 140 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.2, a: Math.random() }));
const clouds = Array.from({ length: 9 }, () => ({ x: Math.random() * W, y: 200 + Math.random() * 440, w: 120 + Math.random() * 200, v: 0.1 + Math.random() * 0.3 }));

// ---------- 小道具 ----------
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function norm(x, y) { const l = Math.hypot(x, y); return l > 1e-6 ? { x: x / l, y: y / l } : { x: 1, y: 0 }; }
const dirTo = (a, b) => norm(b.x - a.x, b.y - a.y);
const canBeHit = o => !o.dying && o.inv <= 0;
const labelOf = p => p.cpu ? 'CPU' : `${p.i + 1}P`;
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------- 試合 ----------
function makePlayer(i, job, cpu) {
  const sx = CX + (i === 0 ? -110 : 110);
  return {
    i, job, cpu, weight: job.weight, x: sx, y: CY, kbx: 0, kby: 0, fx: i === 0 ? 1 : -1, fy: 0,
    damage: 0, stocks: STOCKS, hitstun: 0, action: null, cd: 0, buffer: null,
    edgeT: 0, dying: 0, inv: 0, guarding: false, spawnX: sx, ai: { t: 0, strafe: 1 },
  };
}

function startMatch() {
  game.players = [
    makePlayer(0, JOBS[game.sel[0].idx], false),
    makePlayer(1, JOBS[game.sel[1].idx], game.p2cpu),
  ];
  game.projectiles = []; game.particles = []; game.rings = []; game.texts = [];
  game.hitstop = 0; game.shake = 0; game.winner = null;
  game.scene = 'countdown'; game.timer = 150;
}

function backToSelect() {
  game.scene = 'select';
  game.sel.forEach(s => s.ready = false);
}

// ---------- 入力の読み取り ----------
function readInput(p) {
  if (p.cpu) return cpuInput(p, game.players[1 - p.i]);
  const c = CONTROLS[p.i];
  return {
    dx: (keys.has(c.right) ? 1 : 0) - (keys.has(c.left) ? 1 : 0),
    dy: (keys.has(c.down) ? 1 : 0) - (keys.has(c.up) ? 1 : 0),
    atk: pressed.has(c.atk), sp: pressed.has(c.sp), face: null,
  };
}

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
      if (k === 'guard') chance = o.action && d < 130 ? 0.25 : 0;
      if (k === 'nova') chance = d < 110 ? 0.08 : 0;
      if (k === 'dash') chance = d < 200 ? 0.04 : 0;
      if (Math.random() < chance) { inp.sp = true; inp.face = face; }
    }
  }
  return inp;
}

// ---------- プレイヤー更新 ----------
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

// ---------- エフェクト ----------
function spawnParticle(x, y, vx, vy, color, size, life) {
  game.particles.push({ x, y, vx, vy, color, size, life, max: life });
}

function updateEffects() {
  for (const q of game.particles) { q.x += q.vx; q.y += q.vy; q.vx *= 0.93; q.vy *= 0.93; q.life--; }
  game.particles = game.particles.filter(q => q.life > 0);
  for (const r of game.rings) r.life--;
  game.rings = game.rings.filter(r => r.life > 0);
  for (const t of game.texts) { t.life--; t.y -= 0.6; }
  game.texts = game.texts.filter(t => t.life > 0);
  game.shake *= 0.85;
  for (const c of clouds) { c.x += c.v; if (c.x - c.w > W) c.x = -c.w; }
}

// ---------- メインループ ----------
function tick() {
  game.frame++;
  if (game.scene === 'select') return tickSelect();
  if (pressed.has('Escape')) return backToSelect();
  updateEffects();
  if (game.scene === 'result') {
    if (pressed.has('Enter') || pressed.has('Space')) backToSelect();
    return;
  }
  if (game.scene === 'countdown') {
    if (--game.timer <= 0) {
      game.scene = 'play';
      game.texts.push({ x: CX, y: CY, text: 'GO!', life: 45, max: 45, color: '#fff', size: 64 });
    }
    return;
  }
  // play
  if (game.hitstop > 0) {
    game.hitstop--;
    // ヒットストップ中の入力も先行入力として拾う
    for (const p of game.players) {
      if (p.cpu) continue;
      const c = CONTROLS[p.i];
      if (pressed.has(c.atk)) p.buffer = { which: 'attack', t: 8 };
      if (pressed.has(c.sp)) p.buffer = { which: 'special', t: 8 };
    }
    return;
  }
  const inputs = game.players.map(readInput);
  game.players.forEach((p, k) => updatePlayer(p, inputs[k]));
  separate();
  updateProjectiles();
}

function tickSelect() {
  if (pressed.has('KeyT')) { game.p2cpu = !game.p2cpu; game.sel[1].ready = false; }
  for (let i = 0; i < 2; i++) {
    const s = game.sel[i], c = CONTROLS[i];
    if (s.ready) { if (pressed.has(c.sp)) s.ready = false; continue; }
    const n = JOBS.length;
    if (pressed.has(c.left)) s.idx = (s.idx + n - 1) % n;
    if (pressed.has(c.right)) s.idx = (s.idx + 1) % n;
    if (pressed.has(c.up) || pressed.has(c.down)) s.idx = (s.idx + 3) % n;
    if (pressed.has(c.atk) && !(i === 1 && game.p2cpu)) s.ready = true;
  }
  if (game.sel[0].ready && (game.sel[1].ready || game.p2cpu)) startMatch();
}

const STEP = 1000 / 60;
let last = performance.now(), acc = 0;
function loop(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= STEP) { tick(); acc -= STEP; pressed.clear(); }
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ============================================================
// 描画
// ============================================================
function render() {
  drawBackground();
  if (game.scene === 'select') return drawSelect();

  ctx.save();
  if (game.shake > 0.3) ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
  // 奥側（北）へ落ちているキャラは島の後ろに描く
  const behind = game.players.filter(p => p.dying && p.y < CY);
  const front = game.players.filter(p => !behind.includes(p)).sort((a, b) => a.y - b.y);
  behind.forEach(drawPlayer);
  drawStage();
  for (const r of game.rings) {
    const t = 1 - r.life / r.max;
    ctx.strokeStyle = hexA(r.color, r.life / r.max);
    ctx.lineWidth = 6 * (1 - t) + 1;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r + (r.maxR - r.r) * t, 0, Math.PI * 2); ctx.stroke();
  }
  game.projectiles.forEach(drawProjectile);
  for (const q of game.particles) {
    ctx.globalAlpha = q.life / q.max;
    ctx.fillStyle = q.color;
    ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.4 + 0.6 * q.life / q.max), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  front.forEach(drawPlayer);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of game.texts) {
    ctx.globalAlpha = Math.min(1, t.life / (t.max * 0.4));
    ctx.font = `bold ${t.size}px sans-serif`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  drawHUD();
  if (game.scene === 'countdown') {
    const n = Math.ceil(game.timer / 50);
    drawBigText(String(n), 96, '#fff');
  }
  if (game.scene === 'result') drawResult();
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b1026'); g.addColorStop(1, '#1d1040');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (const s of stars) {
    ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(game.frame * 0.02 + s.a * 10));
    ctx.fillStyle = '#fff'; ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  ctx.globalAlpha = 1;
  for (const c of clouds) {
    ctx.fillStyle = 'rgba(160,140,220,0.06)';
    ctx.beginPath(); ctx.ellipse(c.x, c.y, c.w, c.w * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function drawStage() {
  // 浮島の側面
  const side = ctx.createLinearGradient(0, CY, 0, CY + STAGE_R + 40);
  side.addColorStop(0, '#4a3b3a'); side.addColorStop(1, '#1c1418');
  ctx.fillStyle = side;
  ctx.beginPath(); ctx.arc(CX, CY + 36, STAGE_R, 0, Math.PI * 2); ctx.fill();
  // 上面
  const top = ctx.createRadialGradient(CX - 60, CY - 60, 20, CX, CY, STAGE_R);
  top.addColorStop(0, '#7a8a99'); top.addColorStop(1, '#43505e');
  ctx.fillStyle = top;
  ctx.beginPath(); ctx.arc(CX, CY, STAGE_R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 2;
  for (const f of [0.33, 0.66]) { ctx.beginPath(); ctx.arc(CX, CY, STAGE_R * f, 0, Math.PI * 2); ctx.stroke(); }
  for (let k = 0; k < 12; k++) {
    const a = k * Math.PI / 6;
    ctx.beginPath();
    ctx.moveTo(CX + Math.cos(a) * STAGE_R * 0.33, CY + Math.sin(a) * STAGE_R * 0.33);
    ctx.lineTo(CX + Math.cos(a) * STAGE_R, CY + Math.sin(a) * STAGE_R);
    ctx.stroke();
  }
  // 縁
  ctx.strokeStyle = 'rgba(220,230,240,0.55)'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(CX, CY, STAGE_R - 2, 0, Math.PI * 2); ctx.stroke();
}

function drawPlayer(p) {
  let s = 1, alpha = 1;
  if (p.dying) { s = p.dying / DYING_FRAMES; alpha = 0.2 + 0.8 * s; }
  if (p.inv > 0 && Math.floor(p.inv / 5) % 2 === 0) alpha *= 0.4;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(p.x, p.y); ctx.scale(s, s);
  if (!p.dying && p.edgeT === 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 14, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
  }
  drawActionFx(p);
  ctx.fillStyle = p.hitstun > 0 && p.hitstun % 6 < 2 ? '#fff' : p.job.color;
  ctx.beginPath(); ctx.arc(0, 0, PLAYER_R, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke();
  const a = Math.atan2(p.fy, p.fx);
  ctx.save(); ctx.rotate(a);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(19, -6); ctx.lineTo(19, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#222'; ctx.fillText(p.job.icon, 0, 1);
  ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = P_COLORS[p.i];
  ctx.fillText(labelOf(p), 0, -32);
  if (p.edgeT > 0 && !p.dying) {
    ctx.font = 'bold 20px sans-serif'; ctx.fillStyle = '#ffdd55';
    ctx.fillText('!', 0, -48);
  }
  ctx.restore();
}

function drawActionFx(p) {
  const a = p.action; if (!a) return;
  const m = a.move, ang = Math.atan2(p.fy, p.fx);
  const act = a.t > m.startup && a.t <= m.startup + (m.active || 1);
  const wind = a.t <= m.startup;
  if (m.kind === 'melee') {
    const arc = m.arc * Math.PI / 180;
    ctx.beginPath(); ctx.moveTo(0, 0);
    if (m.arc >= 180) ctx.arc(0, 0, m.range, 0, Math.PI * 2);
    else ctx.arc(0, 0, m.range, ang - arc, ang + arc);
    ctx.closePath();
    ctx.fillStyle = act ? hexA(p.job.color, 0.55) : wind ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)';
    ctx.fill();
    if (act) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.stroke(); }
  } else if (m.kind === 'guard' && act) {
    ctx.fillStyle = 'rgba(127,216,255,0.2)'; ctx.strokeStyle = '#7fd8ff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, PLAYER_R + 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (m.kind === 'nova' && wind) {
    ctx.strokeStyle = 'rgba(255,227,138,0.6)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, m.radius * (1 - a.t / m.startup) + PLAYER_R, 0, Math.PI * 2); ctx.stroke();
  } else if (m.kind === 'projectile' && wind) {
    ctx.fillStyle = hexA(p.job.color, 0.8);
    ctx.beginPath();
    ctx.arc(Math.cos(ang) * (PLAYER_R + 6), Math.sin(ang) * (PLAYER_R + 6), m.radius * a.t / m.startup, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawProjectile(pr) {
  const m = pr.m;
  if (m.shape === 'arrow') {
    const n = norm(pr.vx, pr.vy);
    ctx.strokeStyle = '#d9c28a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(pr.x - n.x * 18, pr.y - n.y * 18); ctx.lineTo(pr.x, pr.y); ctx.stroke();
    ctx.fillStyle = '#eee';
    ctx.beginPath();
    ctx.moveTo(pr.x + n.x * 6, pr.y + n.y * 6);
    ctx.lineTo(pr.x - n.y * 4, pr.y + n.x * 4);
    ctx.lineTo(pr.x + n.y * 4, pr.y - n.x * 4);
    ctx.closePath(); ctx.fill();
    return;
  }
  const inner = m.shape === 'fire' ? '#fff3b0' : '#ffffff';
  const outer = m.shape === 'fire' ? 'rgba(255,90,20,0)' : hexA(pr.owner.job.color, 0);
  const g = ctx.createRadialGradient(pr.x, pr.y, 1, pr.x, pr.y, pr.r * 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.4, m.shape === 'fire' ? '#ff8a2a' : pr.owner.job.color);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 2, 0, Math.PI * 2); ctx.fill();
}

function damageColor(d) {
  const t = Math.min(1, d / 150);
  return `hsl(${50 - 50 * t}, 100%, ${95 - 40 * t}%)`;
}

function drawHUD() {
  const pw = W / 2 - 60, ph = 76, y = H - ph - 10;
  game.players.forEach((p, i) => {
    const x = i === 0 ? 30 : W / 2 + 30;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.roundRect(x, y, pw, ph, 10); ctx.fill();
    ctx.strokeStyle = P_COLORS[i]; ctx.lineWidth = 2; ctx.stroke();

    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.font = '30px sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText(p.job.icon, x + 34, y + ph / 2);

    ctx.textAlign = 'left';
    ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = P_COLORS[i];
    ctx.fillText(labelOf(p), x + 64, y + 20);
    ctx.fillStyle = '#fff'; ctx.fillText(p.job.name, x + 104, y + 20);
    for (let k = 0; k < STOCKS; k++) {
      ctx.beginPath(); ctx.arc(x + 70 + k * 16, y + 40, 5, 0, Math.PI * 2);
      if (k < p.stocks) { ctx.fillStyle = p.job.color; ctx.fill(); }
      else { ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    }
    const sp = p.job.special, ratio = sp.cooldown ? 1 - p.cd / sp.cooldown : 1;
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x + 64, y + 56, 150, 7);
    ctx.fillStyle = ratio >= 1 ? '#ffd23f' : '#888'; ctx.fillRect(x + 64, y + 56, 150 * ratio, 7);
    ctx.font = '11px sans-serif'; ctx.fillStyle = '#ccc';
    ctx.fillText(sp.label, x + 220, y + 60);

    ctx.textAlign = 'right';
    ctx.font = 'bold 44px sans-serif'; ctx.fillStyle = damageColor(p.damage);
    ctx.fillText(`${Math.floor(p.damage)}%`, x + pw - 18, y + ph / 2 + 2);
  });
}

function drawBigText(text, size, color) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${size}px sans-serif`;
  ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.strokeText(text, CX, CY);
  ctx.fillStyle = color; ctx.fillText(text, CX, CY);
}

function drawResult() {
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
  const w = game.winner;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '72px sans-serif'; ctx.fillStyle = '#fff';
  ctx.fillText(w.job.icon, CX, CY - 80);
  ctx.font = 'bold 48px sans-serif'; ctx.fillStyle = P_COLORS[w.i];
  ctx.fillText(`${labelOf(w)}（${w.job.name}）の勝利！`, CX, CY + 10);
  ctx.font = '18px sans-serif'; ctx.fillStyle = '#ccc';
  ctx.fillText('Enter で職業選択へ', CX, CY + 70);
}

function drawSelect() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff'; ctx.font = 'bold 44px sans-serif';
  ctx.fillText('JOB BRAWL', W / 2, 60);
  ctx.font = '16px sans-serif'; ctx.fillStyle = '#aab';
  ctx.fillText('職業を選んで、相手をステージから叩き落とせ！', W / 2, 88);

  const cw = 230, ch = 128, gap = 18, sx = (W - (cw * 3 + gap * 2)) / 2, sy = 110;
  JOBS.forEach((j, k) => {
    const x = sx + (k % 3) * (cw + gap), y = sy + Math.floor(k / 3) * (ch + gap);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 12); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '40px sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText(j.icon, x + 42, y + 48);
    ctx.textAlign = 'left';
    ctx.font = 'bold 20px sans-serif'; ctx.fillStyle = j.color;
    ctx.fillText(j.name, x + 80, y + 30);
    const bar = (label, v, by) => {
      ctx.font = '12px sans-serif'; ctx.fillStyle = '#bbb'; ctx.fillText(label, x + 80, by);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x + 112, by - 4, 100, 8);
      ctx.fillStyle = j.color; ctx.fillRect(x + 112, by - 4, 100 * v, 8);
    };
    bar('速さ', j.speed / 3.6, y + 58);
    bar('重さ', j.weight / 1.4, y + 78);
    ctx.font = '12px sans-serif'; ctx.fillStyle = '#ddd';
    ctx.fillText(`通常: ${j.attack.label}　必殺: ${j.special.label}`, x + 14, y + 110);

    game.sel.forEach((s, i) => {
      if (s.idx !== k) return;
      const inset = i * 5;
      ctx.strokeStyle = P_COLORS[i]; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(x - 3 + inset, y - 3 + inset, cw + 6 - inset * 2, ch + 6 - inset * 2, 14); ctx.stroke();
      ctx.fillStyle = P_COLORS[i];
      ctx.beginPath(); ctx.roundRect(i === 0 ? x - 3 : x + cw - 47, y - 16, 50, 20, 6); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(i === 1 && game.p2cpu ? 'CPU' : `${i + 1}P`, i === 0 ? x + 22 : x + cw - 22, y - 6);
      ctx.textAlign = 'left';
    });
  });

  game.sel.forEach((s, i) => {
    const j = JOBS[s.idx], x = i === 0 ? sx : W / 2 + 9, y = 408, w = (cw * 3 + gap * 2) / 2 - 9;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.roundRect(x, y, w, 100, 10); ctx.fill();
    ctx.strokeStyle = P_COLORS[i]; ctx.lineWidth = 2; ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = P_COLORS[i];
    ctx.fillText(i === 1 && game.p2cpu ? 'CPU' : `${i + 1}P`, x + 14, y + 22);
    ctx.fillStyle = '#fff'; ctx.fillText(`${j.icon} ${j.name}`, x + 66, y + 22);
    ctx.font = '13px sans-serif'; ctx.fillStyle = '#ccc';
    ctx.fillText(j.desc, x + 14, y + 52);
    const ready = s.ready || (i === 1 && game.p2cpu && game.sel[0].ready);
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = ready ? '#7dff9a' : '#888';
    const hint = i === 0 ? 'C で決定 / V で取消' : game.p2cpu ? '←→ で CPU の職業を変更' : '. で決定 / / で取消';
    ctx.fillText(ready ? '準備OK！' : hint, x + 14, y + 80);
  });

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '14px sans-serif'; ctx.fillStyle = '#9aa';
  ctx.fillText('1P: WASD 移動 / C 攻撃 / V 必殺　　2P: 矢印 移動 / . 攻撃 / / 必殺', W / 2, 548);
  ctx.fillText(`T: 2P を ${game.p2cpu ? '人間' : 'CPU'} に切り替え　　Esc: 試合中に選択画面へ　　※ 英数入力モードで遊んでください`, W / 2, 574);
}
