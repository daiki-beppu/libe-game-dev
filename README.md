# libe-game-dev

ゲーム制作のモノレポ。1 ゲーム = `games/<slug>/` の 1 ディレクトリ。

## 遊び方

リポジトリ直下で `python3 -m http.server 8760` を起動し、http://localhost:8760/ を開くとゲーム選択画面が出る。

## ゲームを追加する

1. `games/<slug>/index.html` を作る
2. [games/catalog.js](games/catalog.js) に 1 エントリ足す（選択画面に並ぶ）
3. 下の表と [CONTEXT-MAP.md](CONTEXT-MAP.md) に行を足す

## ゲーム一覧

| ゲーム | 場所 |
|---|---|
| JOB BRAWL | [games/job-brawl/](games/job-brawl/) |
| STELLAR VIPER | [games/stellar-viper/](games/stellar-viper/) |

各ゲームの用語は [CONTEXT-MAP.md](CONTEXT-MAP.md) から辿る。
