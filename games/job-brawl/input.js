'use strict';
// JOB BRAWL — キーボード入力と、プレイヤーごとの入力の読み取り
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
