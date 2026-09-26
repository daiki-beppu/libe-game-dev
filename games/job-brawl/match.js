'use strict';
// JOB BRAWL — ゲーム状態と試合の開始・選択画面への復帰
const game = {
  scene: 'select', // select | countdown | play | result
  sel: [{ idx: 0, ready: false }, { idx: 1, ready: false }],
  p2cpu: true,
  players: [], projectiles: [], particles: [], rings: [], texts: [],
  hitstop: 0, shake: 0, timer: 0, winner: null, frame: 0,
};

const stars = Array.from({ length: 140 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.2, a: Math.random() }));
const clouds = Array.from({ length: 9 }, () => ({ x: Math.random() * W, y: 200 + Math.random() * 440, w: 120 + Math.random() * 200, v: 0.1 + Math.random() * 0.3 }));
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
