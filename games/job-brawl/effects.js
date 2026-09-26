'use strict';
// JOB BRAWL — パーティクルなどのエフェクト
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
