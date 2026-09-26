'use strict';
// STELLAR VIPER — Canvas 描画
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
function drawBackground(){
  const g = ctx.createLinearGradient(0, 0, 0, PH);
  g.addColorStop(0, theme.bg2); g.addColorStop(1, theme.bg1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, PH);
  // 遠景の惑星
  const px = W + 160 - ((scrollX*0.05 + 250) % (W + 320)), py = 110;
  const pg = ctx.createRadialGradient(px - 25, py - 25, 5, px, py, 70);
  pg.addColorStop(0, theme.planet[0]); pg.addColorStop(1, theme.planet[1]);
  ctx.globalAlpha = 0.55; ctx.fillStyle = pg;
  ctx.beginPath(); ctx.arc(px, py, 70, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = theme.planet[0]; ctx.lineWidth = 2; ctx.globalAlpha = 0.25;
  ctx.beginPath(); ctx.ellipse(px, py, 115, 20, -0.25, 0, Math.PI*2); ctx.stroke();
  ctx.globalAlpha = 1;
  for (const s of stars){
    ctx.fillStyle = s.z > 1.5 ? '#fff' : s.z > 0.5 ? '#9ab' : '#456';
    ctx.fillRect(s.x, s.y, s.z > 1.5 ? 2 + s.z : 1.5, s.z > 1.5 ? 2 : 1.5);
  }
}
function drawTerrain(){
  const wx0 = Math.floor(scrollX/8)*8, T = [], B = [];
  let any = false;
  for (let i=0;i<=W/8+2;i++){
    const wx = wx0 + i*8, [t, b] = terr(wx), sx = wx - scrollX;
    T.push([sx, t, wx]); B.push([sx, b, wx]);
    if (t > 0.5 || b < PH - 0.5) any = true;
  }
  if (!any) return;
  const last = T[T.length-1][0];
  for (const top of [true, false]){
    const A = top ? T : B, base = top ? -2 : PH + 2;
    const g = ctx.createLinearGradient(0, top ? 0 : PH, 0, top ? 130 : PH - 130);
    g.addColorStop(0, theme.rock2); g.addColorStop(1, theme.rock1);
    ctx.beginPath(); ctx.moveTo(A[0][0], base);
    for (const [x, y] of A) ctx.lineTo(x, y);
    ctx.lineTo(last, base); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    // 岩肌の模様
    ctx.save(); ctx.clip();
    ctx.strokeStyle = theme.edge; ctx.lineWidth = 1.5;
    for (const [off, al] of [[10, 0.3], [24, 0.14]]){
      ctx.globalAlpha = al; ctx.beginPath();
      A.forEach(([x, y], i) => { const yy = top ? y - off : y + off; i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); });
      ctx.stroke();
    }
    ctx.globalAlpha = 0.35; ctx.fillStyle = theme.rock2;
    for (const [x, y, wx] of A){
      const h = Math.sin(wx*12.9898 + (top ? 1 : 7))*43758.5453 % 1;
      if (Math.abs(h) < 0.3){ const d = 34 + Math.abs(h)*120; ctx.fillRect(x, top ? y - d : y + d - 6, 6, 6); }
    }
    ctx.restore();
    ctx.globalAlpha = 1; ctx.strokeStyle = theme.edge; ctx.lineWidth = 2;
    ctx.beginPath(); A.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  }
}
function drawShip(x, y){
  ctx.save(); ctx.translate(x, y);
  // 噴射炎
  const fl = 8 + Math.random()*8;
  ctx.fillStyle = frame % 4 < 2 ? '#ffa020' : '#fff060';
  ctx.beginPath(); ctx.moveTo(-15, -3); ctx.lineTo(-15 - fl, 0); ctx.lineTo(-15, 3); ctx.fill();
  // 主翼
  ctx.fillStyle = '#3a5ad0';
  ctx.beginPath(); ctx.moveTo(4, -3); ctx.lineTo(-8, -13); ctx.lineTo(-15, -13); ctx.lineTo(-11, -3); ctx.fill();
  ctx.beginPath(); ctx.moveTo(4, 3); ctx.lineTo(-8, 13); ctx.lineTo(-15, 13); ctx.lineTo(-11, 3); ctx.fill();
  // 機体
  const g = ctx.createLinearGradient(0, -5, 0, 5);
  g.addColorStop(0, '#fff'); g.addColorStop(1, '#8a94b0');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(8, -3); ctx.lineTo(-4, -5); ctx.lineTo(-15, -4);
  ctx.lineTo(-17, 0); ctx.lineTo(-15, 4); ctx.lineTo(-4, 5); ctx.lineTo(8, 3); ctx.closePath(); ctx.fill();
  // 前方の突起 (ヴィックバイパー風のフォーク)
  ctx.fillStyle = '#c8d0e8';
  ctx.fillRect(4, -7, 12, 2); ctx.fillRect(4, 5, 12, 2);
  // キャノピー
  ctx.fillStyle = '#20e0ff';
  ctx.beginPath(); ctx.ellipse(1, -1.5, 5, 2, 0, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}
function drawOption(x, y, i){
  const r = 7 + Math.sin(frame*0.25 + i)*1.5;
  const g = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, r + 5);
  g.addColorStop(0, '#fff'); g.addColorStop(0.35, '#ffb040'); g.addColorStop(0.8, '#d02010'); g.addColorStop(1, 'rgba(200,20,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r + 5, r + 2, 0, 0, Math.PI*2); ctx.fill();
}
function drawEnemy(e){
  const red = e.red, fl = e.flash > 0;
  ctx.save(); ctx.translate(e.x, e.y);
  switch (e.type){
    case 'fan': {
      ctx.rotate(e.t*0.3);
      ctx.fillStyle = fl ? '#fff' : '#40c8ff';
      for (let k=0;k<4;k++){ ctx.rotate(Math.PI/2); ctx.beginPath(); ctx.ellipse(6, 0, 6, 3, 0, 0, Math.PI*2); ctx.fill(); }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'garun': {
      const wing = 3 + Math.abs(Math.sin(e.t*0.4))*7;
      ctx.fillStyle = fl ? '#fff' : red ? '#ff9090' : '#9affc0'; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.ellipse(2, -6, 7, wing, -0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(2, 6, 7, wing, 0.3, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = fl ? '#fff' : red ? '#e02020' : '#20a050';
      ctx.beginPath(); ctx.ellipse(0, 0, 13, 5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ff0'; ctx.fillRect(-11, -1.5, 3, 3);
      break;
    }
    case 'rusher': {
      ctx.fillStyle = fl ? '#fff' : '#8890a8';
      ctx.beginPath();
      for (let k=0;k<6;k++){ const a = k*Math.PI/3; ctx.lineTo(Math.cos(a)*13, Math.sin(a)*10); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#d0d8f0'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = e.t % 20 < 10 ? '#ff3030' : '#ff9090';
      ctx.beginPath(); ctx.arc(-4, 0, 4, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'turret': {
      const top = e.side === 'top';
      let a = Math.atan2(player.y - e.y, player.x - e.x);
      a = top ? clamp(a, 0.1, Math.PI - 0.1) : clamp(a, -Math.PI + 0.1, -0.1);
      ctx.strokeStyle = fl ? '#fff' : '#c0c8d8'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, top ? 4 : -4); ctx.lineTo(Math.cos(a)*16, (top ? 4 : -4) + Math.sin(a)*16); ctx.stroke();
      ctx.fillStyle = fl ? '#fff' : '#a05030';
      ctx.beginPath(); ctx.arc(0, 0, 11, top ? 0 : Math.PI, top ? Math.PI : Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffd060'; ctx.fillRect(-2, top ? 3 : -5, 4, 2);
      break;
    }
    case 'hatch': {
      const top = e.side === 'top', s = top ? -1 : 1;
      ctx.fillStyle = fl ? '#fff' : '#606a80'; ctx.fillRect(-22, top ? -12 : -4, 44, 16);
      ctx.fillStyle = '#9aa4c0'; ctx.fillRect(-22, top ? -12 : -4, 44, 3);
      if (e.open){
        ctx.fillStyle = '#100'; ctx.fillRect(-12, top ? 2 : -6, 24, 4);
        ctx.fillStyle = '#c04040';
        ctx.fillRect(-16, top ? 4 : -14, 4, 10); ctx.fillRect(12, top ? 4 : -14, 4, 10);
      } else { ctx.fillStyle = '#c04040'; ctx.fillRect(-14, top ? 2 : -6, 28, 4); }
      ctx.fillStyle = e.t % 30 < 15 ? '#ff0' : '#840'; ctx.fillRect(-2, s < 0 ? -8 : 6, 4, 3);
      break;
    }
    case 'mini': {
      ctx.rotate(e.t*0.2);
      ctx.fillStyle = fl ? '#fff' : '#ffa030';
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -6); ctx.lineTo(-3, 0); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
      break;
    }
  }
  ctx.restore();
}
function drawBoss(b){
  ctx.save(); ctx.translate(b.x, b.y);
  const g = ctx.createLinearGradient(0, -62, 0, 62);
  g.addColorStop(0, '#9ab0e0'); g.addColorStop(0.5, '#3a4a78'); g.addColorStop(1, '#9ab0e0');
  ctx.fillStyle = g; ctx.strokeStyle = '#c8d4ff'; ctx.lineWidth = 2;
  for (const s of [-1, 1]){
    ctx.beginPath();
    ctx.moveTo(-60, 14*s); ctx.lineTo(-60, 40*s); ctx.lineTo(-40, 62*s); ctx.lineTo(70, 62*s);
    ctx.lineTo(92, 40*s); ctx.lineTo(92, 14*s); ctx.closePath(); ctx.fill(); ctx.stroke();
    // 装甲の筋
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    for (let x=-30;x<80;x+=22){ ctx.beginPath(); ctx.moveTo(x, 18*s); ctx.lineTo(x, 58*s); ctx.stroke(); }
    ctx.strokeStyle = '#c8d4ff';
    // 砲台
    ctx.fillStyle = '#20283c'; ctx.fillRect(-68, 24*s - 3, 8, 6); ctx.fillRect(-68, 44*s - 3, 8, 6);
    ctx.fillStyle = g;
  }
  // 中央ブロック
  ctx.fillStyle = '#2a3452'; ctx.fillRect(-12, -14, 104, 28);
  ctx.fillStyle = '#0a0e1a'; ctx.fillRect(-60, -13, 48, 26);
  // エンジン
  ctx.fillStyle = frame % 4 < 2 ? '#ffa020' : '#fff060';
  for (const dy of [-40, 0, 40]) ctx.fillRect(92, dy - 5, 8 + Math.random()*10, 10);
  // コア
  const pulse = 9 + Math.sin(frame*0.2)*2, danger = b.bar.every(v => v <= 0);
  const cg = ctx.createRadialGradient(-4, 0, 1, -4, 0, pulse + 4);
  cg.addColorStop(0, '#fff');
  cg.addColorStop(0.4, danger && frame % 10 < 5 ? '#ff6060' : '#60c0ff');
  cg.addColorStop(1, 'rgba(40,80,255,0)');
  ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(-4, 0, pulse + 4, 0, Math.PI*2); ctx.fill();
  // バリア
  for (let i=0;i<4;i++){
    if (b.bar[i] <= 0) continue;
    ctx.fillStyle = b.flash > 0 ? '#fff' : '#80d0ff';
    ctx.fillRect(BX[i] - 3, -12, 6, 24);
    ctx.fillStyle = '#2060c0'; ctx.fillRect(BX[i] - 1, -12, 2, 24);
  }
  if (b.flash > 0){ ctx.globalAlpha = 0.25; ctx.fillStyle = '#fff'; ctx.fillRect(-60, -62, 152, 124); ctx.globalAlpha = 1; }
  ctx.restore();
}
function drawShots(){
  for (const s of shots){
    if (s.type === 'laser'){
      ctx.fillStyle = '#40e0ff'; ctx.fillRect(s.x - s.len, s.y - 2.5, s.len, 5);
      ctx.fillStyle = '#fff'; ctx.fillRect(s.x - s.len, s.y - 1, s.len, 2);
    } else if (s.type === 'ripple'){
      ctx.lineWidth = 3; ctx.strokeStyle = frame % 4 < 2 ? '#ff9040' : '#ffe080';
      ctx.beginPath(); ctx.ellipse(s.x, s.y, s.rad*0.35, s.rad, 0, 0, Math.PI*2); ctx.stroke();
    } else if (s.type === 'bomb'){
      ctx.fillStyle = '#ff7020'; ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(s.x - 1, s.y - 3, 2, 2);
    } else if (s.type === 'photon'){
      ctx.fillStyle = '#c070ff'; ctx.beginPath(); ctx.ellipse(s.x, s.y, 4, 9, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(s.x, s.y + 2, 2, 4, 0, 0, Math.PI*2); ctx.fill();
    } else if (s.type === 'missile'){
      ctx.save(); ctx.translate(s.x, s.y); if (!s.ground) ctx.rotate(Math.atan2(s.vy, s.vx));
      ctx.fillStyle = '#ffa020'; ctx.fillRect(-10, -1, 4, 2);
      ctx.fillStyle = '#d0d8e8'; ctx.fillRect(-6, -2, 10, 4); ctx.restore();
    } else if (s.type === 'dbl'){
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.atan2(s.vy, s.vx));
      ctx.fillStyle = '#ffe080'; ctx.fillRect(-6, -1.5, 12, 3); ctx.restore();
    } else {
      ctx.fillStyle = '#ffe080'; ctx.fillRect(s.x - 8, s.y - 2, 14, 4);
      ctx.fillStyle = '#fff'; ctx.fillRect(s.x - 4, s.y - 1, 10, 2);
    }
  }
}
function drawEBullets(){
  for (const b of ebullets){
    if (b.beam){
      ctx.fillStyle = '#40a0ff'; ctx.fillRect(b.x - 16, b.y - 3, 32, 6);
      ctx.fillStyle = '#fff'; ctx.fillRect(b.x - 16, b.y - 1, 32, 2);
    } else {
      ctx.fillStyle = frame % 6 < 3 ? '#ff6040' : '#ffd060';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, 1.6, 0, Math.PI*2); ctx.fill();
    }
  }
}
function drawCapsules(){
  for (const c of capsules){
    const y = c.y + Math.sin(c.t*0.1)*3;
    const g = ctx.createLinearGradient(0, y - 7, 0, y + 7);
    if (c.blue){ g.addColorStop(0, '#a0d0ff'); g.addColorStop(1, '#1040c0'); }
    else { g.addColorStop(0, '#ffb080'); g.addColorStop(1, '#c02000'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(c.x, y, 10, 7, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = c.t % 16 < 8 ? '#fff' : '#ffd060'; ctx.fillRect(c.x - 7, y - 1, 14, 2);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
  }
}
function drawParticles(){
  for (const p of particles){
    if (p.ring){
      ctx.globalAlpha = p.life/18; ctx.strokeStyle = '#ffe0a0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.stroke();
    } else {
      ctx.globalAlpha = Math.min(1, p.life/p.max*1.5); ctx.fillStyle = p.c;
      ctx.fillRect(p.x - p.s/2, p.y - p.s/2, p.s, p.s);
    }
  }
  ctx.globalAlpha = 1;
}
function text(str, x, y, size, color, align = 'center', font = FONT){
  ctx.font = `${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000'; ctx.fillText(str, x + 2, y + 2);
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}
function drawHUD(){
  ctx.fillStyle = '#000'; ctx.fillRect(0, PH, W, H - PH);
  ctx.fillStyle = '#2a3a80'; ctx.fillRect(0, PH, W, 2);
  for (let i=0;i<6;i++){
    const x = 8 + i*78, y = PH + 9, on = i === cursor, av = canSelect(i);
    ctx.fillStyle = on ? (frame % 20 < 10 ? '#ff8020' : '#ffc040') : '#0c1638';
    ctx.fillRect(x, y, 74, 24);
    ctx.strokeStyle = on ? '#fff' : '#3a5ad0'; ctx.lineWidth = 2; ctx.strokeRect(x, y, 74, 24);
    ctx.font = `8px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = on ? '#000' : av ? '#a0d0ff' : '#34405a';
    ctx.fillText(gaugeLabels()[i], x + 37, y + 13);
  }
  ctx.textAlign = 'left'; ctx.font = `10px ${FONT}`; ctx.fillStyle = '#fff';
  ctx.fillText('1P ' + String(score).padStart(8, '0'), 490, PH + 14);
  ctx.fillStyle = '#ff6060'; ctx.fillText('HI ' + String(hi).padStart(8, '0'), 490, PH + 30);
  ctx.font = `8px ${FONT}`; ctx.fillStyle = '#a0d0ff';
  ctx.fillText('STAGE ' + stage, 690, PH + 14);
  ctx.fillText('REST ' + Math.max(0, lives), 690, PH + 30);
}
function drawOverlayText(){
  if (msg){
    const a = Math.min(1, msg.t/30);
    ctx.globalAlpha = a;
    text(msg.text, W/2, PH/2 - 20, 28, '#fff');
    if (msg.sub) text(msg.sub, W/2, PH/2 + 22, 12, '#80d0ff');
    ctx.globalAlpha = 1;
  }
  if (warnT > 0 && warnT % 40 < 26){
    ctx.fillStyle = 'rgba(255,0,0,0.18)'; ctx.fillRect(0, PH/2 - 40, W, 80);
    text('WARNING!!', W/2, PH/2 - 8, 32, '#ff4040');
    text('HUGE BATTLESHIP IS APPROACHING', W/2, PH/2 + 26, 10, '#ffb0b0');
  }
  if (paused){
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, PH);
    text('PAUSE', W/2, PH/2, 28, '#fff');
  }
}
function drawTitle(){
  theme = THEMES[0];
  drawBackground();
  const g = ctx.createLinearGradient(0, 90, 0, 170);
  g.addColorStop(0, '#fff'); g.addColorStop(0.5, '#60c0ff'); g.addColorStop(1, '#2040c0');
  ctx.font = `44px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#001040'; ctx.fillText('STELLAR', W/2 + 4, 104); ctx.fillText('VIPER', W/2 + 4, 164);
  ctx.fillStyle = g; ctx.fillText('STELLAR', W/2, 100); ctx.fillText('VIPER', W/2, 160);
  drawShip(W/2 + Math.sin(frame*0.03)*180, 215);
  if (frame % 60 < 40) text('PRESS Z / ENTER TO START', W/2, 262, 14, '#ffe080');
  const J = '"Yu Gothic","Meiryo",sans-serif';
  const lines = [
    '移動：矢印キー / WASD　　ショット：Z / SPACE（押しっぱなしで連射）',
    'パワーアップ：X / SHIFT　　ポーズ：P　　サウンドON/OFF：M　　ゲーム選択へ：ESC',
    '赤い敵や編隊を全滅させるとカプセル出現 → ゲージが進む → Xで装備！',
    '青いカプセルは画面内の敵を一掃',
  ];
  lines.forEach((l, i) => text(l, W/2, 312 + i*26, 14, '#c0d0ff', 'center', J));
  text('HI ' + String(hi).padStart(8, '0'), W/2, 430, 12, '#ff6060');
  ctx.fillStyle = '#000'; ctx.fillRect(0, PH + 10, W, H);
  text('© 2026 STELLAR VIPER PROJECT', W/2, 462, 8, '#556');
}
function drawSelect(){
  theme = THEMES[0];
  drawBackground();
  ctx.fillStyle = 'rgba(0,0,20,0.55)'; ctx.fillRect(0, 0, W, H);
  text('WEAPON SELECT', W/2, 40, 22, '#60c0ff');
  const J = '"Yu Gothic","Meiryo",sans-serif';
  const titles = { missile:'MISSILE', double:'DOUBLE', laser:'LASER', barrier:'BARRIER' };
  EDIT_ROWS.forEach((k, r) => {
    const y = 100 + r*72, on = selRow === r, list = WEAPONS[k];
    ctx.fillStyle = on ? 'rgba(255,128,32,0.18)' : 'rgba(20,40,100,0.35)';
    ctx.fillRect(40, y - 26, W - 80, 62);
    ctx.strokeStyle = on ? '#ff9040' : '#2a3a80'; ctx.lineWidth = 2; ctx.strokeRect(40, y - 26, W - 80, 62);
    text(titles[k], 60, y - 8, 10, on ? '#ffc060' : '#8090c0', 'left');
    const cw = (W - 240) / list.length;
    list.forEach((w, i) => {
      const x = 200 + i*cw + cw/2, sel = loadout[k] === i;
      if (sel){
        ctx.fillStyle = on && frame % 30 < 15 ? '#ff8020' : '#c05010';
        ctx.fillRect(x - cw/2 + 4, y - 20, cw - 8, 24);
      }
      ctx.font = `8px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = sel ? '#fff' : '#6070a0'; ctx.fillText(w.label, x, y - 8);
    });
    text(list[loadout[k]].desc, 200, y + 20, 13, on ? '#fff' : '#90a0c8', 'left', J);
    if (on){ text('◀', 180, y - 8, 10, '#ffc060'); text('▶', W - 56, y - 8, 10, '#ffc060'); }
  });
  const on = selRow === 4;
  ctx.fillStyle = on ? (frame % 20 < 10 ? '#ff8020' : '#ffc040') : '#0c1638';
  ctx.fillRect(W/2 - 90, 392, 180, 32);
  ctx.strokeStyle = on ? '#fff' : '#3a5ad0'; ctx.strokeRect(W/2 - 90, 392, 180, 32);
  text('START', W/2, 408, 14, on ? '#000' : '#a0d0ff');
  text('↑↓：項目選択　←→：武装変更　Z：決定　ENTER：出撃　X：戻る', W/2, 456, 13, '#8090c0', 'center', J);
}
function draw(){
  if (state === 'title'){ drawTitle(); return; }
  if (state === 'select'){ drawSelect(); return; }
  ctx.save();
  if (shakeT > 0) ctx.translate(rnd(-3, 3), rnd(-3, 3));
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, PH); ctx.clip();
  drawBackground();
  drawTerrain();
  drawCapsules();
  for (const e of enemies) drawEnemy(e);
  if (boss) drawBoss(boss);
  drawShots();
  if (state === 'play' && player.alive){
    for (let i=pw.options-1;i>=0;i--){ const h = hist[Math.min((i+1)*10, hist.length-1)]; drawOption(h.x, h.y, i); }
    if (!(player.inv > 0 && frame % 6 < 3)) drawShip(player.x, player.y);
    if (pw.shield > 0 && loadout.barrier === 1){
      // 前方シールド
      for (const dy of [-9, 9]){
        const g = ctx.createRadialGradient(player.x + 26, player.y + dy, 1, player.x + 26, player.y + dy, 10);
        g.addColorStop(0, '#fff'); g.addColorStop(0.5, `rgba(80,200,255,${0.4 + pw.shield*0.04})`); g.addColorStop(1, 'rgba(80,200,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(player.x + 26, player.y + dy, 6 + Math.sin(frame*0.3)*1.5, 10, 0, 0, Math.PI*2); ctx.fill();
      }
    } else if (pw.shield > 0){
      ctx.strokeStyle = `rgba(80,200,255,${0.3 + pw.shield*0.1})`; ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]); ctx.lineDashOffset = -frame;
      ctx.beginPath(); ctx.ellipse(player.x + 2, player.y, 28, 18, 0, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  drawEBullets();
  drawParticles();
  if (flashT > 0){ ctx.fillStyle = `rgba(255,255,255,${flashT/15})`; ctx.fillRect(0, 0, W, PH); }
  ctx.restore();
  drawHUD();
  ctx.restore();
  if (state === 'over'){
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, PH);
    text('GAME OVER', W/2, PH/2 - 10, 32, '#ff4040');
    if (gameOverT > 90 && frame % 60 < 40) text('PRESS Z / ENTER', W/2, PH/2 + 36, 12, '#fff');
  } else drawOverlayText();
}
