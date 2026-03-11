# 拡張機能マーケットプレイス調査レポート

**確認日**: 2026-03-11

## 比較マトリクス

| マーケットプレイス | 総登録数 | カテゴリ数 | API有無 | MCP/AI関連 | 統合優先度 |
|---|---|---|---|---|---|
| WordPress Plugins | 61,000+ | 4分類+タグ | 完全公開(認証不要) | AI Experiments(β) | S |
| Atlassian Marketplace | 8,000+ | 5カテゴリ | 公開REST API + GraphQL | Rovo対応/AIカテゴリあり | A |
| VS Code Marketplace | 数万+ | 21カテゴリ | REST API あり | MCP専用カテゴリあり | A |
| Shopify App Store | 16,000+ | 7カテゴリ | Partner API(認証必要) | AIツール多数 | B |
| Salesforce AppExchange | 非公開 | 10カテゴリ | エンドポイント存在(認証未確認) | Agentforce対応 | B |
| Chrome Web Store | 非公開 | 非公開 | Publish APIのみ | AI拡張多数 | C |
| Notion Integrations | 非公開 | 未分類 | Notion API(別物) | カタログAPIなし | C |

## 最優先統合対象

### S: WordPress Plugins
- **API**: `api.wordpress.org/plugins/info/1.2/` 認証不要・29メタデータ項目
- 取得可能: name, rating, active_installs, downloaded, last_updated, tags, requires_php等
- 61,000件の完全カバレッジ

### A: Atlassian Marketplace
- **API**: `marketplace.atlassian.com/rest/2/` + GraphQL gateway
- 取得可能: downloads, totalInstalls, totalUsers, averageStars, reviews, categories, vendor
- 8,000+アプリ、AIカテゴリ新設

### A: VS Code Marketplace
- **API**: `/_apis/public/gallery/extensionquery`
- MCP専用カテゴリ「Language Model Tools」が既に存在 ← 最重要
- AI/ML関連カテゴリ充実（21カテゴリ中3つがAI関連）

## 未解決事項
- Chrome Web Store の総登録数・カテゴリ数（Google非公開）
- Shopify Partner API の認証フロー詳細
- Salesforce AppExchange API の認証方式・公開範囲
- 各マーケットプレイスのレートリミット詳細
