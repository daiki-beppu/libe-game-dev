'use strict';
// STELLAR VIPER — メインループ（60fps 固定）
let last = performance.now(), acc = 0;
const STEP_MS = 1000/60;
function loop(now){
  acc += Math.min(100, now - last); last = now;
  while (acc >= STEP_MS){
    update();
    for (const k in pressed) delete pressed[k];
    acc -= STEP_MS;
  }
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
