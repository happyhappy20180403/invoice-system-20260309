# Agent B: API/ライブラリ/SaaS調査レポート (Pass1)

**調査日**: 2026-03-11

## MVP構成 (月額$0〜$7)

| コンポーネント | ツール | 月額 | ライセンス |
|-------------|-------|------|-----------|
| DB | Neon PostgreSQL Free (0.5GB) | $0 | Apache 2.0 |
| Cache | Upstash Redis Free (256MB, 50万cmd) | $0 | SaaS |
| Vector DB | Qdrant Cloud Free (1GB) | $0 | Apache 2.0 |
| Hosting | Render Free/Starter | $0〜$7 | SaaS |
| 通知 | Slack Webhook + SendGrid (100通/日) | $0 | - |
| データ収集 | GitHub API (5,000req/時) + npm Registry + OSV.dev | $0 | - |
| AI分析 | Qwen2.5-7B / Qwen3-0.6B ローカル | $0 | Apache 2.0 |
| **合計** | | **$0〜$7** | |

## Phase 2 拡張 ($32/月以下)
- Neon Launch: +$15
- Upstash従量: +$10
- Render Starter: +$7

## データ収集API一覧

| API | 無料枠 | 商用可否 |
|-----|--------|---------|
| GitHub REST API | 5,000 req/時(認証) | 規約準拠 |
| npm Registry API | 無制限(公開) | 商用可 |
| MCP SDK | 無料OSS, 週350万DL | 商用可(MIT) |
| OSV.dev API | 完全無料OSS | 商用可(Apache 2.0) |
| HuggingFace API | 無料推論枠 | モデル依存 |
| HN Algolia API | 無料 | 公開API |

## ライセンス方針
- **採用**: MIT / Apache 2.0 のみ
- **回避**: AGPL-3.0 (SaaS組み込みでソース開示義務)

## 注目データ
- MCP SDK: 週23.7万→350万DLに爆発的成長 (2025年5月→2026年3月)
- Qwen2.5-7B: 月2,272万DL、HF最人気 (Apache 2.0)
