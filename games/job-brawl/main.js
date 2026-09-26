'use strict';
// JOB BRAWL — メインループ（見下ろし型 2D 対戦。相手をステージ（円）の外へ落としたら勝ち）
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
  if (pressed.has('Escape')) { location.href = '../../'; return; }
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
