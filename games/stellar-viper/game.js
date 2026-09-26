'use strict';
// STELLAR VIPER — ゲーム状態とフレーム更新（自機・ショット・敵・ボス・パワーアップ）
// ---------------- ゲーム状態 ----------------
let state = 'title', paused = false, frame = 0, score = 0, lives = 2, stage = 1, scrollX = 0;
let hi = 50000; try { hi = +localStorage.getItem('stellarViperHi') || 50000; } catch(e){}
let theme = THEMES[0], stageSeed = 0;
let player, hist, shots, enemies, ebullets, particles, capsules, pending, events, evIdx, boss;
let msg = null, stageClear = 0, capCount = 0, nextExtend = 50000, gameOverT = 0, warnT = 0, bossSpawned = false;
let flashT = 0, shakeT = 0, pw, cursor = -1;
const rank = () => stage - 1;

const stars = [];
for (let i=0;i<110;i++) stars.push({ x:Math.random()*W, y:Math.random()*PH, z:[0.3,0.8,2][i%3] });

function resetPower(){ pw = {speed:0, missile:false, double:false, laser:false, options:0, shield:0}; cursor = -1; }
function newGame(){
  score = 0; lives = 2; stage = 1; nextExtend = 50000;
  resetPower(); startStage(); state = 'play'; paused = false;
}
function startStage(){
  theme = THEMES[(stage-1) % THEMES.length]; stageSeed = stage * 1.37;
  scrollX = 0; shots = []; enemies = []; ebullets = []; particles = []; capsules = []; pending = [];
  events = buildEvents(); evIdx = 0; boss = null; bossSpawned = false; stageClear = 0; warnT = 0; capCount = 0;
  player = { x:100, y:PH/2, alive:true, respawn:0, inv:120, fireCd:0 };
  hist = []; for (let i=0;i<60;i++) hist.push({x:player.x, y:player.y});
  msg = { text:'STAGE ' + stage, sub:theme.name, t:170 };
  startBgm('stage');
}
function gameOver(){
  state = 'over'; gameOverT = 0; stopBgm();
  try { localStorage.setItem('stellarViperHi', hi); } catch(e){}
}

// ---------------- パワーアップ ----------------
function canSelect(i){
  return [pw.speed < 5, !pw.missile, !pw.double, !pw.laser, pw.options < 4, pw.shield <= 0][i];
}
function selectPower(){
  if (cursor < 0 || !canSelect(cursor)) return;
  switch (cursor){
    case 0: pw.speed++; break;
    case 1: pw.missile = true; break;
    case 2: pw.double = true; pw.laser = false; break;
    case 3: pw.laser = true; pw.double = false; break;
    case 4: pw.options++; break;
    case 5: pw.shield = loadout.barrier === 0 ? 6 : 15; break;
  }
  cursor = -1; sfx('power');
}
function dropCapsule(x, y){
  capCount++;
  capsules.push({ x, y, blue: capCount % 7 === 0, t:0 });
}

// ---------------- エフェクト ----------------
const EXP_COLS = ['#fff','#ffe066','#ff9a2a','#ff4a1a'];
function explode(x, y, size = 12){
  const n = size * 1.6;
  for (let i=0;i<n;i++){
    const a = Math.random()*Math.PI*2, sp = rnd(0.5, size*0.22);
    particles.push({ x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:rnd(18,40), max:40,
      c: EXP_COLS[(Math.random()*4)|0], s: rnd(1.5, 3.5) });
  }
  particles.push({ ring:true, x, y, r:2, max:size*2.4, life:18 });
}
function spark(x, y, c = '#aef'){
  for (let i=0;i<4;i++) particles.push({ x, y, vx:rnd(-2,1), vy:rnd(-2,2), life:rnd(6,12), max:12, c, s:1.5 });
}

