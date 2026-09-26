# libe-game-dev

ゲーム制作のモノレポ。1 ゲーム = `games/<slug>/` の 1 ディレクトリ。

## 遊び方

リポジトリ直下で `python3 -m http.server 8760` を起動し、http://localhost:8760/ を開くとゲーム選択画面が出る。

## 公開（Cloudflare）

リポジトリ直下を Cloudflare Workers の静的アセットとしてそのまま配信する（ビルドなし）。

```bash
npx wrangler deploy
```

- 設定は [wrangler.jsonc](wrangler.jsonc)。公開しないファイル（`.claude/`・`docs/`・`*.md` など）は [.assetsignore](.assetsignore) で除外する
- 検索エンジンにインデックスさせないよう、[_headers](_headers) で全レスポンスに `X-Robots-Tag: noindex, nofollow` を付ける
- 初回は `npx wrangler login` でログインが必要

## ゲームを追加する

1. `games/<slug>/index.html` を作る
2. [games/catalog.js](games/catalog.js) に 1 エントリ足す（選択画面に並ぶ）
3. 下の表と [CONTEXT-MAP.md](CONTEXT-MAP.md) に行を足す
4. `games/<slug>/README.md` に遊び方と構成（ファイルごとの役割）を書く

### ゲームの作り方の約束

- ビルドなし・外部ライブラリなし。`index.html` から通常の `<script src>` で JS を読み込む（`type="module"` は使わない。`file://` で直接開いても動くように）
- 1 ファイルに詰め込まず、役割ごとに分ける（例: 定数 `config.js` / 入力 `input.js` / 更新ロジック / 描画 `render.js` / ループ `main.js`）。ループを始める `main.js` は最後に読み込む
- ゲーム内のいちばん手前の画面（タイトル・キャラ選択など）で Esc を押すと `location.href = '../../'` でゲーム選択画面へ戻る

## ゲーム一覧

| ゲーム | 場所 |
|---|---|
| JOB BRAWL | [games/job-brawl/](games/job-brawl/) |
| STELLAR VIPER | [games/stellar-viper/](games/stellar-viper/) |

各ゲームの用語は [CONTEXT-MAP.md](CONTEXT-MAP.md) から辿る。
