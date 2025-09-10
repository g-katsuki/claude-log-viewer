# Claude Code Log Viewer

Claude Codeの会話ログを閲覧・検索するためのGUIアプリケーションです。

## 機能

- 📋 会話セッション一覧表示
- 💬 会話内容の閲覧（チャット形式）
- 🔍 会話内容の全文検索
- 📱 レスポンシブデザイン
- 🚀 ローカルで動作

## セットアップ

1. 依存関係のインストール
```bash
npm install
```

2. サーバー起動
```bash
npm start
```

3. ブラウザでアクセス
```
http://localhost:3000
```

## 使い方

### 会話セッションの閲覧
- 左サイドバーにプロジェクトごとの会話セッションが表示されます
- セッションをクリックすると、右側に会話内容が表示されます

### 検索機能
- 左上の検索ボックスにキーワードを入力
- 検索ボタンをクリックまたはEnterキーで検索実行
- 検索結果から該当する会話セッションに直接ジャンプできます

### データ取得元

Claude Codeの会話ログは以下の場所から自動的に読み込まれます：
```
~/.claude/projects/[プロジェクト名]/[セッションID].jsonl
```

## 技術スタック

- **バックエンド**: Node.js + Express
- **フロントエンド**: Vanilla JavaScript + Bootstrap 5
- **データ形式**: JSONL（JSON Lines）

## API エンドポイント

- `GET /api/sessions` - 会話セッション一覧を取得
- `GET /api/sessions/:sessionId` - 特定セッションの会話内容を取得
- `GET /api/search?q=query` - 会話内容を検索

## 開発

開発モード（ファイル変更時に自動再起動）：
```bash
npm run dev
```

## ライセンス

MIT License