// ---------------- 更新 ----------------
function shooters(){
  const a = [{x:player.x, y:player.y, s:0}];
  for (let i=0;i<pw.options;i++){ const h = hist[Math.min((i+1)*10, hist.length-1)]; a.push({x:h.x, y:h.y, s:i+1}); }
  return a;
}
const countShots = (s, type) => shots.reduce((n, x) => n + (!x.dead && x.s === s && x.type === type ? 1 : 0), 0);
function fireAll(){
  let fired = false;
  const L = loadout;
  for (const sh of shooters()){
    const base = { s:sh.s, dmg:1 };
    if (pw.laser){
      if (L.laser === 0){ shots.push({ ...base, type:'laser', x:sh.x+16, y:sh.y, len:8, max:90, hitSet:new Set() }); fired = true; }
      else if (L.laser === 1){
        if (countShots(sh.s, 'ripple') < 4){ shots.push({ ...base, type:'ripple', x:sh.x+16, y:sh.y, rad:5, hitSet:new Set() }); fired = true; }
      } else {
        for (const oy of [-5, 5]) shots.push({ ...base, type:'laser', x:sh.x+16, y:sh.y+oy, len:8, max:40, hitSet:new Set() });
        fired = true;
      }
    } else if (countShots(sh.s, 'shot') < 3){
      shots.push({ ...base, type:'shot', x:sh.x+14, y:sh.y, vx:13, vy:0 });
      if (pw.double){
        if (L.double === 0) shots.push({ ...base, type:'dbl', x:sh.x+8, y:sh.y-4, vx:9, vy:-9 });
        else if (L.double === 1) shots.push({ ...base, type:'dbl', x:sh.x-12, y:sh.y, vx:-13, vy:0 });
        else for (const vy of [-3.5, 3.5]) shots.push({ ...base, type:'dbl', x:sh.x+10, y:sh.y, vx:12.5, vy });
      }
      fired = true;
    }
    if (pw.missile){
      if (L.missile === 0 && countShots(sh.s, 'missile') < 1)
        shots.push({ ...base, dmg:2, type:'missile', x:sh.x, y:sh.y+6, vx:2.5, vy:3, dir:1, ground:false });
      else if (L.missile === 1 && countShots(sh.s, 'missile') < 1)
        for (const dir of [1, -1]) shots.push({ ...base, dmg:2, type:'missile', x:sh.x, y:sh.y+6*dir, vx:2.5, vy:3*dir, dir, ground:false });
      else if (L.missile === 2 && countShots(sh.s, 'bomb') < 1)
        shots.push({ ...base, dmg:2, type:'bomb', x:sh.x+4, y:sh.y+6, vx:3.2, vy:0.5, t:0 });
      else if (L.missile === 3 && countShots(sh.s, 'photon') < 1)
        shots.push({ ...base, dmg:2, type:'photon', x:sh.x, y:sh.y+8, vx:1, vy:7, hitSet:new Set() });
    }
  }
  if (fired) sfx(pw.laser ? 'laser' : 'shot');
}
function bombBlast(x, y, skipBoss = false){
  explode(x, y, 22); sfx('boom');
  particles.push({ ring:true, x, y, r:4, max:48, life:18 });
  for (const e of enemies) if (!e.dead && d2(e.x, e.y, x, y) < (48 + e.r)**2) damage(e, 2);
  if (!skipBoss && boss && !boss.dying && !boss.leaving) bossHit(x, y, 2);
}
function playerDie(){
  if (!player.alive || player.inv > 0) return;
  player.alive = false; player.respawn = 150;
  explode(player.x, player.y, 30); explode(player.x+10, player.y-6, 16);
  sfx('die'); resetPower(); shakeT = 20;
}
// SHIELD は前方からの攻撃のみ防ぐ
const shieldCovers = fromX => pw.shield > 0 && (loadout.barrier === 0 || fromX > player.x + 2);
function hurtPlayer(fromX){
  if (!player.alive || player.inv > 0) return false;
  if (shieldCovers(fromX)){ pw.shield--; sfx('shield'); return true; }
  playerDie(); return true;
}
function updatePlayer(){
  const p = player;
  if (!p.alive){
    if (--p.respawn <= 0){
      if (lives <= 0){ gameOver(); return; }
      lives--; p.alive = true; p.x = 100; p.y = PH/2; p.inv = 150; ebullets = [];
      for (const h of hist){ h.x = p.x; h.y = p.y; }
    }
    return;
  }
  const sp = 2.4 + pw.speed*0.9;
  let dx = (K.right()?1:0) - (K.left()?1:0), dy = (K.down()?1:0) - (K.up()?1:0);
  if (dx && dy){ dx *= 0.7071; dy *= 0.7071; }
  p.x = clamp(p.x + dx*sp, 16, W-24); p.y = clamp(p.y + dy*sp, 10, PH-10);
  if (dx || dy){ hist.unshift({x:p.x, y:p.y}); if (hist.length > 60) hist.pop(); }
  if (p.inv > 0) p.inv--;
  if (hit('KeyX','KeyK','ShiftLeft','ShiftRight')) selectPower();
  p.fireCd--;
  if (K.fire() && p.fireCd <= 0){ fireAll(); p.fireCd = pw.laser ? 7 : 5; }
  // 地形との衝突
  for (const [ox, oy] of [[16,0],[-12,-6],[-12,6]]){
    const [t, b] = terr(scrollX + p.x + ox), py = p.y + oy;
    if (py < t || py > b){
      if (p.inv > 0) p.y = clamp(p.y, t + 8, b - 8);
      else { playerDie(); return; }
    }
  }
}
function damage(e, d){
  e.hp -= d; e.flash = 4;
  if (e.hp <= 0) killEnemy(e, true); else sfx('hit');
}
function killEnemy(e, byPlayer, drops = true){
  if (e.dead) return;
  e.dead = true;
  if (byPlayer){
    score += e.score;
    explode(e.x, e.y, e.type === 'hatch' ? 28 : 14); sfx('boom');
    if (drops && e.red) dropCapsule(e.x, e.y);
  } else if (e.group) e.group.clean = false;
  if (e.group){
    e.group.left--;
    if (e.group.left === 0 && e.group.clean && byPlayer && drops) dropCapsule(e.x, e.y);
  }
}
function fireAt(x, y, spd = 2.8 + rank()*0.5){
  if (!player.alive || d2(x, y, player.x, player.y) < 90*90) return;
  const a = Math.atan2(player.y - y, player.x - x);
  ebullets.push({ x, y, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd, r:4 });
}
function updateShots(){
  for (const s of shots){
    if (s.type === 'laser'){ s.x += 16; s.len = Math.min(s.len + 16, s.max); }
    else if (s.type === 'ripple'){ s.x += 9; s.rad = Math.min(s.rad + 1.6, 34); }
    else if (s.type === 'bomb'){ s.t++; s.vy += 0.12; s.x += s.vx; s.y += s.vy; }
    else if (s.type === 'missile'){
      // dir=1: 地面を這う / dir=-1: 天井を這う
      const surf = () => { const [t, b] = terr(scrollX + s.x); return s.dir > 0 ? (b < PH ? b - 4 : null) : (t > 0 ? t + 4 : null); };
      if (!s.ground){
        s.x += s.vx; s.y += s.vy;
        const y = surf();
        if (y !== null && (s.dir > 0 ? s.y >= y : s.y <= y)){ s.ground = true; s.y = y; }
      } else {
        s.x += 4;
        const y = surf();
        if (y === null) s.ground = false; else s.y = y;
      }
      if (s.y > PH + 10) s.dead = true;
    } else { s.x += s.vx; s.y += s.vy; }
    if (s.x - (s.len || 0) > W + 10 || s.x < -10 || s.y < -10 || s.y > PH + 10) s.dead = true;
    if (s.type !== 'missile' && s.type !== 'ripple' && !s.dead){
      const [t, b] = terr(scrollX + s.x);
      if (s.y < t || s.y > b){
        s.dead = true;
        if (s.type === 'bomb') bombBlast(s.x, s.y); else spark(s.x, s.y);
      }
    }
    if (s.type === 'bomb' && !s.dead && s.t > 55){ s.dead = true; bombBlast(s.x, s.y); }
    if (s.dead) continue;
    // 敵との当たり判定
    for (const e of enemies){
      if (e.dead) continue;
      if (s.hitSet && s.hitSet.has(e)) continue;
      let h;
      if (s.type === 'laser') h = e.x + e.r > s.x - s.len && e.x - e.r < s.x && Math.abs(e.y - s.y) < e.r + 3;
      else if (s.type === 'ripple') h = Math.abs(e.x - s.x) < e.r + s.rad*0.35 && Math.abs(e.y - s.y) < e.r + s.rad;
      else h = d2(e.x, e.y, s.x, s.y) < (e.r + 4)**2;
      if (h){
        if (s.type === 'bomb'){ s.dead = true; bombBlast(s.x, s.y); break; }
        damage(e, s.dmg);
        if (s.hitSet) s.hitSet.add(e); else { s.dead = true; break; }
      }
    }
    if (!s.dead && boss && !boss.dying && !boss.leaving && bossHit(s.x, s.y, s.dmg)){
      s.dead = true;
      if (s.type === 'bomb') bombBlast(s.x, s.y, true);
    }
  }
  shots = shots.filter(s => !s.dead);
}
function updateEnemies(){
  const r = rank();
  for (const e of enemies){
    if (e.dead) continue;
    e.t++; if (e.flash > 0) e.flash--;
    switch (e.type){
      case 'fan':
        if (e.ph === 0){
          e.x -= 4 + r*0.3;
          e.y = e.y0 + Math.sin(e.t*0.09)*14;
          if (e.x < 260 + (e.y0 % 60)){ e.ph = 1; e.dir = player.y < e.y ? 1 : -1; }
        } else {
          if (e.ph === 1){ e.a += e.dir*0.085; if (Math.abs(e.a - Math.PI) >= Math.PI){ e.a = 0; e.ph = 2; } }
          e.x += Math.cos(e.a)*4.5; e.y += Math.sin(e.a)*4.5;
          if (r > 0 && e.ph === 2 && Math.random() < 0.012*r) fireAt(e.x, e.y);
        }
        break;
      case 'garun':
        e.x -= 2.3; e.y = e.y0 + Math.sin(e.t*0.045)*80;
        if (Math.random() < 0.004*(1+r)) fireAt(e.x, e.y);
        break;
      case 'rusher':
        e.x -= 1.8 + r*0.2;
        if (player.alive) e.y += clamp(player.y - e.y, -1.3, 1.3);
        if (e.t % 100 === 50) fireAt(e.x, e.y);
        break;
      case 'turret': {
        e.x -= SCROLL;
        const [t, b] = terr(scrollX + e.x); e.y = e.side === 'top' ? t : b;
        if (--e.cd <= 0){
          e.cd = Math.max(55, 130 - r*15);
          if (e.x < W-20 && e.x > 60) fireAt(e.x, e.y + (e.side === 'top' ? 8 : -8));
        }
        break;
      }
      case 'hatch': {
        e.x -= SCROLL;
        const [t, b] = terr(scrollX + e.x); e.y = e.side === 'top' ? t + 8 : b - 8;
        e.open = e.t % 80 < 40 && e.x < W - 40;
        if (e.t % 40 === 20 && e.spawned < 5 + r && e.x < W - 40 && e.x > 100){
          mk('mini', e.x, e.y + (e.side === 'top' ? 12 : -12), {dir: e.side === 'top' ? 1 : -1});
          e.spawned++;
        }
        break;
      }
      case 'mini':
        if (e.t < 25){ e.y += e.dir*2.5; e.x -= SCROLL; }
        else { e.x -= 2.6 + r*0.2; if (player.alive) e.y += clamp(player.y - e.y, -1.4, 1.4); }
        break;
    }
    if (e.x < -50 || e.x > W + 60 || e.y < -60 || e.y > PH + 60){ killEnemy(e, false); continue; }
    // 自機との接触
    if (player.alive && player.inv <= 0 && d2(e.x, e.y, player.x, player.y) < (e.r + 5)**2){
      if (shieldCovers(e.x)){ pw.shield--; sfx('shield'); damage(e, 5); }
      else playerDie();
    }
  }
  enemies = enemies.filter(e => !e.dead);
}
function spawnBoss(){
  const bh = 6 + rank()*2;
  boss = { x:W+140, y:PH/2, t:0, bar:[bh,bh,bh,bh], core:6 + rank()*2, flash:0, dying:0, leaving:false };
}
function bossHit(sx, sy, dmg){
  const b = boss, dx = sx - b.x, dy = sy - b.y;
  if (dx < -64 || dx > 92 || Math.abs(dy) > 64) return false;
  if (Math.abs(dy) < 13){
    for (let i=3;i>=0;i--){
      if (b.bar[i] > 0){
        if (dx >= BX[i] - 3){
          b.bar[i] -= dmg; b.flash = 3;
          if (b.bar[i] <= 0){ explode(b.x + BX[i], b.y, 14); sfx('boom'); score += 1000; } else sfx('hit');
          return true;
        }
        return false;
      }
    }
    if (dx >= -14){
      b.core -= dmg; b.flash = 4; sfx('hit');
      if (b.core <= 0){ b.dying = 150; ebullets = []; score += 10000*stage; sfx('bigBoom'); stopBgm(); }
      return true;
    }
    return false;
  }
  sfx('tink'); spark(sx, sy, '#fff');
  return true;
}
function updateBoss(){
  if (!boss) return;
  const b = boss; b.t++; if (b.flash > 0) b.flash--;
  if (b.dying > 0){
    b.dying--; shakeT = 4;
    if (b.dying % 6 === 0){ explode(b.x + rnd(-60, 90), b.y + rnd(-60, 60), 20); sfx('boom'); }
    if (b.dying === 0){
      for (let i=0;i<6;i++) explode(b.x + rnd(-40,80), b.y + rnd(-40,40), 36);
      flashT = 15; boss = null; stageClear = 300;
      msg = { text:'STAGE CLEAR', sub:'BONUS ' + (10000*stage), t:260 };
    }
    return;
  }
  if (b.leaving){ b.x += 3; if (b.x > W + 200){ boss = null; stageClear = 200; msg = {text:'STAGE CLEAR', sub:'', t:180}; stopBgm(); } return; }
  if (b.x > W - 160) b.x -= 1.5;
  else {
    const ty = clamp(player.alive ? player.y : PH/2, 90, PH-90), sp = 1.1 + rank()*0.25;
    b.y += clamp(ty - b.y, -sp, sp);
  }
  const period = Math.max(50, 95 - rank()*10);
  if (b.x < W - 100 && b.t % period === 0){
    for (const dy of [-44,-24,24,44]) ebullets.push({ x:b.x-66, y:b.y+dy, vx:-7 - rank(), vy:0, r:4, beam:true });
    sfx('beam');
  }
  if (b.x < W - 100 && b.t % 130 === 65){ fireAt(b.x-60, b.y-40); fireAt(b.x-60, b.y+40); }
  if (b.t > 60*50) b.leaving = true;
  // 接触判定
  if (player.alive && player.inv <= 0){
    const dx = player.x + 14 - b.x, dy = player.y - b.y;
    if (dx > -62 && player.x - 14 - b.x < 92 && Math.abs(dy) < 66){
      let front = -14;
      for (let i=3;i>=0;i--) if (b.bar[i] > 0){ front = BX[i] - 3; break; }
      if (!(Math.abs(dy) < 10 && dx < front)) playerDie();
    }
  }
}
function updateEBullets(){
  for (const b of ebullets){
    b.x += b.vx; b.y += b.vy;
    if (b.x < -30 || b.x > W + 30 || b.y < -30 || b.y > PH + 30){ b.dead = true; continue; }
    if (!player.alive) continue;
    const hr = b.beam ? 14 : 0;
    if (Math.abs(b.x - player.x) < b.r + 4 + hr && Math.abs(b.y - player.y) < b.r + 3){
      if (hurtPlayer(b.x)) b.dead = true;
    }
  }
  ebullets = ebullets.filter(b => !b.dead);
}
function updateCapsules(){
  for (const c of capsules){
    c.t++; c.x -= SCROLL*0.8;
    if (c.x < -20) c.dead = true;
    if (player.alive && d2(c.x, c.y, player.x, player.y) < 22*22){
      c.dead = true;
      if (c.blue){
        for (const e of enemies) if (e.x < W) killEnemy(e, true, false);
        ebullets = []; flashT = 12; sfx('blue');
      } else { cursor = (cursor + 1) % 6; sfx('capsule'); }
      score += 500;
    }
  }
  capsules = capsules.filter(c => !c.dead);
}
function updateParticles(){
  for (const p of particles){
    p.life--;
    if (p.ring) p.r += (p.max - p.r)*0.25;
    else { p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96; }
  }
  particles = particles.filter(p => p.life > 0);
}
function updateStars(sp = SCROLL){
  for (const s of stars){ s.x -= s.z*sp*1.4; if (s.x < 0){ s.x += W; s.y = Math.random()*PH; } }
}

