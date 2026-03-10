# Agent A: MCP・スキル・拡張機能の発掘レポート

**調査日**: 2026-03-10
**Build target**: Xero API連携インボイス自動入力システム（Next.js + xero-node SDK + OAuth2）

---

## 1. XeroAPI/xero-mcp-server（公式）

| 項目 | 詳細 |
|------|------|
| **名前** | @xeroapi/xero-mcp-server |
| **Stars** | 205 |
| **npm version** | 0.0.14 |
| **インストール** | `npx -y @xeroapi/xero-mcp-server@latest` |
| **最終更新** | 2026-02-07 |
| **関連度** | 8/10 |

### 機能（40+ MCPコマンド）
- Contact/Invoice管理（CRUD）
- Chart of Accounts操作
- Payment/Bank Transaction処理
- Payroll（従業員、タイムシート、休暇管理）
- 財務レポート（P&L、BS、Trial Balance）
- Quote/Credit Note管理
- Tracking Categories/Tax Rates

### セットアップ
- **認証方式1**: Custom Connections（OAuth2 client_credentials）→ 単一組織向け
- **認証方式2**: Bearer Token（マルチアカウント対応）
- **環境変数**: `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET` または `XERO_CLIENT_BEARER_TOKEN`
- **要件**: Node.js v18+

### セキュリティ評価
- XeroAPI公式リポジトリ（信頼性高）
- OAuth2.0準拠、granular scopes対応
- Custom Connectionsはclient_credentialsグラントで交換ステップ不要
- **注意**: Bearer Tokenが設定されると優先されるため、env管理要注意

### 制限事項
- MCPプロトコル経由のみ（直接API呼び出し不可）
- Claude Desktop/Claude Code等のMCPクライアント必須
- バージョン0.0.14（まだpre-stable）

---

## 2. xero-mcp（コミュニティ版）

| 項目 | 詳細 |
|------|------|
| **名前** | xero-mcp |
| **Stars** | 144 |
| **npm downloads** | 15.8K |
| **インストール** | `npx -y xero-mcp@latest` |
| **リリース日** | 2025-03-26 |
| **関連度** | 6/10 |

### セキュリティ評価
- コミュニティ製（john-zhang-dev）
- TypeScript製
- 公式版と比較して機能が限定的な可能性
- ダウンロード数は多い（初期リリースが早かったため）

---

## 3. xero-node SDK（公式SDK）

| 項目 | 詳細 |
|------|------|
| **名前** | xero-node |
| **version** | 14.0.0 |
| **インストール** | `npm install xero-node` |
| **関連度** | 10/10 |

### 特徴
- Xero OpenAPIから自動生成
- OAuth2.0認証（openid-clientライブラリ使用）
- サーバーサイド専用（fs依存あり）
- マルチテナント対応
- Custom Connections対応（client_credentials grant）

### トークン管理
- token setをデータストアに保存推奨
- API呼び出し前にaccess_tokenリフレッシュ必要
- token set: id_token, access_token, expires_in, token_type, refresh_token, scope

### セキュリティ評価
- XeroAPI公式（最高信頼度）
- 認定OA2/OIDCライブラリ（openid-client）使用
- **注意**: サーバーサイド専用（Next.js API Routesで使用必須）

---

## 4. OAuth2ヘルパー: NextAuth.js / Auth.js

| 項目 | 詳細 |
|------|------|
| **名前** | next-auth / @auth/nextjs |
| **インストール** | `npm install next-auth` |
| **関連度** | 7/10 |

### Xero統合方法
- Xeroは**ビルトインプロバイダーに含まれない**
- カスタムOAuth2プロバイダーとして設定可能
- 設定項目: authorization endpoint, token endpoint, userinfo endpoint

### 推奨アプローチ
```typescript
// カスタムXeroプロバイダー例
{
  id: "xero",
  name: "Xero",
  type: "oauth",
  authorization: "https://login.xero.com/identity/connect/authorize",
  token: "https://identity.xero.com/connect/token",
  userinfo: "https://api.xero.com/connections",
  clientId: process.env.XERO_CLIENT_ID,
  clientSecret: process.env.XERO_CLIENT_SECRET,
}
```

### セキュリティ評価
- 業界標準認証ライブラリ
- 50+ビルトインプロバイダー実績
- CSRF保護、JWT/Session管理内蔵

---

## 5. SQLite MCP Server（履歴データ用）

