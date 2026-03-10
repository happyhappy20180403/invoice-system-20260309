# Step 1: Keyword Universe - Xero API Invoice Automation System

## Build Target
Xero API連携インボイス自動入力システム（Next.js + xero-node SDK + OAuth2 + 過去データ学習 + 自動補完）

---

## 1. core_keywords (コアキーワード)

| # | Keyword | 日本語 | Relevance |
|---|---------|--------|-----------|
| 1 | Xero API | Xero API | システム基盤 |
| 2 | Invoice Automation | インボイス自動化 | 主要機能 |
| 3 | xero-node SDK | xero-node SDK | 実装ライブラリ |
| 4 | OAuth2 Authentication | OAuth2認証 | API認証 |
| 5 | Auto-complete / Predictive Input | 自動補完・予測入力 | UX中核機能 |
| 6 | Historical Data Learning | 過去データ学習 | 知能化の核 |
| 7 | Property Management | 不動産管理 | ドメイン |
| 8 | Repair List Digitization | 修繕リスト電子化 | 入力ソース |
| 9 | Accounting API Integration | 会計API連携 | アーキテクチャ |
| 10 | Invoice Field Mapping | インボイスフィールドマッピング | データ変換 |

---

## 2. related（技術・ツール・概念）

### 技術
- Next.js (App Router / API Routes)
- TypeScript
- Prisma ORM
- PostgreSQL / SQLite
- React Hook Form
- Tailwind CSS
- NextAuth.js (OAuth2 session management)

### ツール・サービス
- Xero Developer Portal
- Xero App Store
- Hubdoc (Xero OCR)
- Vercel (deployment)
- GitHub Actions (CI/CD)

### 概念
- Token Refresh Flow (OAuth2)
- Rate Limiting (Xero API: 60 calls/min)
- Webhook / Polling
- Fuzzy Matching (過去データ照合)
- Contact Auto-resolution
- Account Code Mapping
- Tracking Category Assignment
- Tax Type Determination

---

## 3. compound（複合キーワード）

| Compound Keyword | 検索意図 |
|-----------------|---------|
| Xero インボイス自動化 | 直接ニーズ |
| Xero API 自動入力 | 実装方法 |
| 会計ソフト API連携 | 広域検索 |
| 請求書 自動作成 API | 機能検索 |
| xero-node OAuth2 認証 | 技術実装 |
| Next.js 会計システム | スタック検索 |
| 修繕リスト インボイス変換 | ドメイン特化 |
| 過去データ 予測入力 | AI/ML機能 |
| Property repair invoice automation | 英語圏検索 |
| Xero API bulk invoice creation | バッチ処理 |
| 不動産管理 経理自動化 | 業界ニーズ |
| Xero tracking category API | フィールド実装 |

---

## 4. rising_2026（急上昇・代理指標付き）

| Keyword | Trend Signal | Proxy Indicator |
|---------|-------------|-----------------|
| AI Accounting Agent | AIMultiple: Top 9 AI Agents in Accounting 2026 | Akira AI, Docyt GARY等の台頭 |
| Xero Tiered API Pricing 2026 | 2026年3月に新5段階料金体系導入 | API利用コスト最適化の需要増 |
| AP Automation AI | ChatFin: 2026年までにAP業務95%自動化予測 | Vic.ai, Rossum等の急成長 |
| Autonomous Finance Agent | AIMultiple記事で急上昇 | 人間判断不要の例外処理80%自動化 |
| e-Invoicing Mandate Compliance | EU圏で電子インボイス義務化拡大 | 日本インボイス制度との相乗 |
| Predictive Invoice Entry | 過去データML学習による予測入力 | 手動入力からの脱却トレンド |
| Xero Unified API (Apideck/Merge) | 統合API経由のXero連携が増加 | Merge.dev, Apideck記事増 |
| OCR + AI Invoice Extraction | Hubdoc/Odoo AI機能強化 | Document Capture進化 |

---

## 5. niche（競合少ない切り口）

| Niche Keyword | Why Low Competition |
|--------------|-------------------|
| Xero API 修繕管理 インボイス | 不動産修繕×Xero は極めてニッチ |
| xero-node Next.js App Router | Next.js App Router対応情報が少ない（webpack互換問題あり） |
| 5フィールド→フルインボイス自動補完 | 最小入力→最大出力のUXパターン |
| 過去データ学習 Contact推定 | 取引先自動推定は実装例少 |
| Property repair → Xero invoice pipeline | 英語圏でも修繕→会計パイプラインは希少 |
| Tracking Category 自動割当 | Xeroの管理タグ自動化は情報少 |
| Unit No → Account Code マッピング | 部屋番号ベースの勘定科目推定 |
| 日本語Detail → Xero Description変換 | 多言語変換+会計用語マッピング |

---

## 6. tech_stack_candidates

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js 14+ (App Router) | SSR + API Routes統合 |
| **UI** | Tailwind CSS + shadcn/ui | 高速UI構築 |
| **Form** | React Hook Form + Zod | バリデーション付きフォーム |
| **Auth** | NextAuth.js v5 | Xero OAuth2 provider対応 |
| **API Client** | xero-node SDK | 公式SDK（サーバーサイドのみ） |
| **DB** | PostgreSQL (Supabase) | 過去データ・トークン保存 |
| **ORM** | Prisma | 型安全なDB操作 |
| **Matching** | Fuse.js | クライアント側Fuzzy検索 |
| **Deploy** | Vercel | Next.jsネイティブ対応 |
| **CI/CD** | GitHub Actions | 自動テスト・デプロイ |
| **Monitoring** | Sentry | エラー追跡 |

### Next.js + xero-node 注意点
- xero-nodeはNode.js専用（`fs`依存）→ API Routes / Server Actionsでのみ使用
- クライアントサイドでの直接importは不可（webpack `fs` resolve error）

---

## 7. mcp_skills_needed

| Skill | Usage |
|-------|-------|
| **WebSearch** | Xero API仕様調査、トレンドリサーチ |
| **WebFetch** | Xero Developer Docs取得、npm package情報 |
| **Read / Edit** | コード実装・修正 |
| **Bash** | プロジェクト構築、npm操作、Git管理 |
| **Glob / Grep** | コードベース検索・パターン発見 |
| **mcp__ide__executeCode** | TypeScript/JS コード実行テスト |
| **mcp__ide__getDiagnostics** | 型エラー・lint問題の検出 |
| **NotebookEdit** | データ分析・プロトタイピング |

---

## Sources
- [Xero Developer - Accounting API Invoices](https://developer.xero.com/documentation/api/accounting/invoices)
- [Guide to Xero Automation in 2026 | Coupler.io](https://blog.coupler.io/xero-automation/)
- [Xero Integrations: Complete Guide 2026 | Apideck](https://www.apideck.com/blog/xero-integrations)
- [Top 9 AI Agents in Accounting 2026 | AIMultiple](https://aimultiple.com/accounting-ai-agent)
- [AI-Powered AP Automation 2026 | ChatFin](https://chatfin.ai/blog/ai-powered-ap-automation-complete-accounts-payable-transformation-2026/)
- [Best Invoice Automation Software 2026 | Ramp](https://ramp.com/blog/accounts-payable/best-invoice-automation-software-solutions)
- [xero-node SDK - npm](https://www.npmjs.com/package/xero-node)
- [xero-node Next.js webpack issue #543](https://github.com/XeroAPI/xero-node/issues/543)
- [Node.js/React Xero Integration Guide](https://nodevision.com.au/blog/post/how-to-integrate-nodejsreact-app-with-xero/)
