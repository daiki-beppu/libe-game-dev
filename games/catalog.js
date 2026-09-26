// ゲーム選択画面（/index.html）に並ぶゲームの一覧。
// 新しいゲームを追加したら、ここに 1 エントリ足す（並び順 = 表示順）。
//   slug    : games/<slug>/ のディレクトリ名（そのまま遷移先になる）
//   title   : 表示名
//   icon    : カードに大きく出す絵文字
//   color   : カードのアクセント色
//   players : 人数表記
//   desc    : 1〜2 行の紹介文
const GAMES = [
  {
    slug: 'job-brawl',
    title: 'JOB BRAWL',
    icon: '⚔️',
    color: '#ff6b4a',
    players: '1〜2人',
    desc: '職業ごとの技で相手をステージから叩き落とす、見下ろし型の 2D 対戦。',
  },
  {
    slug: 'stellar-viper',
    title: 'STELLAR VIPER',
    icon: '🚀',
    color: '#60c0ff',
    players: '1人',
    desc: 'パワーアップゲージとウェポンエディットで自機を強化する、横スクロールシューティング。',
  },
];
