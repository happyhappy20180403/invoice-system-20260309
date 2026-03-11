# Repository Audit: Invoice System v2 (TAISUN Integration)

**調査日**: 2026-03-11

## 1. プロジェクト概要

**Production-ready フルスタック Invoice SaaS プラットフォーム**
- Xero連携、OCR自動化、RBAC、包括的モニタリング
- TAISUN フレームワーク: 96+ agents, 110+ skills

## 2. 技術スタック

| レイヤー | 技術 |
|---------|------|
| Framework | Next.js 16.1.6, React 19.2.4 |
| Auth | next-auth 5.0.0-beta.30 (Xero OIDC) |
| Database | SQLite (better-sqlite3) + Drizzle ORM |
| OCR | Tesseract.js 7.0, mupdf 1.27, pdf-parse 2.4 |
| UI | Tailwind CSS 4.2.1 |
| Test | Vitest (32 tests, 5 suites) |

## 3. ディレクトリ構造

```
/app          - Next.js App Router
  /api        - API routes (auth, xero, ocr, metrics)
  /actions    - Server actions (invoice, batch, admin, dashboard, sync, match)
  /components - React components
  /admin, /dashboard, /login, /help - Pages
/lib          - Core business logic
  /db         - Database (Drizzle ORM, SQLite)
  /xero       - Xero OAuth & API integration
  /ocr        - OCR pipeline (5-method fallback chain)
  /metrics    - Monitoring
  /match      - Fuzzy matching (Fuse.js)
/scripts      - Migration & seeding
/__tests__    - 5 test suites
/.claude      - 96 agents, 110+ skills, MCP configs
```

## 4. DBスキーマ (10テーブル)

1. `users` - RBAC (admin/accountant/staff)
2. `xeroTokens` - 暗号化OAuth tokens
3. `invoiceHistory` - インポート履歴
4. `contactsCache` - Xero contacts キャッシュ
5. `accountCodeMappings` - 勘定科目マッピング
6. `createdInvoices` - 監査証跡
7. `systemConfig` - KVストア
8. `apiMetrics` - APIパフォーマンス
9. `systemMetrics` - システムヘルス
10. `ocrUploads` - OCRアップロード

## 5. API Routes

| Endpoint | Method | 用途 |
|----------|--------|------|
| `/api/auth/[...nextauth]` | ALL | Xero OIDC認証 |
| `/api/xero/health` | GET | トークン状態確認 |
| `/api/ocr` | POST | ファイルアップロード & OCR |
| `/api/ocr/feedback` | POST | OCRフィードバック |
| `/api/metrics` | GET | システムメトリクス |

## 6. 外部連携

### Xero API
- OAuth2 OIDC (access/refresh tokens, AES暗号化)
- Contacts, Accounts, TrackingCategories, Invoices, CreditNotes
- Rate limiting: 50 req/min, Batch: max 50/request

### OCR Pipeline (5段階フォールバック)
1. Google Cloud Vision (APIキーあれば)
2. pdf-parse (テキストPDF)
3. mupdf + Tesseract.js (スキャンPDF)
4. Tesseract.js (画像)
5. Mock (開発用)

## 7. MCP統合 (33サーバー登録)

GitHub, Firebase, Playwright, Vercel, PostgreSQL, Docker, Slack, Notion, Linear, Asana, Atlassian 等

## 8. 拡張ポイント

- **Middleware**: セッション + RBAC ルーティング
- **Server Actions**: 認証付きビジネスロジック
- **Metrics**: trackedFetch ラッパーで非同期収集
- **MCP**: 33サーバーで外部ツール統合済み
- **Agents**: 96エージェントで自律開発ワークフロー

## 9. CI/CD

- 明示的なCI/CDパイプラインなし（GitHub Actions未設定）
- Scripts: dev, build, start, db:push, db:seed, test

## 10. システム構築提案への示唆

### 既存の強み
- 多層フォールバック設計（OCR）
- 暗号化トークン管理
- RBAC + ミドルウェア
- 包括的テストスイート
- TAISUN 96エージェント基盤

### 拡張可能な領域
- SQLite → PostgreSQL + pgvector（ベクトル検索）
- CI/CD パイプライン追加
- リアルタイム通知（WebSocket/SSE）
- API Gateway / Rate Limiting の高度化
- マルチテナント対応
