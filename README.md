# とにかくやれ!!

## 動作環境

- Google Chrome 109+（または Chromium 系ブラウザの同等バージョン）
- Mozilla Firefox 109+（Manifest V3 対応版）

## インストール（開発・検証目的）

ビルドは不要です。以下の手順で「パッケージ化されていない拡張」を読み込みます。

1. このリポジトリを取得
   - Git で取得する場合: `git clone <このリポジトリのURL>`
   - ZIP をダウンロードして展開
2. ブラウザで拡張機能の管理画面を開く
   - Chrome: chrome://extensions → デベロッパーモードを有効 → 「パッケージ化されていない拡張機能を読み込む」→ `work-focus` フォルダを選択
   - Firefox: about:debugging#/runtime/this-firefox → 「一時的なアドオンを読み込む」→ `work-focus/manifest.json` を選択
3. ツールバーに表示された拡張アイコンをクリックして有効/無効を切り替えできます
4. オプションページからブロック対象の URL パターンを設定してください

より詳しい手順や例は work-focus/README.md をご覧ください。

## 使い方（要約）

- オプションページでブロックしたい URL パターンを 1 行に 1 つ登録
- アイコンのクリックで ON/OFF を切り替え
- ON のとき、マッチしたページは拡張内のブロックページにリダイレクト

## 開発・ビルド

- 本拡張はビルド不要で動作します。
- コード整形や静的解析を行う場合は Node.js を用意し、以下を実行してください。

```sh
npm install
npm run lint        # ESLint によるチェック
npm run lint:fix    # 自動修正
npm run prettier    # Markdown/HTML/JSON の整形
```

### 配布用パッケージの作成（ZIP/XPI）

拡張を配布しやすいように、`work-focus` ディレクトリを ZIP 化するスクリプトを用意しています。

手順:

```
npm run build
```

出力:

- `dist/work-focus.zip` — Chrome ウェブストア提出や手動配布に利用できます
- `dist/work-focus.xpi` — Firefox 向けの拡張パッケージ（実体は ZIP と同一。アドオン配布時に便利）

注意:

- macOS/Linux の標準 `zip` コマンドを使用します。Windows の場合は Git Bash などの環境で実行してください。
- 生成物には `work-focus` ディレクトリ直下のファイルがすべて含まれます（`.DS_Store` は除外）。

## ライセンス

本リポジトリは [Apache License, Version 2.0](/LICENSE) の下で公開されています。