function update(){
  frame++;
  if (hit('KeyM')){ muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; }
  if (state === 'title'){ updateStars(2); if (hit('Escape')){ location.href = '../../'; return; } if (hit('Enter','KeyZ','Space')){ state = 'select'; selRow = 0; sfx('capsule'); } return; }
  if (state === 'select'){
    updateStars(2);
    if (hit('ArrowUp','KeyW')){ selRow = (selRow + 4) % 5; sfx('tink'); }
    if (hit('ArrowDown','KeyS')){ selRow = (selRow + 1) % 5; sfx('tink'); }
    if (selRow < 4){
      const k = EDIT_ROWS[selRow], n = WEAPONS[k].length;
      if (hit('ArrowLeft','KeyA')){ loadout[k] = (loadout[k] + n - 1) % n; sfx('capsule'); }
      if (hit('ArrowRight','KeyD')){ loadout[k] = (loadout[k] + 1) % n; sfx('capsule'); }
    }
    if (hit('Enter') || (selRow === 4 && hit('KeyZ','Space'))){
      try { localStorage.setItem('stellarViperLoadout', JSON.stringify(loadout)); } catch(e){}
      sfx('power'); newGame();
    } else if (hit('KeyZ','Space')){ selRow++; sfx('tink'); }
    if (hit('Escape','KeyX')) state = 'title';
    return;
  }
  if (state === 'over'){
    updateStars(); updateParticles(); gameOverT++;
    if (gameOverT > 90 && hit('Enter','KeyZ','Space')) state = 'title';
    return;
  }
  if (hit('KeyP','Escape')) paused = !paused;
  if (paused) return;

  scrollX += SCROLL;
  updateStars();
  while (evIdx < events.length && events[evIdx].d <= scrollX){ spawnEvent(events[evIdx]); evIdx++; }
  if (!bossSpawned && scrollX >= STAGE_LEN){ bossSpawned = true; warnT = 200; stopBgm(); sfx('warn'); }
  if (warnT > 0 && --warnT === 0){ spawnBoss(); startBgm('boss'); }
  for (const p of pending) if (--p.d < 0){ p.f(); p.done = true; }
  pending = pending.filter(p => !p.done);

  updatePlayer();
  if (state !== 'play') return;
  updateShots(); updateEnemies(); updateBoss(); updateEBullets(); updateCapsules(); updateParticles();

  if (msg && --msg.t <= 0) msg = null;
  if (stageClear > 0 && --stageClear === 0){ stage++; startStage(); }
  if (flashT > 0) flashT--;
  if (shakeT > 0) shakeT--;
  if (score >= nextExtend){ lives++; nextExtend += 70000; sfx('oneup'); }
  if (score > hi) hi = score;
}
