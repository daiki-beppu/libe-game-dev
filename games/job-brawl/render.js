'use strict';
// JOB BRAWL — Canvas 描画
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

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
  ctx.fillText(`T: 2P を ${game.p2cpu ? '人間' : 'CPU'} に切り替え　　Esc: ゲーム選択へ（試合中は職業選択へ）　　※ 英数入力モードで遊んでください`, W / 2, 574);
}
