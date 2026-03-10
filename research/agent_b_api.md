# Agent B: API / Library / SaaS / Package Research Report

**Date:** 2026-03-10
**Build Target:** Xero API連携インボイス自動入力システム（Next.js + xero-node SDK + OAuth2）

---

## 1. xero-node SDK

### Current Status
- **Latest version:** 13.3.0 (npm, published ~Feb 2026)
- **Weekly downloads:** ~26,005
- **License:** MIT
- **Note:** STEP 1で想定されたv14.0.0は未リリース。現行最新はv13.3.0。

### webpack互換性問題 (Issue #543)
- **問題:** `fs` モジュール依存により Next.js クライアントサイドでビルドエラー発生
- **原因:** xero-nodeの依存パッケージ（got等）がNode.js専用の `fs` を参照
- **解決策:**
  - Next.js 15 App Router: `next.config.js` の `serverExternalPackages` に `xero-node` を追加
  - サーバーサイド専用（API Routes, Server Actions）でのみ使用
  - Webpack 5設定で `fs` をクライアント側で空モジュール化

### SDK vs 直接REST API呼び出し
| 項目 | xero-node SDK | 直接REST API |
|------|--------------|-------------|
| 型安全性 | TypeScript型定義あり | 自前で定義必要 |
| メンテナンス | Xero公式メンテ | 自己責任 |
| バンドルサイズ | 大（fs依存含む） | 軽量 |
| 柔軟性 | SDK仕様に依存 | 完全に自由 |
| 参考実装 | - | [XeroAPI/node-oauth2-example](https://github.com/XeroAPI/node-oauth2-example) |

**推奨:** 小規模プロジェクトのため、直接REST APIでの実装を推奨。xero-nodeのwebpack問題を回避でき、バンドルサイズも削減可能。OAuth2フローはAuth.jsで処理し、API呼び出しは `fetch` で直接行う。

### 非推奨/廃止スケジュール
- 2026年4月28日に一部エンドポイント非推奨化の予定あり（Employment POST関連）
- SDK自体の完全廃止情報は未確認

---

## 2. 認証ライブラリ

### Auth.js (NextAuth.js v5)
- **Package:** `next-auth@5.x` / `@auth/core`
- **License:** ISC
- **Xero Built-in Provider:** なし（カスタムプロバイダーとして実装が必要）

### カスタムXero OAuth2プロバイダー設定

```typescript
// Xero OAuth2 Custom Provider for Auth.js v5
import type { OAuthConfig } from "@auth/core/providers";

export const XeroProvider: OAuthConfig<XeroProfile> = {
  id: "xero",
  name: "Xero",
  type: "oauth",
  authorization: {
    url: "https://login.xero.com/identity/connect/authorize",
    params: { scope: "openid profile email accounting.transactions accounting.contacts offline_access" }
  },
  token: "https://identity.xero.com/connect/token",
  userinfo: "https://api.xero.com/connections",
  clientId: process.env.XERO_CLIENT_ID,
  clientSecret: process.env.XERO_CLIENT_SECRET,
  profile(profile) {
    return { id: profile.sub, name: profile.name, email: profile.email };
  }
};
```

### 注意事項
- Auth.js v5は厳格なOAuth/OIDC仕様準拠のため、Xeroの独自実装部分で調整が必要な可能性あり
- Xero APIアクセスにはtenantId（Xero-Tenant-Id ヘッダー）が必須 → connectionsエンドポイントから取得

---

## 3. データベース（トークン保存 + 履歴データ）

### ORM比較

| 項目 | Prisma + SQLite | Drizzle ORM + SQLite | better-sqlite3（直接） |
|------|----------------|---------------------|---------------------|
| **License** | Apache-2.0 | Apache-2.0 | MIT |
| **型安全性** | 生成型（prisma generate必要） | 推論型（即時反映） | 自前定義 |
| **バンドルサイズ** | 大（Prisma 7で改善済、pure TS化） | 極小 | 極小 |
| **学習コスト** | 低（抽象度高い） | 中（SQL知識必要） | 高（生SQL） |
| **マイグレーション** | 組み込み（prisma migrate） | drizzle-kit | 手動 |
| **Edge対応** | 限定的 | 良好 | N/A |

**推奨:** **Drizzle ORM + better-sqlite3**
- 理由: 軽量、型安全、SQLiteとの相性良好、サーバーレスコールドスタートが速い
- ローカルホスト専用であればEdge対応は不要だが、将来のVercelデプロイにも対応可能

### トークン暗号化
- **推奨:** Node.js組み込み `crypto` モジュール（AES-256-GCM）
- 外部パッケージ不要、ゼロ依存
- 実装: `crypto.createCipheriv('aes-256-gcm', key, iv)` でaccess/refresh tokenを暗号化してDB保存

---

## 4. ファジーマッチングライブラリ

### 比較

| 項目 | Fuse.js | FlexSearch | MiniSearch |
|------|---------|-----------|-----------|
| **License** | Apache-2.0 | Apache-2.0 | MIT |
| **Weekly DL** | 5,372,794 | 511,630 | 556,339 |
| **GitHub Stars** | 19,703 | 13,440 | 5,595 |
| **ファジー検索** | 核心機能 | 限定的 | あり |
| **日本語対応** | 設定で対応可能 | トークナイザ要カスタム | トークナイザ要カスタム |
| **ユースケース** | タイポ許容の近似マッチ | 大量データ高速全文検索 | 中規模全文検索 |
| **バンドルサイズ** | ~25KB | ~6KB | ~8KB |

**推奨:** **Fuse.js**
- 理由: 連絡先名や説明文のファジーマッチングに最適、圧倒的ユーザー数、加重検索対応、導入簡易

---

## 5. コスト分析

### Xero API (2026年3月2日〜新料金体系)

| Tier | 月額費用 | 接続上限 | データ転送量/月 | 超過料金 |
|------|---------|---------|---------------|---------|
| **Starter** | **$0 AUD** | 5 | 無制限 | N/A |
| Core | $35 AUD | 50 | 10 GB | $2.40/GB |
| Plus | $245 AUD | 1,000 | 50 GB | $2.40/GB |
| Advanced | $1,445 AUD | 10,000 | 250 GB | $2.40/GB |
| Enterprise | カスタム | 無制限 | カスタム | カスタム |

**本プロジェクト:** Starterティア（$0/月）で十分。接続数5以内、個人利用。

### ホスティング

| 選択肢 | 月額費用 | 備考 |
|--------|---------|------|
| **ローカルホスト専用** | **$0** | 推奨。OAuthコールバックにngrok等が必要 |
| Vercel Hobby | $0 | SSR対応、SQLiteは制限あり（Turso等が必要） |
| Vercel Pro | $20 USD | 商用利用向け |
| VPS (fly.io等) | $5-10 USD | SQLiteフル対応、永続ディスク |

### 月額コスト見積もり（推奨構成）

詳細は `cost_breakdown.csv` を参照。

| 項目 | 月額 |
|------|------|
| Xero API (Starter) | $0 |
| ホスティング（ローカル） | $0 |
| ドメイン/SSL | $0 |
| **合計** | **$0** |

---

## 6. セキュリティ/CVEチェック

### 重大な脆弱性（要注意）

| CVE | 対象 | 深刻度 | 内容 | 対策 |
|-----|------|--------|------|------|
| CVE-2025-29927 | Next.js 11.1.4〜15.2.2 | Critical | Middleware認証バイパス | Next.js 15.2.3以上に更新 |
| CVE-2025-55182 | React Server Components | Critical (10.0) | RCE脆弱性 | React/Next.js最新版使用 |
| CVE-2025-66478 | Next.js | Critical | RSC関連RCE | Next.js最新版使用 |

### パッケージ別ステータス

| パッケージ | 既知CVE | 状態 |
|-----------|--------|------|
| xero-node | なし | 安全（npm socket.devで確認） |
| next-auth / @auth/core | なし | 安全 |
| prisma | なし | 安全 |
| drizzle-orm | なし | 安全（snyk確認） |
| fuse.js | なし | 安全 |
| better-sqlite3 | なし | 安全 |

**最重要:** Next.js は必ず **15.2.3以上**（推奨: 15.x最新）を使用すること。

---

## 7. ライセンス互換性

| パッケージ | ライセンス | 商用利用 | 互換性 |
|-----------|----------|---------|--------|
| xero-node | MIT | OK | 問題なし |
| next-auth / @auth/core | ISC | OK | 問題なし |
| Next.js | MIT | OK | 問題なし |
| Prisma | Apache-2.0 | OK | 問題なし |
| Drizzle ORM | Apache-2.0 | OK | 問題なし |
| better-sqlite3 | MIT | OK | 問題なし |
| Fuse.js | Apache-2.0 | OK | 問題なし |
| Node.js crypto | 組み込み | OK | N/A |

**全パッケージMIT/Apache-2.0/ISC — GPL汚染なし、商用利用可、ライセンス互換性に問題なし。**

---

## 推奨技術スタック（まとめ）

```
フレームワーク:   Next.js 15.x (App Router) — 必ず15.2.3以上
認証:            Auth.js v5 + カスタムXeroプロバイダー
API呼び出し:     直接REST API (fetch) — xero-node SDKは不使用
ORM/DB:          Drizzle ORM + better-sqlite3
ファジーマッチ:   Fuse.js
トークン暗号化:   Node.js crypto (AES-256-GCM)
月額コスト:       $0（ローカルホスト + Starter Tier）
```
