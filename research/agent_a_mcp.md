# Agent A: MCP/Skills発掘レポート (Pass1)

**調査日**: 2026-03-11

## MCP サーバー TOP20 (週間訪問者数 + Stars複合スコア)

| # | サーバー名 | カテゴリ | 週間訪問者 | 管理主体 | インストール | 無料 |
|---|-----------|---------|-----------|---------|------------|------|
| 1 | Playwright | ブラウザ | 1.7M | Microsoft | `npx @playwright/mcp@latest` | Yes |
| 2 | Context7 | ドキュメント | 616K | Upstash | `npx -y @upstash/context7-mcp` | Yes |
| 3 | Chrome DevTools | ブラウザ | 580K | Google | 公式Doc参照 | Yes |
| 4 | Claude Flow | オーケストレーション | 573K | ruvnet | `npm install claude-flow` | Yes |
| 5 | Filesystem | ファイル操作 | 317K | Anthropic | `npx @modelcontextprotocol/server-filesystem` | Yes |
| 6 | MongoDB | DB | 290K | MongoDB Inc. | 公式Doc参照 | 無料枠 |
| 7 | Git | バージョン管理 | 273K | Anthropic | `npx @modelcontextprotocol/server-git` | Yes |
| 8 | Storybook | 開発 | 206K | Storybook | 公式Doc参照 | Yes |
| 9 | Atlassian Cloud | ドキュメント | 198K | sooperset | `npx @sooperset/mcp-atlassian` | Yes |
| 10 | Fetch | Web取得 | 141K | Anthropic | `npx @modelcontextprotocol/server-fetch` | Yes |
| 11 | CircleCI | CI/監視 | 135K | CircleCI | 公式Doc参照 | 無料枠 |
| 12 | AWS Documentation | クラウド | 127K | AWS | 公式Doc参照 | Yes |
| 13 | Supabase | DB | 118K | Supabase | `npx @supabase/mcp-server-supabase` | 無料枠 |
| 14 | Sequential Thinking | 推論 | 78.6K | Anthropic | `npx @modelcontextprotocol/server-sequential-thinking` | Yes |
| 15 | GitHub | バージョン管理 | 74.9K | Anthropic | `npx @modelcontextprotocol/server-github` | Yes |
| 16 | Excel File | ファイル操作 | 74.4K | Haris Musa | `pip install mcp-server-excel` | Yes |
| 17 | Figma Context | デザイン | 74K | GLips | `npx figma-mcp` | Yes |
| 18 | Notion | ドキュメント | 73.5K | Notion | `npx @notionhq/notion-mcp-server` | 無料枠 |
| 19 | Knowledge Graph Memory | メモリ | 68.8K | Anthropic | `npx @modelcontextprotocol/server-memory` | Yes |
| 20 | Brave Search | Web検索 | - | Brave | `npx @modelcontextprotocol/server-brave-search` | APIキー要 |

出典: PulseMCP (https://pulsemcp.com/servers), GitHub MCP公式 (Stars: 80.8K)

## 技術パターン分類

### トランスポート方式 (2025-03-26版仕様)
| 方式 | 用途 | 推奨度 |
|------|------|--------|
| stdio | ローカルツール統合 | 最優先 (SHOULD support) |
| Streamable HTTP | リモートサービス統合 | 現行標準 |
| HTTP+SSE (旧) | 後方互換のみ | 非推奨 |

### デプロイパターン
- **ローカル**: Filesystem, Git, Memory (stdio, ゼロレイテンシ)
- **リモート**: Supabase, MongoDB, Notion (Streamable HTTP, 認証必須)
- **ハイブリッド**: Claude Flow, MetaMCP (ゲートウェイ型)

### 認証パターン
- なし(ローカル) / API Key / OAuth 2.0 / SOC2認定(Composioのみ)

## 2026年トレンド
1. **ブラウザ自動化**: Playwright週1.7M訪問で断トツ
2. **エージェントオーケストレーション**: Claude Flow, MetaMCP, Pipedream(2,500+API)
3. **ドキュメント/ナレッジ統合**: Context7(週616K)が急成長
4. **DB統合**: MongoDB/Supabase/PostgreSQL直接操作が標準化

## エコシステム規模
- MCP.so: 18,387サーバー登録
- awesome-mcp-servers: 82.7K Stars
- 公式リポジトリ: 80.8K Stars
- Composio: SOC2 & ISO 27001認定済み（エンタープライズ唯一）

## 未解決事項
- smithery.ai (429エラー未取得)
- MCPサーバー品質スコアリング標準の業界統一基準なし
- Streamable HTTP対応率の実態
