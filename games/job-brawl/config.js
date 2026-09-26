'use strict';
// JOB BRAWL — 画面・ステージ・プレイヤーの定数と小道具関数
const W = 960, H = 640;
const CX = W / 2, CY = 270, STAGE_R = 235;
const PLAYER_R = 18;
const KB_FRICTION = 0.92;   // ふっとばし速度の毎フレーム減衰率
const EDGE_GRACE = 24;      // 場外にいても落ちないフレーム数（この間に戻れば復帰）
const DYING_FRAMES = 50;
const STOCKS = 3;
const P_COLORS = ['#ff5a5a', '#4aa8ff'];
const MOVE_MUL = { melee: 0.35, projectile: 0.2, dash: 0, nova: 0.15, guard: 0 };

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
