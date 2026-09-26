'use strict';
// STELLAR VIPER — 画面サイズ・ステージテーマ・ウェポンエディットの定義と汎用ユーティリティ
const W = 800, H = 480, PH = 440, SCROLL = 1.2, STAGE_LEN = 6400;
const FONT = '"Press Start 2P", monospace';
const THEMES = [
  { name:'NEBULA CAVERN', bg1:'#01020a', bg2:'#0b1236', rock1:'#2c6a3a', rock2:'#0a2010', edge:'#7dffa0',
    planet:['#8ab4ff','#1a2a6a'], sec:[[700,2700],[3500,5900]] },
  { name:'MAGMA BELT', bg1:'#0a0102', bg2:'#3a0e0a', rock1:'#8a3a14', rock2:'#2a0804', edge:'#ffb050',
    planet:['#ffb070','#6a1a0a'], sec:[[400,2000],[2600,4300],[4800,6000]] },
  { name:'CRYSTAL ZONE', bg1:'#04010c', bg2:'#1e0a3e', rock1:'#4a3a9a', rock2:'#120a30', edge:'#c8a8ff',
    planet:['#e0a0ff','#3a0a5a'], sec:[[500,3200],[3800,6000]] },
];
// ウェポンエディット (グラディウスIII風)
const WEAPONS = {
  missile: [
    { name:'MISSILE',  label:'MISSILE', desc:'地面を這うように進むミサイル' },
    { name:'2-WAY',    label:'2-WAY',   desc:'上下2方向へ発射。天井と地面を這う' },
    { name:'SPREAD BOMB', label:'SPREAD', desc:'着弾すると爆発し、周囲の敵を巻き込む' },
    { name:'PHOTON TORPEDO', label:'PHOTON', desc:'真下へ高速落下。敵を貫通する' },
  ],
  double: [
    { name:'DOUBLE',   label:'DOUBLE',  desc:'前方と斜め上に同時発射' },
    { name:'TAIL GUN', label:'TAIL',    desc:'前方と後方に同時発射' },
    { name:'3-WAY',    label:'3-WAY',   desc:'前方に扇状の3方向ショット' },
  ],
  laser: [
    { name:'LASER',    label:'LASER',   desc:'敵を貫通する長いレーザー' },
    { name:'RIPPLE LASER', label:'RIPPLE', desc:'広がりながら進むリング状レーザー' },
    { name:'TWIN LASER', label:'TWIN',  desc:'短い2本のレーザーを高速連射' },
  ],
  barrier: [
    { name:'FORCE FIELD', label:'FORCE', desc:'全方位を守るバリア（6発まで）' },
    { name:'SHIELD',   label:'SHIELD',  desc:'前方のみ守る盾（15発まで）' },
  ],
};
const EDIT_ROWS = ['missile','double','laser','barrier'];
let loadout = { missile:0, double:0, laser:0, barrier:0 }, selRow = 0;
try { const s = JSON.parse(localStorage.getItem('stellarViperLoadout')); if (s) loadout = { ...loadout, ...s }; } catch(e){}
const gaugeLabels = () => ['SPEED', WEAPONS.missile[loadout.missile].label, WEAPONS.double[loadout.double].label,
  WEAPONS.laser[loadout.laser].label, 'OPTION', WEAPONS.barrier[loadout.barrier].label];
const BX = [-20,-32,-44,-56]; // ボスのバリア位置

const clamp = (v,a,b) => v<a ? a : v>b ? b : v;
const rnd = (a,b) => a + Math.random()*(b-a);
const d2 = (ax,ay,bx,by) => (ax-bx)**2 + (ay-by)**2;
function rng(seed){ let a = seed>>>0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a>>>15, 1|a); t = t + Math.imul(t ^ t>>>7, 61|t) ^ t; return ((t ^ t>>>14)>>>0) / 4294967296; }; }
