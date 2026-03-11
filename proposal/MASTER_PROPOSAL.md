# MASTER_PROPOSAL.md
# MCPエコシステム・インテリジェンス・ハブ (MIH)
# AIツール発見・品質評価・トレンド分析プラットフォーム

**作成日**: 2026-03-11
**作成者**: Principal Architect (TAISUN v2)
**ステータス**: Proposed → レビュー待ち
**対象リポジトリ**: Invoice System20260309 (TAISUN統合済みNext.js SaaS)

---

## 目次

1. [Executive Summary](#1-executive-summary)
2. [市場地図](#2-市場地図)
3. [Keyword Universe](#3-keyword-universe)
4. [データ取得戦略](#4-データ取得戦略)
5. [正規化データモデル](#5-正規化データモデル)
6. [TrendScore算出](#6-trendscore算出)
7. [システムアーキテクチャ図](#7-システムアーキテクチャ図)
8. [実装計画](#8-実装計画)
9. [セキュリティ/法務/運用](#9-セキュリティ法務運用)
10. [リスクと代替案](#10-リスクと代替案)
11. [Go/No-Go意思決定ポイント](#11-gono-go意思決定ポイント)
12. [リポジトリ変更案](#12-リポジトリ変更案)

---

## 1. Executive Summary

### 狙い
MCPエコシステムは2026年3月時点で **18,387サーバー(mcp.so)** / **18,964サーバー(glama.ai)** が登録され、MCP SDKのnpmダウンロード数は **週350万件** に達する爆発的成長を見せている。しかし、この巨大なエコシステムには致命的な欠陥がある: **品質評価が存在しない**。

本プロジェクト「MCP Intelligence Hub (MIH)」は、MCPサーバー・AIツール・APIの品質スコアリングと日本語コミュニティ特化のインテリジェンス・プラットフォームを構築する。

### 価値提案 (3点)
| 価値 | 説明 | 競合との差 |
|------|------|-----------|
| **品質スコアリング** | セキュリティ・可観測性・ライセンス・活動頻度を自動評価 | 既存サービス全てに皆無 |
| **日本語コミュニティ特化** | Zenn(2,095件)/Qiita/日本語Discordの統合分析 | 英語圏サービスがゼロカバー |
| **クロスソーストレンド** | GitHub×npm×HN×Reddit×Zennの複合スコア | 単一ソース依存からの脱却 |

### 差別化
競合mcp.so(18,387件)・glama.ai(1,042件)・smithery.ai は **キュレーション品質が低く、日本語対応が皆無**。本サービスは量ではなく「信頼できる品質情報」で差別化する。

### コスト概要
- **Phase 1 (Month 1)**: $0〜$7/月 (Neon Free + Upstash Free + Render Free)
- **Phase 2 (Month 2-3)**: $32/月 (Neon Launch + Upstash従量 + Render Starter)
- **Phase 3 (Month 3-6)**: $300〜$500/月 (本番スケール)

### ROI試算
- 日本語MCPコミュニティのZenn記事: 2,095件(確認日2026-03-11)、月100件ペースで増加中
- 開発者向けSaaSの日本市場: MCPツールに特化したインテリジェンス製品は現時点で存在しない
- Phase 2完了時点でのターゲットMAU: 500ユーザー (MCP開発者・AIエンジニア)
- Phase 3完了時点での有料転換目標: 50ユーザー × $29/月 = $1,450/月 MRR

### なぜ今か
1. MCP SDKが週23.7万DL(2025年5月) → 週350万DL(2026年3月)へ **15倍成長** — プロトコルが標準化フェーズに入った
2. Microsoft MCP curriculum (mcp-for-beginners) が15,300 Starsを獲得し、エンタープライズ普及が始まった
3. 競合サービスが品質問題を認識しつつも解決できていない空白期間 (2026年前半が参入最適ウィンドウ)

---

## 2. 市場地図

### 全体マップ: 14サイト調査結果統合

#### MCP/Skillsディレクトリ (7サイト)

```
┌─────────────────────────────────────────────────────────────────┐
│                   MCP/Skills市場 (2026-03-11)                    │
├───────────────┬───────────┬──────────────┬───────────────────────┤
│  プラット    │ 登録数    │ API有無      │ 特徴・弱点            │
├───────────────┼───────────┼──────────────┼───────────────────────┤
│ mcp.so        │ 18,387    │ あり(APIキー)│ 最大規模/品質低        │
│ glama.ai      │ 18,964    │ あり         │ ヘルス表示あり/小規模  │
│ smithery.ai   │ 7,300+    │ あり(429制限)│ ホスティング強み       │
│ composio.dev  │ 850kit    │ SDK+REST     │ 20+カテゴリ/SOC2認定  │
│ rapidapi.com  │ 非公開    │ Hub API      │ 世界最大(Nokia傘下)   │
│ huggingface   │ 200万+    │ 完全公開     │ Stars/DL/更新日が充実 │
│ libraries.io  │ 1,073万+  │ 制限付き     │ 32PM横断/詳細は有料   │
│ public-apis   │ 406k Stars│ なし(静的MD) │ 50+カテゴリ           │
└───────────────┴───────────┴──────────────┴───────────────────────┘
```

#### 拡張機能マーケット (7サイト)

```
┌─────────────────────────────────────────────────────────────────┐
│                拡張機能マーケット (2026-03-11)                    │
├───────────────────┬──────────┬────────────┬─────────────────────┤
│ マーケット        │ 登録数   │ API対応    │ MCP/AI関連          │
├───────────────────┼──────────┼────────────┼─────────────────────┤
│ WordPress Plugins │ 61,000+  │ S(認証不要)│ AI Experiments(β)   │
│ Atlassian Market  │ 8,000+   │ A(REST+GQL)│ Rovo/AIカテゴリ新設 │
│ VS Code Marketplace│ 数万+   │ A(REST)    │ MCP専用カテゴリあり  │
│ Shopify App Store │ 16,000+  │ B(認証要)  │ AIツール多数         │
│ Salesforce AppExch│ 非公開   │ B(未確認)  │ Agentforce対応       │
│ Chrome Web Store  │ 非公開   │ C(Publish) │ AI拡張多数           │
│ Notion Integrations│ 非公開  │ C(別物)    │ カタログAPIなし      │
└───────────────────┴──────────┴────────────┴─────────────────────┘
```

#### 統合優先度マトリクス (データ取得容易性 × 情報価値)

```
        情報価値
高 │ HuggingFace ●    mcp.so ●
   │              glama.ai ●
   │ VS Code Mkt ●
   │ WordPress ●
低 │              Chrome●  Notion●
   └──────────────────────────────
      容易(無料API)  → 困難(認証/制限)
```

**統合順序**: HuggingFace > mcp.so > glama.ai > VS Code > WordPress > Atlassian > smithery.ai

---

## 3. Keyword Universe

### 80キーワード分類サマリー (keyword_universe.csv準拠)

#### カテゴリ別分布

| カテゴリ | 件数 | 代表キーワード | 代理指標 |
|---------|------|--------------|---------|
| core_keywords | 8 | Model Context Protocol, MCP server, MCP registry | GitHub Stars: 82,700 / glama.ai登録: 18,964 |
| related | 13 | fastmcp, TypeScript MCP SDK, remote MCP server | fastmcp: 23,600 Stars / SDK週350万DL |
| compound | 15 | MCP自動化, AI tool discovery, MCP server aggregator | トレンド指標(複合) |
| rising_2026 | 13 | fastmcp framework, agentic workflow, MCP品質評価 | 急上昇: mcp-for-beginners 15,300 Stars |
| niche | 12 | 業界特化MCPサーバー, MCP監査ツール, 財務向けMCPサーバー | 競合少 / 差別化可能 |
| tech_stack | 10 | TypeScript, Python, fastmcp, PostgreSQL, Zod | TypeScript: 1,473 repos / Python: 1,334 repos |
| mcp_skills_needed | 9 | Playwright MCP, GitHub MCP, Firecrawl MCP | Playwright週1.7M訪問 |

#### 最重要キーワード (TrendScore上位推定)

| 順位 | キーワード | 根拠指標 | 対象アクション |
|------|-----------|---------|--------------|
| 1 | Model Context Protocol | GitHub 82,700 Stars / 4,420+ repos | コアコンセプト、全タグ適用 |
| 2 | Playwright MCP | 週1.7M訪問 (断トツ1位) | ケーススタディ作成 |
| 3 | fastmcp | 23,600 Stars / Apache 2.0 | フレームワーク推奨候補 |
| 4 | MCP品質評価 | 業界課題 / 先行なし | 本プロジェクトの核心差別化 |
| 5 | agentic workflow | Google Trend急上昇 / 2025主要トレンド | コンテンツ戦略軸 |
| 6 | 日本語MCPコミュニティ | Zenn 2,095件 / 月増加中 | 言語差別化戦略 |

#### Nichemキーワード (収益機会)
本プロジェクトに直結するニッチ群:
- `財務向けMCPサーバー` — 既存Invoice Systemとの直接シナジー
- `MCP監査ツール` / `compliance MCP` — セキュリティ差別化
- `MCP multi-tenancy` — エンタープライズ展開
- `AIツール使用量分析` — プラットフォーム機能として自然な拡張

---

## 4. データ取得戦略

### ソース別取得方法・規約・コスト

#### Tier 1: 無料・認証不要 (即日開始可能)

| ソース | エンドポイント | 無料枠 | 規約ポイント | 確認日 |
|-------|--------------|--------|------------|--------|
| GitHub REST API | `api.github.com/repos/{owner}/{repo}` | 5,000 req/時(認証) / 60 req/時(未認証) | Personal Access Token推奨 | 2026-03-11 |
| npm Registry | `registry.npmjs.org/{package}` | 無制限 | 公開データ / 商用可 | 2026-03-11 |
| npm Downloads | `api.npmjs.org/downloads/point/last-week/{pkg}` | 無制限 | 公開データ / 商用可 | 2026-03-11 |
| OSV.dev | `api.osv.dev/v1/query` | 完全無料 | Apache 2.0 / 商用可 | 2026-03-11 |
| HN Algolia | `hn.algolia.com/api/v1/search` | 無料 | 公開API | 2026-03-11 |
| WordPress API | `api.wordpress.org/plugins/info/1.2/` | 認証不要 | 公開 / 29メタデータ項目 | 2026-03-11 |

#### Tier 2: APIキー必要 (数日以内に開始可能)

| ソース | 取得方法 | 無料枠 | コスト発生タイミング |
|-------|---------|--------|-------------------|
| HuggingFace API | hf.co → Settings → Access Tokens | 無料推論枠あり | Pro $9/月 (推論超過時) |
| mcp.so API | mcp.so → APIキー申請 | 不明 | 有料プランで解放想定 |
| Atlassian Marketplace | marketplace.atlassian.com/rest/2/ | 公開REST | 無料 (現時点) |
| VS Code Marketplace | `/_apis/public/gallery/extensionquery` | 公開 | 無料 |

#### Tier 3: robots.txt / 規約要確認

| ソース | robots.txt状況 | 代替手段 |
|-------|--------------|---------|
| mcp.so | `?*q=` クエリパラメータをDisallow | API経由でのみアクセス |
| smithery.ai | 429エラー多発 | 公式APIドキュメント待ち / バックオフ実装 |
| Shopify | Partner API (認証要) | OAuthフロー経由 |

#### データ収集フロー実装例

```typescript
// lib/mih/collectors/github.ts
import { Octokit } from '@octokit/rest';

interface GitHubRepoMeta {
  fullName: string;
  stars: number;
  starsDelta7d: number;  // 週間増加数 (定期取得で差分計算)
  forks: number;
  openIssues: number;
  lastCommitAt: Date;
  license: string | null;
  topics: string[];
  language: string | null;
}

const octokit = new Octokit({ auth: process.env.GITHUB_PAT });

export async function fetchRepoMeta(owner: string, repo: string): Promise<GitHubRepoMeta> {
  const { data } = await octokit.repos.get({ owner, repo });
  return {
    fullName: data.full_name,
    stars: data.stargazers_count,
    starsDelta7d: 0,           // cron差分で埋める
    forks: data.forks_count,
    openIssues: data.open_issues_count,
    lastCommitAt: new Date(data.pushed_at),
    license: data.license?.spdx_id ?? null,
    topics: data.topics ?? [],
    language: data.language,
  };
}
```

```typescript
// lib/mih/collectors/npm.ts
export async function fetchNpmWeeklyDownloads(packageName: string): Promise<number> {
  const res = await fetch(
    `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(packageName)}`
  );
  if (!res.ok) return 0;
  const json = await res.json();
  return json.downloads ?? 0;
}
```

```typescript
// lib/mih/collectors/osv.ts
interface OsvVulnerability {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  aliases: string[];
}

export async function checkVulnerabilities(packageName: string, version: string): Promise<OsvVulnerability[]> {
  const res = await fetch('https://api.osv.dev/v1/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      package: { name: packageName, ecosystem: 'npm' },
      version,
    }),
  });
  const json = await res.json();
  return json.vulns ?? [];
}
```

#### コスト発生タイミングの整理

```
$0    : GitHub PAT + npm API + OSV.dev + HN Algolia + WordPress API (Day 1〜)
$0〜$7: Render Free Tier (リクエスト制限あり) / Neon Free 0.5GB
$7   : Render Starter ($7/月) — 本番運用開始時
$32  : Neon Launch ($15) + Upstash従量 ($10) + Render Starter ($7) — Phase 2
$300+: Neon Scale + Redis Pro + CDN — Phase 3 (MAU 1,000+時)
```

---

## 5. 正規化データモデル

### TypeScript Interface 定義

```typescript
// lib/mih/types/index.ts

/** ツール/MCPサーバーのソース種別 */
export type SourceKind =
  | 'mcp_server'      // MCPサーバー
  | 'npm_package'     // npmパッケージ
  | 'huggingface_model' // HuggingFaceモデル
  | 'vscode_extension'  // VS Code拡張
  | 'api_endpoint';     // REST API

/** ライセンス種別 (採用可否判定用) */
export type LicenseKind = 'MIT' | 'Apache-2.0' | 'BSD-3-Clause' | 'ISC' | 'AGPL-3.0' | 'GPL-3.0' | 'UNKNOWN' | 'PROPRIETARY';

/** セキュリティ脆弱性 */
export interface Vulnerability {
  osvId: string;         // OSV.dev ID (e.g. "GHSA-xxxx-xxxx-xxxx")
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  summary: string;
  aliases: string[];     // CVE番号等
  fixedVersion: string | null;
}

/** GitHubメトリクス (毎日更新) */
export interface GitHubMetrics {
  stars: number;
  starsDelta7d: number;  // 週間スター増加数
  starsDelta30d: number;
  forks: number;
  openIssues: number;
  lastCommitAt: Date;
  commitsLast30d: number;
  contributorsCount: number;
}

/** npmメトリクス (週次更新) */
export interface NpmMetrics {
  weeklyDownloads: number;
  weeklyDownloadsDelta: number; // 前週比
  monthlyDownloads: number;
  latestVersion: string;
  publishedAt: Date;
}

/** コミュニティシグナル (日次更新) */
export interface CommunitySignals {
  hnMentions7d: number;      // HN Algolia API
  redditMentions7d: number;  // Reddit API (公開)
  zennArticles7d: number;    // Zenn API (日本語特化)
  twitterMentions7d: number; // オプション
}

/** 品質スコア (算出結果) */
export interface QualityScore {
  total: number;              // 0-100
  security: number;           // セキュリティ評価 (0-100)
  activity: number;           // 開発活動度 (0-100)
  documentation: number;      // ドキュメント品質 (0-100)
  licenseCompliance: boolean; // MIT/Apache採用でtrue
  hasTests: boolean;
  hasCi: boolean;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

/** TrendScore (算出結果) */
export interface TrendScore {
  score: number;     // 0-100
  tier: 'hot' | 'warm' | 'cold';
  components: {
    starsDelta: number;    // 0.35 weight
    npmGrowth: number;     // 0.25 weight
    community: number;     // 0.20 weight
    hnReddit: number;      // 0.10 weight
    recency: number;       // 0.10 weight
  };
  calculatedAt: Date;
}

/** MCPサーバー固有メタデータ */
export interface McpServerMeta {
  transportType: 'stdio' | 'streamable_http' | 'http_sse';
  authMethod: 'none' | 'api_key' | 'oauth2' | 'soc2';
  deployType: 'local' | 'remote' | 'hybrid';
  installCommand: string | null;   // e.g. "npx @playwright/mcp@latest"
  isOfficialAnthopic: boolean;
  isSoc2Certified: boolean;
  toolsCount: number | null;       // 提供ツール数
}

/** メインエンティティ: AIツール/MCPサーバー */
export interface AiTool {
  // 識別子
  id: string;                    // UUID v4
  sourceKind: SourceKind;
  slug: string;                  // URL用スラッグ (e.g. "playwright-mcp")
  externalId: string;            // 外部ID (GitHub full_name等)

  // 基本情報
  name: string;
  description: string;
  homepage: string | null;
  githubUrl: string | null;
  npmPackageName: string | null;
  logoUrl: string | null;
  authorName: string;
  authorOrgUrl: string | null;

  // 分類
  primaryCategory: string;       // e.g. "Browser Automation"
  secondaryCategories: string[];
  tags: string[];
  language: string | null;       // TypeScript / Python / etc.

  // ライセンス
  license: LicenseKind;
  isCommercialFriendly: boolean; // MIT/Apache = true, AGPL = false

  // メトリクス (別テーブルで管理、joinして取得)
  githubMetrics?: GitHubMetrics;
  npmMetrics?: NpmMetrics;
  communitySignals?: CommunitySignals;

  // スコア
  qualityScore?: QualityScore;
  trendScore?: TrendScore;

  // 脆弱性
  vulnerabilities?: Vulnerability[];
  lastVulnCheckAt: Date | null;

  // MCP固有
  mcpMeta?: McpServerMeta;

  // システム
  createdAt: Date;
  updatedAt: Date;
  lastIndexedAt: Date;
  isActive: boolean;
}

/** タイムシリーズ記録 (トレンド計算用) */
export interface MetricsSnapshot {
  id: string;
  toolId: string;
  snapshotDate: Date;            // YYYY-MM-DD
  stars: number;
  weeklyDownloads: number;
  hnMentions: number;
  redditMentions: number;
  zennArticles: number;
}
```

### PostgreSQL スキーマ設計

```sql
-- migration: 0002_mih_schema.sql

-- 拡張機能
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- 日本語検索用

-- Enum型
CREATE TYPE source_kind AS ENUM (
  'mcp_server', 'npm_package', 'huggingface_model', 'vscode_extension', 'api_endpoint'
);
CREATE TYPE license_kind AS ENUM (
  'MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC', 'AGPL-3.0', 'GPL-3.0', 'UNKNOWN', 'PROPRIETARY'
);
CREATE TYPE trend_tier AS ENUM ('hot', 'warm', 'cold');
CREATE TYPE quality_grade AS ENUM ('A', 'B', 'C', 'D', 'F');

-- メインテーブル
CREATE TABLE mih_tools (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_kind           source_kind NOT NULL,
  slug                  TEXT UNIQUE NOT NULL,
  external_id           TEXT NOT NULL,              -- GitHub full_name 等

  -- 基本情報
  name                  TEXT NOT NULL,
  description           TEXT,
  homepage              TEXT,
  github_url            TEXT,
  npm_package_name      TEXT,
  logo_url              TEXT,
  author_name           TEXT NOT NULL DEFAULT '',
  author_org_url        TEXT,

  -- 分類
  primary_category      TEXT NOT NULL DEFAULT 'Uncategorized',
  secondary_categories  TEXT[] DEFAULT '{}',
  tags                  TEXT[] DEFAULT '{}',
  language              TEXT,

  -- ライセンス
  license               license_kind NOT NULL DEFAULT 'UNKNOWN',
  is_commercial_friendly BOOLEAN NOT NULL DEFAULT false,

  -- GitHub最新値 (スナップショット用フラット)
  gh_stars              INTEGER DEFAULT 0,
  gh_stars_delta_7d     INTEGER DEFAULT 0,
  gh_forks              INTEGER DEFAULT 0,
  gh_open_issues        INTEGER DEFAULT 0,
  gh_last_commit_at     TIMESTAMPTZ,
  gh_commits_30d        INTEGER DEFAULT 0,

  -- npm最新値
  npm_weekly_downloads  INTEGER DEFAULT 0,
  npm_weekly_delta      INTEGER DEFAULT 0,
  npm_latest_version    TEXT,
  npm_published_at      TIMESTAMPTZ,

  -- コミュニティシグナル (7日間)
  community_hn_7d       INTEGER DEFAULT 0,
  community_reddit_7d   INTEGER DEFAULT 0,
  community_zenn_7d     INTEGER DEFAULT 0,

  -- TrendScore
  trend_score           NUMERIC(5,2) DEFAULT 0,
  trend_tier            trend_tier DEFAULT 'cold',
  trend_calculated_at   TIMESTAMPTZ,

  -- QualityScore
  quality_total         NUMERIC(5,2) DEFAULT 0,
  quality_security      NUMERIC(5,2) DEFAULT 0,
  quality_activity      NUMERIC(5,2) DEFAULT 0,
  quality_documentation NUMERIC(5,2) DEFAULT 0,
  quality_license_ok    BOOLEAN DEFAULT false,
  quality_has_tests     BOOLEAN DEFAULT false,
  quality_has_ci        BOOLEAN DEFAULT false,
  quality_grade         quality_grade DEFAULT 'F',

  -- MCP固有
  mcp_transport         TEXT,                       -- 'stdio' | 'streamable_http' | 'http_sse'
  mcp_auth_method       TEXT,
  mcp_deploy_type       TEXT,
  mcp_install_command   TEXT,
  mcp_is_official       BOOLEAN DEFAULT false,
  mcp_is_soc2           BOOLEAN DEFAULT false,
  mcp_tools_count       INTEGER,

  -- 脆弱性
  last_vuln_check_at    TIMESTAMPTZ,
  has_critical_vuln     BOOLEAN DEFAULT false,

  -- システム
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_indexed_at       TIMESTAMPTZ,
  is_active             BOOLEAN DEFAULT true,

  -- 全文検索インデックス (日本語対応)
  search_vector         TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || array_to_string(tags, ' '))
  ) STORED
);

-- インデックス
CREATE INDEX idx_mih_tools_trend_score ON mih_tools (trend_score DESC);
CREATE INDEX idx_mih_tools_source_kind ON mih_tools (source_kind);
CREATE INDEX idx_mih_tools_primary_category ON mih_tools (primary_category);
CREATE INDEX idx_mih_tools_license ON mih_tools (license);
CREATE INDEX idx_mih_tools_search ON mih_tools USING gin(search_vector);
CREATE INDEX idx_mih_tools_tags ON mih_tools USING gin(tags);
CREATE INDEX idx_mih_tools_updated ON mih_tools (updated_at DESC);

-- タイムシリーズスナップショット (トレンド計算用)
CREATE TABLE mih_metrics_snapshots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tool_id         UUID NOT NULL REFERENCES mih_tools(id) ON DELETE CASCADE,
  snapshot_date   DATE NOT NULL,

  stars                INTEGER DEFAULT 0,
  weekly_downloads     INTEGER DEFAULT 0,
  hn_mentions          INTEGER DEFAULT 0,
  reddit_mentions      INTEGER DEFAULT 0,
  zenn_articles        INTEGER DEFAULT 0,

  UNIQUE(tool_id, snapshot_date)
);
CREATE INDEX idx_snapshots_tool_date ON mih_metrics_snapshots (tool_id, snapshot_date DESC);

-- 脆弱性テーブル (正規化)
CREATE TABLE mih_vulnerabilities (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tool_id         UUID NOT NULL REFERENCES mih_tools(id) ON DELETE CASCADE,
  osv_id          TEXT NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('CRITICAL','HIGH','MEDIUM','LOW')),
  summary         TEXT,
  aliases         TEXT[] DEFAULT '{}',
  fixed_version   TEXT,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tool_id, osv_id)
);

-- 更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mih_tools_updated
BEFORE UPDATE ON mih_tools
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 6. TrendScore算出

### 公式

```
TrendScore = 0.35 × stars_delta_normalized
           + 0.25 × npm_growth_normalized
           + 0.20 × community_normalized
           + 0.10 × hn_reddit_normalized
           + 0.10 × recency_normalized
```

各成分は0〜100に正規化し、最終スコアも0〜100。

### 算出実装

```typescript
// lib/mih/scoring/trend-score.ts

interface TrendInputs {
  starsDelta7d: number;        // 週間スター増分
  starsTotal: number;          // 総スター数 (正規化用)
  npmWeeklyDownloads: number;  // 現在の週間DL数
  npmWeeklyDelta: number;      // 前週比 (正数 = 増加)
  communityZenn7d: number;     // Zenn記事(7日)
  communityHn7d: number;       // HN言及(7日)
  communityReddit7d: number;   // Reddit言及(7日)
  lastCommitAt: Date;          // 最終コミット
}

/** 0〜100にクランプ */
const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** 対数スケール正規化 (Stars, DL数の大きな範囲をカバー) */
const logNorm = (value: number, maxRef: number) =>
  clamp((Math.log1p(value) / Math.log1p(maxRef)) * 100);

export function calculateTrendScore(inputs: TrendInputs): TrendScore {
  // 1. stars_delta: 週間増分を対数スケールで正規化 (基準値: 1,000増/週 = 100点)
  const starsDeltaNorm = logNorm(Math.max(0, inputs.starsDelta7d), 1000);

  // 2. npm_growth: (現在DL - 前週DL) / 前週DL * 100 の成長率
  const prevWeek = inputs.npmWeeklyDownloads - inputs.npmWeeklyDelta;
  const npmGrowthPct = prevWeek > 0
    ? (inputs.npmWeeklyDelta / prevWeek) * 100
    : (inputs.npmWeeklyDownloads > 0 ? 50 : 0);
  const npmGrowthNorm = clamp(npmGrowthPct * 2);  // 50%成長 = 100点

  // 3. community: Zennは日本語特化ボーナス×2
  const communityRaw = (inputs.communityZenn7d * 2)
                      + inputs.communityHn7d
                      + inputs.communityReddit7d;
  const communityNorm = logNorm(communityRaw, 50);

  // 4. hn_reddit
  const hnRedditRaw = inputs.communityHn7d + inputs.communityReddit7d;
  const hnRedditNorm = logNorm(hnRedditRaw, 20);

  // 5. recency: 最終コミットからの経過日数 (30日以内=100, 365日以上=0)
  const daysSinceCommit = (Date.now() - inputs.lastCommitAt.getTime()) / (1000 * 86400);
  const recencyNorm = clamp(100 - (daysSinceCommit / 365) * 100);

  const score = clamp(
    0.35 * starsDeltaNorm
    + 0.25 * npmGrowthNorm
    + 0.20 * communityNorm
    + 0.10 * hnRedditNorm
    + 0.10 * recencyNorm
  );

  const tier: 'hot' | 'warm' | 'cold' =
    score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cold';

  return {
    score: Math.round(score * 100) / 100,
    tier,
    components: {
      starsDelta: Math.round(starsDeltaNorm),
      npmGrowth: Math.round(npmGrowthNorm),
      community: Math.round(communityNorm),
      hnReddit: Math.round(hnRedditNorm),
      recency: Math.round(recencyNorm),
    },
    calculatedAt: new Date(),
  };
}
```

### TrendScore TOP10 推定ランキング (2026-03-11)

調査データから手動推定:

| 順位 | ツール / MCPサーバー | 推定スコア | Tier | 根拠 |
|------|-------------------|-----------|------|------|
| 1 | Playwright MCP | 94 | HOT | 週1.7M訪問 / Microsoft管理 |
| 2 | MCP SDK (TypeScript) | 91 | HOT | 週350万DL / 15倍成長 |
| 3 | fastmcp | 87 | HOT | 23,600 Stars / Apache 2.0 |
| 4 | Context7 (Upstash) | 82 | HOT | 週616K訪問 / 急成長 |
| 5 | Claude Flow | 78 | HOT | 週573K訪問 / オーケストレーション需要 |
| 6 | mcp-for-beginners (MS) | 75 | HOT | 15,300 Stars / エンタープライズ普及 |
| 7 | Firecrawl MCP | 72 | HOT | 25,000+ Stars / スクレイピング需要 |
| 8 | awesome-mcp-servers | 69 | WARM | 82,700 Stars / エコシステム基盤 |
| 9 | Supabase MCP | 63 | WARM | 週118K訪問 / DBカテゴリ代表 |
| 10 | Unity MCP | 58 | WARM | 6,900 Stars / ゲーム開発特化 |

---

## 7. システムアーキテクチャ図

### C4 Level 1: システムコンテキスト図

```mermaid
C4Context
  title MCP Intelligence Hub - システムコンテキスト (2026-03-11)

  Person(dev, "MCP開発者", "MCPサーバーを探す・評価する")
  Person(jp_dev, "日本人AIエンジニア", "日本語でMCP情報を得る")
  Person(admin, "管理者", "データ品質・システム監視")

  System(mih, "MCP Intelligence Hub", "MCPサーバー・AIツールの\n品質スコアリング・トレンド分析")

  System_Ext(github, "GitHub API", "Stars・Commits・ライセンス")
  System_Ext(npm, "npm Registry", "週間DL数・パッケージ情報")
  System_Ext(osv, "OSV.dev", "脆弱性データベース")
  System_Ext(mcp_so, "mcp.so", "18,387 MCPサーバー登録")
  System_Ext(glama, "glama.ai", "18,964 MCPサーバー")
  System_Ext(hn, "HN Algolia", "コミュニティ言及数")
  System_Ext(zenn, "Zenn API", "日本語技術記事")
  System_Ext(hf, "HuggingFace", "AIモデル・Stars・DL数")

  Rel(dev, mih, "ツール検索・評価閲覧", "HTTPS")
  Rel(jp_dev, mih, "日本語でMCP調査", "HTTPS")
  Rel(admin, mih, "管理UI", "HTTPS")

  Rel(mih, github, "メタデータ取得", "REST API / 5,000req/時")
  Rel(mih, npm, "DL数取得", "REST API / 無制限")
  Rel(mih, osv, "脆弱性チェック", "REST API / 無料")
  Rel(mih, mcp_so, "サーバーリスト取得", "API / APIキー")
  Rel(mih, glama, "サーバーリスト取得", "API")
  Rel(mih, hn, "言及数取得", "REST API / 無料")
  Rel(mih, zenn, "日本語記事取得", "RSS+API")
  Rel(mih, hf, "モデル情報取得", "Hub API / 無料枠")
```

### C4 Level 2: コンテナ図

```mermaid
C4Container
  title MCP Intelligence Hub - コンテナ図

  Person(user, "ユーザー")

  System_Boundary(mih, "MCP Intelligence Hub") {
    Container(web, "Next.js App", "Next.js 16 / React 19", "ランキング・検索・品質レポートUI")
    Container(api, "API Routes", "Next.js API Routes", "REST API + Server Actions")
    Container(ingestion, "Ingestion Workers", "Node.js Cron / BullMQ", "外部ソース定期収集")
    Container(scoring, "Scoring Engine", "TypeScript", "TrendScore + QualityScore算出")
    ContainerDb(pg, "PostgreSQL (Neon)", "PostgreSQL 16", "正規化データ + タイムシリーズ")
    ContainerDb(redis, "Redis (Upstash)", "Redis 7", "APIキャッシュ + ジョブキュー")
    ContainerDb(qdrant, "Qdrant Cloud", "Vector DB", "セマンティック検索 (Phase 2)")
  }

  System_Ext(github, "GitHub API")
  System_Ext(npm, "npm Registry")
  System_Ext(osv, "OSV.dev")
  System_Ext(sources, "mcp.so / glama.ai / HN / Zenn")

  Rel(user, web, "HTTPS")
  Rel(web, api, "Server Actions / fetch")
  Rel(api, pg, "Drizzle ORM / SQL")
  Rel(api, redis, "キャッシュ読み書き")
  Rel(ingestion, github, "GitHub REST API")
  Rel(ingestion, npm, "npm API")
  Rel(ingestion, osv, "OSV API")
  Rel(ingestion, sources, "API / RSS")
  Rel(ingestion, pg, "バルクインサート")
  Rel(ingestion, redis, "ジョブキュー")
  Rel(scoring, pg, "スコア更新")
  Rel(api, qdrant, "ベクトル検索 (Phase 2)")
```

### C4 Level 3: Ingestionコンポーネント図

```mermaid
C4Component
  title Ingestion Workers - コンポーネント図

  Container_Boundary(ingestion, "Ingestion Workers") {
    Component(scheduler, "Cron Scheduler", "node-cron", "6時間ごとに各Collectorを起動")
    Component(gh_collector, "GitHub Collector", "TypeScript + Octokit", "repos.get + commits (差分)")
    Component(npm_collector, "npm Collector", "TypeScript + fetch", "downloads API + registry")
    Component(mcp_collector, "MCP Directory Collector", "TypeScript + fetch", "mcp.so + glama.ai API")
    Component(vuln_scanner, "Vuln Scanner", "TypeScript + OSV.dev", "パッケージ脆弱性チェック")
    Component(community_collector, "Community Collector", "TypeScript + fetch", "HN Algolia + Zenn RSS")
    Component(normalizer, "Data Normalizer", "TypeScript", "生データ → AiTool型に変換")
    Component(upsert, "DB Upsert", "Drizzle ORM", "ON CONFLICT DO UPDATE")
  }

  ContainerDb(pg, "PostgreSQL")
  ContainerDb(redis, "Redis (BullMQ)")

  Rel(scheduler, gh_collector, "起動")
  Rel(scheduler, npm_collector, "起動")
  Rel(scheduler, mcp_collector, "起動")
  Rel(scheduler, vuln_scanner, "起動")
  Rel(scheduler, community_collector, "起動")
  Rel(gh_collector, normalizer, "生データ渡す")
  Rel(npm_collector, normalizer, "生データ渡す")
  Rel(mcp_collector, normalizer, "生データ渡す")
  Rel(normalizer, upsert, "正規化データ渡す")
  Rel(upsert, pg, "バルクUPSERT")
  Rel(vuln_scanner, pg, "脆弱性レコード更新")
  Rel(community_collector, pg, "コミュニティシグナル更新")
  Rel(scheduler, redis, "ジョブ状態記録")
```

---

## 8. 実装計画

### フェーズ概要

| Phase | 期間 | コスト | 目標 |
|-------|------|--------|------|
| Phase 1 | Month 1 | $0〜$7/月 | データパイプライン + 基本UI |
| Phase 2 | Month 2-3 | $32/月 | スコアリング + 日本語特化 |
| Phase 3 | Month 3-6 | $300〜500/月 | 本番スケール + 収益化 |

### Ganttチャート

```mermaid
gantt
  title MCP Intelligence Hub 実装ロードマップ
  dateFormat  YYYY-MM-DD
  axisFormat  %m/%d

  section Phase 1: Foundation ($0-7/月)
  DBスキーマ設計・マイグレーション    :done, p1_db,    2026-03-12, 3d
  GitHub Collector実装               :p1_gh,    after p1_db, 4d
  npm Collector実装                  :p1_npm,   after p1_db, 3d
  MCP Directory Collector (mcp.so)   :p1_mcp,   after p1_gh, 3d
  OSV.dev 脆弱性スキャナー            :p1_osv,   after p1_npm, 3d
  TrendScore算出エンジン              :p1_score, after p1_mcp, 4d
  基本ランキングUI (Next.js)          :p1_ui,    after p1_score, 5d
  Render Free Tierデプロイ            :p1_deploy, after p1_ui, 2d
  Phase 1 完了・検証                  :milestone, p1_done, after p1_deploy, 0d

  section Phase 2: Quality & Japan ($32/月)
  QualityScore算出実装               :p2_quality, after p1_done, 5d
  Zenn/HN Community Collector        :p2_comm,    after p1_done, 4d
  日本語検索・フィルタリング           :p2_ja,      after p2_comm, 5d
  セマンティック検索 (Qdrant)         :p2_vec,     after p2_quality, 6d
  glama.ai + smithery.ai 統合        :p2_more,    after p2_vec, 4d
  Weekly Digest メール (SendGrid)    :p2_email,   after p2_comm, 3d
  Neon Launch + Upstash 移行         :p2_infra,   after p2_more, 2d
  Phase 2 完了・MAU 100目標           :milestone, p2_done, after p2_infra, 0d

  section Phase 3: Scale & Monetization ($300-500/月)
  HuggingFace + VS Code 統合         :p3_hf,     after p2_done, 5d
  WordPress + Atlassian統合          :p3_ext,    after p2_done, 5d
  有料プラン実装 (Stripe)             :p3_pay,    after p3_hf, 7d
  APIエンドポイント公開               :p3_api,    after p3_pay, 5d
  Kubernetes / 自動スケール           :p3_k8s,    after p3_api, 7d
  エンタープライズ機能 (SSO/RBAC)     :p3_ent,    after p3_k8s, 10d
  Phase 3 完了・MRR $1,450目標        :milestone, p3_done, after p3_ent, 0d
```

### Phase 1 詳細タスク ($0〜$7/月, 1ヶ月)

**インフラ構築**:
```bash
# Neon PostgreSQL Free Tier
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/mih_db

# Upstash Redis Free Tier
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Render Free Tier (Web Service)
# render.yaml に定義
```

**成功基準**:
- [ ] GitHub APIから100件のMCPサーバーを取り込み完了
- [ ] TrendScoreが正常に算出される (TOP10一致率 > 80%)
- [ ] `/mih` ルートで基本ランキング表示
- [ ] OSV.devで脆弱性チェック動作確認

### Phase 2 詳細タスク ($32/月, Month 2-3)

**成功基準**:
- [ ] Zenn日本語記事1,000件インデックス完了
- [ ] QualityScore A/B/C/D/F判定が動作
- [ ] セマンティック検索「playwright ブラウザ自動化」で適切な結果
- [ ] 週次Digestメールの配信テスト完了
- [ ] MAU 100ユーザー達成

### Phase 3 詳細タスク ($300〜500/月, Month 3-6)

**成功基準**:
- [ ] 14ソース全て統合 (mcp.so + glama.ai + HF + VS Code + WordPress + Atlassian + ...)
- [ ] 有料プラン ($29/月) Stripe決済動作
- [ ] API公開・開発者ドキュメント完備
- [ ] 50有料ユーザー = MRR $1,450達成

---

## 9. セキュリティ/法務/運用

### ライセンスポリシー

```typescript
// lib/mih/scoring/quality-score.ts (ライセンス評価部分)

const APPROVED_LICENSES: LicenseKind[] = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC'];
const RISKY_LICENSES: LicenseKind[] = ['AGPL-3.0', 'GPL-3.0'];

export function evaluateLicense(license: LicenseKind): {
  isCommercialFriendly: boolean;
  score: number;
  warning: string | null;
} {
  if (APPROVED_LICENSES.includes(license)) {
    return { isCommercialFriendly: true, score: 100, warning: null };
  }
  if (license === 'AGPL-3.0') {
    return {
      isCommercialFriendly: false,
      score: 0,
      warning: 'AGPL-3.0: SaaS組み込みでソース開示義務。採用非推奨。',
    };
  }
  if (license === 'GPL-3.0') {
    return {
      isCommercialFriendly: false,
      score: 20,
      warning: 'GPL-3.0: 配布時にソース開示義務あり。要法務確認。',
    };
  }
  return { isCommercialFriendly: false, score: 30, warning: 'ライセンス不明。使用前に確認必須。' };
}
```

**方針サマリー**:
- 採用: MIT / Apache 2.0 / BSD-3-Clause / ISC
- 警告付き採用検討: GPL-3.0 (法務確認後)
- 採用禁止: AGPL-3.0 (SaaS組み込みでのソース開示義務)
- 確認日: 2026-03-11 (OSS License Matrix参照)

### CVEチェック (OSV.dev)

```typescript
// cron/vuln-scan.ts
// 毎日03:00 JSTに実行

import { checkVulnerabilities } from '../lib/mih/collectors/osv';
import { db } from '../lib/db';

export async function runVulnScan() {
  const tools = await db.query.mihTools.findMany({
    where: (t, { and, isNotNull }) => and(
      isNotNull(t.npmPackageName),
      isNotNull(t.npmLatestVersion),
    ),
    columns: { id: true, npmPackageName: true, npmLatestVersion: true },
  });

  for (const tool of tools) {
    const vulns = await checkVulnerabilities(tool.npmPackageName!, tool.npmLatestVersion!);
    const hasCritical = vulns.some(v => v.severity === 'CRITICAL');

    await db.update(mihTools)
      .set({
        hasCriticalVuln: hasCritical,
        lastVulnCheckAt: new Date(),
      })
      .where(eq(mihTools.id, tool.id));

    if (vulns.length > 0) {
      await db.insert(mihVulnerabilities).values(
        vulns.map(v => ({
          toolId: tool.id,
          osvId: v.osvId,
          severity: v.severity,
          summary: v.summary,
          aliases: v.aliases,
          fixedVersion: v.fixedVersion,
        }))
      ).onConflictDoNothing();
    }
  }
}
```

### APIキー管理

```bash
# .env.local (コミット禁止 / .gitignoreに追加済みを確認)
GITHUB_PAT=ghp_xxxxxxxxxxxx          # GitHub Personal Access Token
MCP_SO_API_KEY=xxxx                  # mcp.so APIキー
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=xxxx
DATABASE_URL=postgresql://...

# Render環境変数 (Renderダッシュボードで設定)
# ローカルファイルにSecret値を書かない
```

**管理ルール**:
1. `.env.local` を `.gitignore` に追加 (既存リポジトリ設定を継承)
2. 本番環境はRenderの環境変数ストア経由でのみ注入
3. APIキーのローテーション: 90日ごと (Render環境変数を更新)
4. GitHub PAT: `repo:read` + `read:packages` のスコープ最小化

### robots.txt 遵守

```typescript
// lib/mih/utils/robots-checker.ts
import robotsParser from 'robots-parser';

const ROBOTS_CACHE = new Map<string, any>();

export async function isAllowed(url: string, userAgent = 'MIH-Bot/1.0'): Promise<boolean> {
  const { origin } = new URL(url);
  if (!ROBOTS_CACHE.has(origin)) {
    try {
      const res = await fetch(`${origin}/robots.txt`);
      const txt = await res.text();
      ROBOTS_CACHE.set(origin, robotsParser(`${origin}/robots.txt`, txt));
    } catch {
      ROBOTS_CACHE.set(origin, null);
    }
  }
  const robots = ROBOTS_CACHE.get(origin);
  return robots ? robots.isAllowed(url, userAgent) !== false : true;
}

// 使用例 (mcp.so では ?q= クエリをDisallowしているため、API経由のみ使用)
// await isAllowed('https://mcp.so/search?q=playwright')  → false
// API経由: await isAllowed('https://mcp.so/api/servers')  → true (想定)
```

### 運用チェックリスト

| 項目 | 頻度 | 担当 | ツール |
|------|------|------|--------|
| 脆弱性スキャン | 毎日 | 自動(cron) | OSV.dev API |
| robots.txt遵守確認 | 週次 | 自動(テスト) | robots-parser |
| APIレートリミット監視 | リアルタイム | 自動(メトリクス) | Render Metrics |
| DBバックアップ | 日次 | 自動 | Neon自動バックアップ |
| ライセンス棚卸し | 月次 | 手動 | license-checker npm |
| GitHub PAT更新 | 90日 | 手動 | GitHub Settings |

---

## 10. リスクと代替案

### リスクマトリクス

| # | リスク | 確率 | 影響 | 代替手段・軽減策 |
|---|--------|------|------|----------------|
| R1 | mcp.so APIが有料化/閉鎖 | 中(30%) | 高 | glama.ai APIを主軸に移行 / 公式MCPレジストリ(modelcontextprotocol/servers)をGitHubから直取得 |
| R2 | GitHub API レートリミット超過 | 中(25%) | 中 | Personal Access Token複数ローテーション / GraphQL API(コスト効率2-5x) / GitHub App認証(15,000 req/時) |
| R3 | smithery.ai 429エラー継続 | 高(60%) | 低 | 公式APIドキュメント待ち / Exponential backoffで収集スケジュール調整 / 当面はmcp.so+glama.aiで代替 |
| R4 | NPM SDK DL数成長鈍化 (市場縮小) | 低(10%) | 高 | OpenAI Functions / Google GenAI Tool Use 等の代替プロトコルを追加ソースとして取り込み |
| R5 | Neon Free Tier 0.5GB超過 | 高(70%) | 低 | Phase 2でNeon Launchへ移行 ($15/月) / タイムシリーズを90日ローリングに制限 |
| R6 | AGPL依存ライブラリの混入 | 低(15%) | 高 | `npx license-checker --production --failOn AGPL-3.0` をCI/CDに追加 |
| R7 | 競合サービスが先に品質スコアリングを実装 | 中(20%) | 中 | 日本語特化は短期では模倣困難 / Zenn統合とJapanese QA Labelを早期リリース |
| R8 | Qdrant Cloud Free Tier制限 | 中(40%) | 低 | Phase 2まではPGVector(pgvector拡張)で代替 / Neon PostgreSQLに組み込み |
| R9 | Render Freeのスリープ問題 | 高(80%) | 低 | Cron pingで起こし続ける / Phase 1完了後すぐにRender Starter($7)へ移行 |
| R10 | データ品質: mcp.so重複率不明 | 中(35%) | 中 | slug+GitHub URL複合キーで重複排除 / UNIQUE制約をDBで担保 |

---

## 11. Go/No-Go意思決定ポイント

### 今作るべき理由 TOP3

**理由1: 市場空白の証明 (数値根拠あり)**
- mcp.so: 18,387サーバー登録、品質スコア: 皆無
- glama.ai: ヘルス表示あり、しかし1,042件のみ (mcp.soの5.7%)
- smithery.ai: ホスティング強み、ディスカバリー機能弱
- Agent C調査: 「MCPコミュニティ最大のペインポイントは品質保証」
- → 品質スコアリングの空白は **2026年前半現在も未解決**

**理由2: 日本語コミュニティの無視が競合の共通弱点**
- Zennで「MCP」検索: 2,095件 (確認日2026-03-11)
- 英語圏サービス (mcp.so/glama.ai/smithery.ai): 日本語コンテンツ対応ゼロ
- Zenn/Qiita/日本語Discordを統合したコミュニティシグナルは本プロジェクトが初
- → **日本語開発者10,000人以上のアドレス可能市場**

**理由3: 既存Invoice SystemのTAISUN基盤を完全活用できる**
- 96 agents + 110+ skills: データ収集・分析パイプラインの実装が加速
- MCP 33サーバー統合済み: GitHub/Playwright/PostgreSQL/Notion等がすぐ使える
- Next.js 16 + Drizzle ORM + RBAC: Webアプリ基盤が完成済み
- SQLite → PostgreSQL(Neon)移行のみで既存スキーマを活用可能

### 最初の1アクション

```bash
# 今すぐ実行すべきコマンド (所要時間: 10分)

# 1. MIHモジュール用ディレクトリ作成
mkdir -p lib/mih/{collectors,scoring,types,utils}
mkdir -p app/mih
mkdir -p scripts/mih

# 2. データベースマイグレーションファイル作成
touch lib/db/migrations/0002_mih_schema.sql

# 3. 環境変数テンプレート更新
echo "GITHUB_PAT=ghp_xxx" >> .env.example
echo "MCP_SO_API_KEY=xxx" >> .env.example

# 4. GitHub APIで最初の10件MCPサーバーを取得してDB投入を試みる
# → これが動けばPhase 1の技術的実現性が証明される
```

**Go/No-Go基準 (Phase 1完了時)**:
- Go: GitHub APIから100件取り込み + TrendScore正常算出 + 基本UI表示
- No-Go: データ収集が技術的に不可能なソースが主要3件以上

---

## 12. リポジトリ変更案

### ディレクトリ構造 (追加分のみ)

```
Invoice System20260309/
├── lib/
│   ├── mih/                          # NEW: MIH コアモジュール
│   │   ├── types/
│   │   │   └── index.ts              # AiTool, TrendScore, QualityScore等 (Section 5参照)
│   │   ├── collectors/
│   │   │   ├── github.ts             # GitHub REST API コレクター
│   │   │   ├── npm.ts                # npm Registry コレクター
│   │   │   ├── mcp-directory.ts      # mcp.so + glama.ai コレクター
│   │   │   ├── community.ts          # HN Algolia + Zenn RSS コレクター
│   │   │   └── osv.ts               # OSV.dev 脆弱性スキャナー
│   │   ├── scoring/
│   │   │   ├── trend-score.ts        # TrendScore算出 (Section 6参照)
│   │   │   └── quality-score.ts      # QualityScore算出
│   │   └── utils/
│   │       ├── robots-checker.ts     # robots.txt 遵守チェック
│   │       └── rate-limiter.ts       # API レートリミット管理
│   └── db/
│       ├── schema.ts                 # MODIFY: MIHテーブル追加 (既存テーブルは不変)
│       └── migrations/
│           └── 0002_mih_schema.sql   # NEW: Section 5のSQLを配置
├── app/
│   └── mih/                          # NEW: MIH ページ群
│       ├── page.tsx                  # ランキングトップページ
│       ├── [slug]/
│       │   └── page.tsx              # ツール詳細ページ
│       └── layout.tsx                # MIH用レイアウト
├── app/api/
│   └── mih/                          # NEW: MIH API Routes
│       ├── tools/
│       │   └── route.ts              # GET /api/mih/tools (ランキング)
│       ├── tools/[slug]/
│       │   └── route.ts              # GET /api/mih/tools/:slug (詳細)
│       └── ingest/
│           └── route.ts              # POST /api/mih/ingest (手動トリガー)
├── scripts/
│   └── mih/
│       ├── seed-mcp-tools.ts         # 初期データ投入スクリプト
│       └── run-scoring.ts            # スコア一括再計算
├── cron/                             # NEW: Cronジョブ
│   ├── mih-collect.ts                # 6時間毎収集
│   └── mih-vuln-scan.ts             # 日次脆弱性スキャン
└── .env.example                      # MODIFY: MIH用環境変数追加
```

### Drizzle ORM スキーマ追加 (lib/db/schema.ts への追記)

```typescript
// lib/db/schema.ts に追記 (既存テーブルは変更なし)

import { pgTable, uuid, text, integer, boolean, numeric, timestamp, date, pgEnum } from 'drizzle-orm/pg-core';

// Enum
export const sourceKindEnum = pgEnum('source_kind', [
  'mcp_server', 'npm_package', 'huggingface_model', 'vscode_extension', 'api_endpoint'
]);
export const licenseKindEnum = pgEnum('license_kind', [
  'MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC', 'AGPL-3.0', 'GPL-3.0', 'UNKNOWN', 'PROPRIETARY'
]);
export const trendTierEnum = pgEnum('trend_tier', ['hot', 'warm', 'cold']);
export const qualityGradeEnum = pgEnum('quality_grade', ['A', 'B', 'C', 'D', 'F']);

export const mihTools = pgTable('mih_tools', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceKind: sourceKindEnum('source_kind').notNull(),
  slug: text('slug').unique().notNull(),
  externalId: text('external_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  githubUrl: text('github_url'),
  npmPackageName: text('npm_package_name'),
  authorName: text('author_name').notNull().default(''),
  primaryCategory: text('primary_category').notNull().default('Uncategorized'),
  tags: text('tags').array().default([]),
  license: licenseKindEnum('license').notNull().default('UNKNOWN'),
  isCommercialFriendly: boolean('is_commercial_friendly').notNull().default(false),
  // GitHub
  ghStars: integer('gh_stars').default(0),
  ghStarsDelta7d: integer('gh_stars_delta_7d').default(0),
  ghLastCommitAt: timestamp('gh_last_commit_at', { withTimezone: true }),
  // npm
  npmWeeklyDownloads: integer('npm_weekly_downloads').default(0),
  npmWeeklyDelta: integer('npm_weekly_delta').default(0),
  npmLatestVersion: text('npm_latest_version'),
  // Community
  communityZenn7d: integer('community_zenn_7d').default(0),
  communityHn7d: integer('community_hn_7d').default(0),
  // Scores
  trendScore: numeric('trend_score', { precision: 5, scale: 2 }).default('0'),
  trendTier: trendTierEnum('trend_tier').default('cold'),
  qualityGrade: qualityGradeEnum('quality_grade').default('F'),
  qualityTotal: numeric('quality_total', { precision: 5, scale: 2 }).default('0'),
  // MCP固有
  mcpInstallCommand: text('mcp_install_command'),
  mcpIsOfficial: boolean('mcp_is_official').default(false),
  mcpIsSoc2: boolean('mcp_is_soc2').default(false),
  // 脆弱性
  hasCriticalVuln: boolean('has_critical_vuln').default(false),
  lastVulnCheckAt: timestamp('last_vuln_check_at', { withTimezone: true }),
  // System
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  isActive: boolean('is_active').default(true),
});

export const mihMetricsSnapshots = pgTable('mih_metrics_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  toolId: uuid('tool_id').notNull().references(() => mihTools.id, { onDelete: 'cascade' }),
  snapshotDate: date('snapshot_date').notNull(),
  stars: integer('stars').default(0),
  weeklyDownloads: integer('weekly_downloads').default(0),
  hnMentions: integer('hn_mentions').default(0),
  zennArticles: integer('zenn_articles').default(0),
});

export const mihVulnerabilities = pgTable('mih_vulnerabilities', {
  id: uuid('id').primaryKey().defaultRandom(),
  toolId: uuid('tool_id').notNull().references(() => mihTools.id, { onDelete: 'cascade' }),
  osvId: text('osv_id').notNull(),
  severity: text('severity').notNull(),
  summary: text('summary'),
  aliases: text('aliases').array().default([]),
  fixedVersion: text('fixed_version'),
  detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### package.json 追加スクリプト

```json
{
  "scripts": {
    "mih:seed": "npx tsx scripts/mih/seed-mcp-tools.ts",
    "mih:score": "npx tsx scripts/mih/run-scoring.ts",
    "mih:collect": "npx tsx cron/mih-collect.ts",
    "mih:vuln": "npx tsx cron/mih-vuln-scan.ts"
  },
  "dependencies": {
    "@octokit/rest": "^21.0.0",
    "node-cron": "^3.0.3",
    "robots-parser": "^3.0.1"
  }
}
```

### .env.example への追記

```bash
# MIH (MCP Intelligence Hub) - Section 4参照
GITHUB_PAT=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MCP_SO_API_KEY=
GLAMA_AI_API_KEY=
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
# Phase 2以降
QDRANT_URL=https://xxx.qdrant.io
QDRANT_API_KEY=xxx
SENDGRID_API_KEY=xxx
```

### 既存コードへの影響 (最小限)

| 変更対象 | 変更内容 | リスク |
|---------|---------|--------|
| `lib/db/schema.ts` | MIHテーブル3件追加 (既存10テーブルは不変) | 低 |
| `package.json` | 依存関係3件追加 | 低 |
| `.env.example` | 環境変数追記 | なし |
| `app/` | `/mih` ルート新規追加 (既存ルート変更なし) | なし |
| `middleware.ts` | `/mih` を認証不要パスに追加 (公開ランキング) | 低 |

**既存Invoice Systemの機能 (Xero連携・OCR・RBAC) への影響: ゼロ**

---

## Appendix: アーキテクチャ決定記録 (ADR)

### ADR-001: モジュラーモノリス + CQRS採用

**Status**: Proposed
**Context**: 既存Invoice SystemはNext.js + Drizzle ORM + SQLiteのモノリス。MIHを追加する際の統合方法を決定。
**Decision**: 既存リポジトリ内に `lib/mih/` モジュールとして追加するモジュラーモノリス。CQRS(読み書き分離)をIngestion Worker(Write) / API Routes(Read)で実現。
**Rationale**: Phase 1の$0-7/月制約 / 1ヶ月のタイムライン / チームの既存知識活用。マイクロサービス分割はPhase 3(MAU 1,000+)以降に延期。
**Consequences**:
- ✅ 即日開発開始可能 / 既存インフラ流用 / 運用コスト最小
- ⚠️ スケール時にはモジュール境界を超えたリファクタが必要
- ❌ リスク: Invoice System側の変更がMIHに影響する可能性 → 緩和: `lib/mih/` を独立モジュールとしてimport境界を明確化

### ADR-002: PostgreSQL (Neon) への移行

**Status**: Proposed
**Context**: 既存DBはSQLite (better-sqlite3)。MIHはUUID・GIN Index・pg_trgm・将来的なpgvectorが必要。
**Decision**: Neon PostgreSQL Free Tierに移行。Drizzle ORMの設定変更のみで対応可能。
**Rationale**: Phase 1時点で$0 / Drizzle ORM側の変更最小 / pgvector拡張でPhase 2のセマンティック検索に対応。
**Consequences**:
- ✅ 全MIH機能の基盤が整う / スキーマ管理がDrizzle Migrateで統一
- ⚠️ SQLite固有の既存テストが一部修正必要
- ❌ リスク: SQLite → PostgreSQL構文差異 → 緩和: Drizzle ORMが抽象化、手動SQLは使わない方針

---

*本文書は 2026-03-11 に作成。調査データの確認日は各セクションに明記。*
*次回レビュー: Phase 1完了後 (2026年4月中旬)*
