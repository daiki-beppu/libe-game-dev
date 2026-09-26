'use strict';
// STELLAR VIPER — 効果音と BGM（Web Audio で合成）
// ---------------- サウンド ----------------
let ac = null, master = null, noiseBuf = null, muted = false;
function initAudio(){
  if (ac){ if (ac.state === 'suspended') ac.resume(); return; }
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){ return; }
  master = ac.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ac.destination);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i=0;i<d.length;i++) d[i] = Math.random()*2-1;
  if (bgm) nextT = ac.currentTime + 0.05;
}
function osc(freq, dur, {type='square', vol=0.2, slide=null, t=null} = {}){
  if (!ac) return;
  const t0 = t ?? ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0+dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
  o.connect(g).connect(master); o.start(t0); o.stop(t0+dur+0.02);
}
function noise(dur, {vol=0.3, freq=2000, type='lowpass', t=null, endFreq=null} = {}){
  if (!ac) return;
  const t0 = t ?? ac.currentTime, s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0);
  if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, t0+dur);
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
  s.connect(f).connect(g).connect(master); s.start(t0); s.stop(t0+dur+0.02);
}
const SFX = {
  shot:    () => osc(1400, 0.06, {vol:0.05, slide:500}),
  laser:   () => osc(2400, 0.1, {type:'sawtooth', vol:0.03, slide:900}),
  hit:     () => osc(300, 0.05, {vol:0.06, slide:150}),
  tink:    () => osc(3200, 0.03, {vol:0.03, type:'triangle'}),
  boom:    () => { noise(0.35, {vol:0.22, freq:1500, endFreq:100}); osc(120, 0.25, {type:'triangle', vol:0.15, slide:40}); },
  bigBoom: () => { noise(1.4, {vol:0.4, freq:2000, endFreq:50}); osc(90, 1.2, {type:'sawtooth', vol:0.15, slide:25}); },
  capsule: () => { osc(880, 0.07, {vol:0.08}); osc(1320, 0.1, {vol:0.08, t:ac.currentTime+0.06}); },
  power:   () => [523,659,784,1047].forEach((f,i) => osc(f, 0.1, {vol:0.07, t:ac.currentTime+i*0.05})),
  die:     () => { noise(1, {vol:0.4, freq:3000, endFreq:80}); osc(600, 0.9, {vol:0.12, slide:40, type:'sawtooth'}); },
  shield:  () => osc(200, 0.15, {vol:0.1, type:'triangle', slide:600}),
  warn:    () => { for (let i=0;i<8;i++) osc(i%2 ? 660 : 880, 0.18, {vol:0.07, t:ac.currentTime+i*0.22, type:'sawtooth'}); },
  oneup:   () => [784,988,1175,1568].forEach((f,i) => osc(f, 0.12, {vol:0.08, t:ac.currentTime+i*0.08})),
  blue:    () => noise(0.8, {vol:0.35, freq:6000, endFreq:150, type:'bandpass'}),
  beam:    () => osc(900, 0.2, {type:'sawtooth', vol:0.04, slide:200}),
};
function sfx(n){ if (ac && !muted) SFX[n](); }

// BGM (簡易シーケンサー)
let bgm = null, nextT = 0, stepN = 0;
const ROOTS = [45,41,43,40];
const _ = 0;
const MEL = [
  69,_,72,_,76,_,74,72, 74,_,72,_,69,_,67,_,
  65,_,69,_,72,_,77,76, 74,_,72,_,74,_,76,_,
  67,_,71,_,74,_,79,77, 76,_,74,_,71,_,74,_,
  76,_,75,_,76,_,80,_,  83,_,80,_,76,_,71,_,
];
const BOSS_MEL = [76,_,79,_,76,_,82,_,81,_,79,_,76,_,74,_];
const mtof = m => 440 * Math.pow(2, (m-69)/12);
function startBgm(mode){ bgm = mode; stepN = 0; if (ac) nextT = ac.currentTime + 0.05; }
function stopBgm(){ bgm = null; }
function playStep(n, t){
  const st = n % 16, bar = (n >> 4) % 4;
  if (bgm === 'stage'){
    if (st % 2 === 0) osc(mtof(ROOTS[bar] + (st % 4 ? 12 : 0)), 0.16, {vol:0.05, t});
    const m = MEL[bar*16 + st]; if (m) osc(mtof(m), 0.18, {vol:0.035, t});
    if (st % 4 === 0) osc(150, 0.12, {type:'sine', vol:0.2, slide:40, t});
    if (st % 4 === 2) noise(0.03, {vol:0.03, freq:7000, type:'highpass', t});
    if (st === 4 || st === 12) noise(0.1, {vol:0.06, freq:1800, t});
  } else if (bgm === 'boss'){
    const r = [40,40,41,39][bar];
    osc(mtof(r + (st % 2 ? 12 : 0)), 0.08, {vol:0.05, t});
    const m = BOSS_MEL[st]; if (m) osc(mtof(m + (bar === 2 ? 1 : 0)), 0.12, {vol:0.03, type:'sawtooth', t});
    if (st % 4 === 0) osc(150, 0.12, {type:'sine', vol:0.2, slide:40, t});
    if (st % 2 === 1) noise(0.03, {vol:0.03, freq:7000, type:'highpass', t});
  }
}
setInterval(() => {
  if (!ac || !bgm) return;
  if (nextT < ac.currentTime) nextT = ac.currentTime + 0.02;
  while (nextT < ac.currentTime + 0.15){ playStep(stepN, nextT); nextT += bgm === 'boss' ? 0.085 : 0.1; stepN++; }
}, 25);
