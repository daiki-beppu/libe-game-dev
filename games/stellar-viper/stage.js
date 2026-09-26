'use strict';
// STELLAR VIPER — 地形生成・敵の出現スケジュール
// ---------------- 地形 ----------------
function env(wx){
  let e = 0;
  for (const [a,b] of theme.sec) if (wx > a && wx < b) e = Math.max(e, Math.min(1, (wx-a)/300, (b-wx)/300));
  return e;
}
function terr(wx){
  const e = env(wx); if (e <= 0) return [0, PH];
  const s = stageSeed;
  let t = e*(58 + 34*Math.sin(wx*0.0105+s) + 22*Math.sin(wx*0.027+s*1.7) + 8*Math.sin(wx*0.09+s*3));
  let b = PH - e*(62 + 34*Math.sin(wx*0.0087+s*2.3) + 24*Math.sin(wx*0.031+s*0.6) + 8*Math.sin(wx*0.083+s));
  t = Math.max(0, t); b = Math.min(PH, b);
  if (b - t < 200){ const m = (t+b)/2; t = m-100; b = m+100; }
  return [t, b];
}

// ---------------- 出現スケジュール ----------------
function buildEvents(){
  const r = rng(stage*977 + 13), ev = [], dens = 1 + rank()*0.15;
  for (let d = 250; d < STAGE_LEN - 150; ){
    const ground = env(d + W + 20) > 0.85, roll = r();
    if (ground){
      if (roll < 0.33) ev.push({d, type:'turret', side: r() < 0.5 ? 'top' : 'bot'});
      else if (roll < 0.48) ev.push({d, type:'hatch', side: r() < 0.5 ? 'top' : 'bot'});
      else if (roll < 0.8) ev.push({d, type:'fan', y: 150 + r()*140});
      else ev.push({d, type:'rusher', n:3});
      d += (70 + r()*60) / dens;
    } else {
      if (roll < 0.4) ev.push({d, type:'fan', y: 60 + r()*320});
      else if (roll < 0.6) ev.push({d, type:'garun', n:4});
      else if (roll < 0.85) ev.push({d, type:'rusher', n:4});
      else ev.push({d, type:'redone'});
      d += (110 + r()*70) / dens;
    }
  }
  return ev;
}
const ENEMY_DEF = {
  fan:{hp:1, r:10, score:100}, garun:{hp:1, r:13, score:200}, rusher:{hp:2, r:12, score:300},
  turret:{hp:2, r:12, score:400}, hatch:{hp:12, r:20, score:1500}, mini:{hp:1, r:8, score:100},
};
function mk(type, x, y, o = {}){
  const e = { type, x, y, t:0, flash:0, ...ENEMY_DEF[type], ...o };
  enemies.push(e); return e;
}
function spawnEvent(ev){
  const [tp, bt] = terr(scrollX + W + 20);
  const lo = tp + 50, hiY = bt - 50, cy = v => clamp(v, lo, hiY);
  switch (ev.type){
    case 'fan': {
      const g = {left:5, clean:true}, y0 = cy(ev.y);
      for (let i=0;i<5;i++) pending.push({d:i*9, f:() => mk('fan', W+20, y0, {group:g, y0, ph:0, a:Math.PI})});
      break;
    }
    case 'garun':
      for (let i=0;i<ev.n;i++) pending.push({d:i*28, f:() => {
        const y0 = rnd(130, PH-130); mk('garun', W+20, y0, {y0, red: i === ev.n-1});
      }});
      break;
    case 'rusher': {
      const g = {left:ev.n, clean:true};
      for (let i=0;i<ev.n;i++) pending.push({d:i*22, f:() => mk('rusher', W+20, cy(rnd(lo, hiY)), {group:g})});
      break;
    }
    case 'redone': { const y0 = rnd(130, PH-130); mk('garun', W+20, y0, {y0, red:true}); break; }
    case 'turret': mk('turret', W+20, ev.side === 'top' ? tp : bt, {side:ev.side, cd:(rnd(20,90))|0}); break;
    case 'hatch':  mk('hatch', W+30, ev.side === 'top' ? tp : bt, {side:ev.side, spawned:0}); break;
  }
}
