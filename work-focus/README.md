# Focus On Your Work

生産性を上げるために、指定した URL へのアクセスをブロックして拡張内のページへリダイレクトするブラウザ拡張です。ツールバーアイコンのクリックで有効/無効を切り替えられます。Chrome/Firefox の両方で動作します（Manifest V3）。

## 使い方

1. ブラウザの拡張機能の管理画面を開き、デベロッパーモードでこのフォルダ（work-focus）を読み込みます。
   - Chrome: chrome://extensions → デベロッパーモード → パッケージ化されていない拡張機能を読み込む → このフォルダを選択
   - Firefox: about:debugging#/runtime/this-firefox → 一時的なアドオンを読み込む → manifest.json を選択
2. 拡張の「詳細」→「拡張機能のオプション」を開き、ブロックする URL パターンを 1 行に 1 つの形式で入力して保存します。
   - ワイルドカード: `*` と `?` が使用できます。
   - 正規表現: `/regex/` の形式で指定します（例: `/^https?:\/\/(?:www\.)?news\\.example\\.com\/.*$/`）。
3. ツールバーアイコンをクリックすると有効/無効を切り替えられます。ON のとき、マッチしたページは拡張内のブロックページにリダイレクトされます。

## 例

```
*://*.twitter.com/*
*://*.youtube.com/*
*/chatgpt/*
/^https?:\/\/(?:www\.)?news\.example\.com\/.*$/
```

## 技術メモ

- Chrome では declarativeNetRequest を用いた動的ルールでリダイレクトします。Firefox など DNR が使えない環境では webRequest を用いたブロック/リダイレクトにフォールバックします。
- さらに、ネットワークフックが効かないケースに備えて content script による早期リダイレクトも用意しています（document_start）。
- アイコンのクリックで `enabled` をトグル、バッジに ON/OFF を表示します。

## 配布用パッケージの作成

この拡張はビルド不要ですが、配布やストア提出のために ZIP/XPI を作成できます。

手順（リポジトリのルートで実行）:

```
npm run build
```

出力先:

- `dist/work-focus.zip`（Chrome ウェブストアや手動配布向け）
- `dist/work-focus.xpi`（Firefox 向け。実体は ZIP と同一）

備考:

- macOS/Linux の標準 `zip` コマンドを使用します（Windows は Git Bash などで実行してください）。
- アーカイブのルート直下に manifest.json などのファイルが入る形で圧縮されます。