| 項目 | 詳細 |
|------|------|
| **名前** | @anthropic/mcp-server-sqlite |
| **インストール** | Claude Code内蔵 or `npx` |
| **関連度** | 7/10 |

### 機能
- テーブル一覧・スキーマ取得
- SELECT/INSERT/UPDATE/DELETEクエリ実行
- テーブル作成
- Claude Desktopとの直接統合

### 用途
- インボイス履歴データのローカルキャッシュ
- Xero APIレート制限回避（60/min, 5000/day）
- オフライン時の参照データ

### セキュリティ評価
- Anthropic公式実装あり（高信頼度）
- ローカルファイルアクセスのみ（ネットワーク不要）
- 複数DB接続対応

---

## 6. Claude Code Skills & MCP

### Context7 MCP（ドキュメント参照）

| 項目 | 詳細 |
|------|------|
| **名前** | @upstash/context7-mcp |
| **インストール** | `claude mcp add context7 -- npx -y @upstash/context7-mcp@latest` |
| **関連度** | 9/10 |

- リアルタイムでバージョン固有のドキュメント取得
- Next.js 15 App Router, xero-node等の最新APIドキュメント参照
- ハルシネーション防止
- Node.js 18+必要

### darraghh1/my-claude-setup（Next.js/Supabase向け）

| 項目 | 詳細 |
|------|------|
| **名前** | my-claude-setup |
| **URL** | https://github.com/darraghh1/my-claude-setup |
| **関連度** | 5/10 |

- Claude Code設定フレームワーク
- agents, skills, hooks, rules, MCP server設定
- Next.js/Supabase/TypeScriptプロジェクト向け

---

## 7. 評価: xero-mcp-server vs xero-node SDK

### Option A: xero-mcp-server直接利用

| Pros | Cons |
|------|------|
| セットアップ簡単（npx一発） | MCPクライアント依存 |
| 40+コマンド即利用可能 | カスタマイズ困難 |
| Claude Codeとの統合が自然 | バージョン0.0.14（不安定） |
| コード記述不要 | エラーハンドリング制限 |
| | Webアプリとしてデプロイ不可 |

### Option B: xero-node SDK in API Routes（推奨）

| Pros | Cons |
|------|------|
| 完全なAPI制御 | 実装コスト高 |
| エラーハンドリング自由 | OAuth2フロー自前実装 |
| Next.js API Routesでデプロイ可能 | トークン管理必要 |
| カスタムビジネスロジック | テスト実装必要 |
| レート制限対策を細かく制御 | |
| プロダクション品質 | |

### 推奨: ハイブリッドアプローチ

```
開発時: xero-mcp-server でプロトタイピング・テスト
本番:   xero-node SDK in Next.js API Routes
補助:   Context7 MCP でドキュメント参照
データ: SQLite MCP で履歴データキャッシュ
```

**理由**:
1. xero-mcp-serverは開発・デバッグ時にClaude Codeから直接Xero APIを叩けて便利
2. 本番システムはxero-node SDKでAPI Routes実装が必須（Webアプリとしてデプロイするため）
3. Context7でNext.js/xero-nodeの最新ドキュメントを常時参照
4. SQLiteでAPIレート制限回避用キャッシュ層

---

## ツール一覧サマリー

| ツール名 | 関連度 | 用途 | インストール |
|----------|--------|------|-------------|
| xero-node | 10/10 | 本番API統合 | `npm i xero-node` |
| @upstash/context7-mcp | 9/10 | ドキュメント参照 | `claude mcp add context7 -- npx -y @upstash/context7-mcp@latest` |
| @xeroapi/xero-mcp-server | 8/10 | 開発時プロトタイプ | `npx -y @xeroapi/xero-mcp-server@latest` |
| next-auth | 7/10 | OAuth2認証 | `npm i next-auth` |
| SQLite MCP | 7/10 | 履歴データキャッシュ | Claude Code内蔵 |
| xero-mcp (community) | 6/10 | 代替MCP | `npx -y xero-mcp@latest` |
| my-claude-setup | 5/10 | Claude Code設定参考 | GitHub clone |

---

## API レート制限対策

| 制限 | 値 | 対策 |
|------|-----|------|
| Per minute | 60 calls | SQLiteキャッシュ + リクエストキュー |
| Per day | 5,000 calls | バッチ処理（50件/回） |
| Batch size | 50 invoices | ページネーション実装 |

---

*Generated by Agent A - MCP/Skills Discovery*
