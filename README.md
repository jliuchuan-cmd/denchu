# 電柱レコーダー

地図上で電柱の位置と、電柱に表示されている製造年を記録するWebアプリです。
スマートフォンのブラウザで使えます。サーバー側の処理やビルドはありません。

## できること

- **地図をタップ**、または **「＋現在地に登録」**（GPS）で電柱の位置を登録
- 製造年は **西暦・昭和・平成・令和** のどれでも入力でき、自動で西暦に変換
  （例: 昭和60 → 1985年）
- 長さ-強度（例: 13-500）・電柱番号・種別（電力／NTT／共架）・メモ・写真（自動で縮小）も記録可能
- マーカーは製造年の年代ごとに色分け（凡例つき）
- 一覧画面: 並べ替え、統計（本数・最古・最新・平均）、地図へジャンプ、Googleマップで開く
- **CSV出力**（Excel対応）／ **JSON出力・読込**（バックアップや端末間の移行に使用）
- データは端末内（IndexedDB）に保存

## 地図について

- 右上の ⚙ から **Google Maps APIキー** を入れると Google マップで表示します。
- キーがない場合は OpenStreetMap で表示します。記録・出力機能は同じです。

### Google Maps APIキーの取得

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. 「Maps JavaScript API」を有効にする
3. 「認証情報」で APIキーを作成
4. キーの制限で「HTTPリファラー」に公開先URL（例: `https://jliuchuan-cmd.github.io/*`）を設定
   （他人にキーを使われないようにするため）

## 使い方

### ローカルで試す

```sh
npx http-server -p 8080
# → http://localhost:8080 を開く
```

※ 位置情報（GPS）は `https://` か `localhost` でしか動きません。

### スマホで使う（GitHub Pages）

1. **リポジトリを公開にする**（無料プランでは非公開リポジトリを Pages で公開できないため）
   Settings → 一番下の「Danger Zone」→「Change visibility」→「Make public」
   ※ 記録データはスマホ内にだけ保存され、APIキーもアプリ画面で入力する方式なので、
   公開しても記録やキーが GitHub に載ることはありません。
2. **Pages を有効にする**
   Settings → Pages →「Build and deployment」の Source を「Deploy from a branch」にし、
   Branch で `claude/google-maps-pole-recorder-8nn60c` と `/ (root)` を選んで「Save」
3. 1〜2分後、`https://jliuchuan-cmd.github.io/denchu/` で使えます
4. スマホで開いて位置情報を「許可」し、ホーム画面に追加しておくとアプリのように使えます
   （iPhone: 共有ボタン →「ホーム画面に追加」）

リポジトリを非公開のままにしたい場合は、[Netlify Drop](https://app.netlify.com/drop) に
ファイル一式をドラッグ＆ドロップしても https のURLで公開できます。

## ファイル構成

| ファイル | 内容 |
|---|---|
| `index.html` | 画面 |
| `app.js` | 登録・一覧・出力などの本体 |
| `map.js` | 地図アダプタ（Google Maps / Leaflet） |
| `db.js` | IndexedDB 保存 |
| `style.css` | スタイル |

## 注意

- データは端末のブラウザ内にだけ保存されます。ブラウザのデータを消去すると記録も消えるので、
  定期的に「JSON出力」でバックアップしてください。
- 電柱の調査は、私有地に立ち入らない・交通の安全に配慮するなど、周囲に注意して行ってください。
