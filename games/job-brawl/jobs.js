'use strict';
// ============================================================
// 職業データ。数値を書き換えるとバランスが変わる。
//
// 技の kind:
//   melee      : 向いている方向に扇形の当たり判定（arc は片側の角度。180 で全周）
//   projectile : 弾を撃つ（count / spread で複数発、explode で着弾時に爆発）
//   dash       : 向いている方向へ突進し、体当たりで攻撃
//   nova       : 自分中心の円形衝撃波（heal で自分の蓄積ダメージを回復）
//   guard      : 受付中に攻撃されるとカウンター（近くの相手をふっとばす）
//
// フレーム: startup（発生まで）→ active（判定が出ている間）→ recovery（硬直）
// ふっとばし: base = 固定ぶん / growth = 蓄積ダメージに応じて伸びるぶん
// cooldown: 必殺技の再使用までのフレーム数（60 = 1 秒）
// ============================================================
const JOBS = [
  {
    id: 'warrior', name: '戦士', icon: '⚔️', color: '#e05a47',
    speed: 2.6, weight: 1.25, aiRange: 55,
    desc: '重くて遅いが一撃が重い。大回転斬りで場外へ',
    attack:  { label: '斬り',       kind: 'melee', startup: 7,  active: 5, recovery: 14, range: 62, arc: 70,  dmg: 9,  base: 3.5, growth: 0.10 },
    special: { label: '大回転斬り', kind: 'melee', startup: 16, active: 8, recovery: 22, range: 80, arc: 180, dmg: 15, base: 6,   growth: 0.17, cooldown: 110 },
  },
  {
    id: 'mage', name: '魔法使い', icon: '🔮', color: '#8a5cf0',
    speed: 2.7, weight: 0.8, aiRange: 230,
    desc: '遠くから削る。ファイアボールは爆発で吹き飛ばす',
    attack:  { label: '魔法弾',         kind: 'projectile', startup: 6,  recovery: 12, speed: 7,   radius: 7,  life: 55, dmg: 4,  base: 2,   growth: 0.05, shape: 'orb' },
    special: { label: 'ファイアボール', kind: 'projectile', startup: 18, recovery: 20, speed: 4.2, radius: 14, life: 90, dmg: 12, base: 5.5, growth: 0.16, shape: 'fire', explode: 70, cooldown: 120 },
  },
  {
    id: 'archer', name: '弓使い', icon: '🏹', color: '#4caf50',
    speed: 3.0, weight: 0.9, aiRange: 260,
    desc: '速くて長い矢。三連矢で逃げ道をふさぐ',
    attack:  { label: '矢',     kind: 'projectile', startup: 10, recovery: 10, speed: 11, radius: 5, life: 60, dmg: 5, base: 2.5, growth: 0.06, shape: 'arrow' },
    special: { label: '三連矢', kind: 'projectile', startup: 14, recovery: 18, speed: 10, radius: 5, life: 50, dmg: 6, base: 3.5, growth: 0.10, shape: 'arrow', count: 3, spread: 18, cooldown: 80 },
  },
  {
    id: 'thief', name: '盗賊', icon: '🗡️', color: '#f0b429',
    speed: 3.6, weight: 0.8, aiRange: 40,
    desc: '最速の連撃。突進は外すと自分が落ちるかも',
    attack:  { label: '短剣', kind: 'melee', startup: 3, active: 3,  recovery: 6,  range: 44, arc: 45, dmg: 3, base: 1.5, growth: 0.05 },
    special: { label: '突進', kind: 'dash',  startup: 6, active: 14, recovery: 16, dashSpeed: 11, radius: 26, dmg: 9, base: 5, growth: 0.13, cooldown: 70 },
  },
  {
    id: 'priest', name: '僧侶', icon: '✚', color: '#e8e8f0',
    speed: 2.7, weight: 1.0, aiRange: 50,
    desc: '聖なる波動で周囲を押し返しつつ自分を回復',
    attack:  { label: '杖打ち',     kind: 'melee', startup: 6,  active: 4, recovery: 12, range: 52, arc: 60, dmg: 6, base: 3, growth: 0.08 },
    special: { label: '聖なる波動', kind: 'nova',  startup: 20, active: 4, recovery: 20, radius: 120, dmg: 8, base: 6.5, growth: 0.12, heal: 12, cooldown: 160 },
  },
  {
    id: 'knight', name: '騎士', icon: '🛡️', color: '#4f8fe6',
    speed: 2.4, weight: 1.4, aiRange: 80,
    desc: '最重量。長い槍と、読み勝てば強烈なカウンター',
    attack:  { label: '槍突き',     kind: 'melee', startup: 9, active: 4,  recovery: 14, range: 90, arc: 18, dmg: 8,  base: 3.5, growth: 0.09 },
    special: { label: 'カウンター', kind: 'guard', startup: 2, active: 36, recovery: 18, dmg: 10, base: 7, growth: 0.15, cooldown: 100 },
  },
];
