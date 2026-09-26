'use strict';
// STELLAR VIPER — キーボード入力
const keys = {}, pressed = {};
addEventListener('keydown', e => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  initAudio();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (state === 'play') paused = true; });
const K = {
  up:    () => keys.ArrowUp || keys.KeyW,
  down:  () => keys.ArrowDown || keys.KeyS,
  left:  () => keys.ArrowLeft || keys.KeyA,
  right: () => keys.ArrowRight || keys.KeyD,
  fire:  () => keys.KeyZ || keys.Space || keys.KeyJ,
};
const hit = (...codes) => codes.some(c => pressed[c]);
