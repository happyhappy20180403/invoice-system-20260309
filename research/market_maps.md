# Market Map: AIエコシステム周辺プラットフォーム調査レポート

**確認日**: 2026-03-11
**調査対象**: 7プラットフォーム

## 比較マトリクス

| プラットフォーム | 主用途 | 登録数規模 | 公開API | メタデータ充実度 | カテゴリ粒度 |
|----------------|--------|-----------|---------|----------------|------------|
| mcp.so | MCPサーバー | 18,387 | あり | 中（GitHub連携） | 低（4タグ軸） |
| smithery.ai | MCPサーバー | 7,300+ | あり | 中 | 中（8+カテゴリ） |
| composio.dev | ツール統合 | 850ツールキット/11,000+ツール | あり(SDK+REST) | 中 | 高（20+カテゴリ） |
| rapidapi.com | APIマーケット | 非公開（最大規模） | あり(Hub API) | 中（インストール数あり） | 中 |
| huggingface.co | AI Models/Data | Models 200万+、Spaces 100万+ | あり(充実) | 高（Stars/DL数/更新日） | 高（3大+タスク別） |
| libraries.io | OSSパッケージ | 1,073万+ | あり（制限付き） | 中（有料で充実） | 高（32PM別） |
| public-apis | 無料API一覧 | 406k Stars相当 | なし | 低（静的MD） | 中（50+カテゴリ） |

## 各プラットフォーム詳細

### 1. mcp.so (18,387 MCPサーバー)
- **カテゴリ**: Featured / Official / Hosted / Latest の4タグ軸 + Categories / Tags
- **API**: APIキー機能あり（プログラマティックアクセス対応）
- **メタデータ**: 名前・説明・ロゴ・作成者・作成日時・GitHub URL・カテゴリ・タグ・Sponsorフラグ
- **robots.txt**: `?*q=` クエリパラメータをDisallow
- 出典: https://mcp.so/

### 2. smithery.ai (7,300+ MCPサーバー)
- **カテゴリ**: Memory / Web Search / Academic Research / Reasoning & Planning / Browser Automation / Reference Data / LLM Integration 他
- **API**: 共有APIキー + `/docs/mcp` エンドポイント
- **注意**: 直接アクセスで429エラー（レート制限厳しめ）
- 出典: https://smithery.ai/ , https://workos.com/blog/smithery-ai

### 3. composio.dev (850ツールキット / 11,000+ツール)
- **カテゴリ**: Developer Tools & DevOps / Collaboration / AI & ML / Document / Productivity / CRM / Analytics / Finance / HR 他（約20カテゴリ）
- **API**: Python SDK + REST API + MCP経由
- **更新頻度**: 「毎日より正確に」と記載
- 出典: https://composio.dev/

### 4. rapidapi.com (世界最大APIマーケットプレイス)
- **API**: Hub API あり
- **メタデータ**: API名・説明・インストール数（全期間）
- **備考**: 2024年11月にNokia買収
- 出典: https://rapidapi.com/

### 5. huggingface.co (Models 200万+ / Datasets 50万+ / Spaces 100万+)
- **カテゴリ**: Models / Datasets / Spaces × タスク別・ライブラリ別・言語別
- **API**: Hub Python Library + REST API + Inference API（45,000+モデル）
- **メタデータ**: Stars・DL数・更新日時・フォロワー数 **← 最も充実**
- 出典: https://huggingface.co/

### 6. libraries.io (1,073万+ OSSパッケージ)
- **カテゴリ**: 32パッケージマネージャー別（npm/PyPI/Maven/Go等）+ 言語・ライセンス
- **API**: 無料版（レート制限あり）、有料版（Tidelift）で充実
- 出典: https://libraries.io/

### 7. public-apis (406k GitHub Stars)
- **カテゴリ**: 50+カテゴリ（Animals/Art/Auth/Blockchain等）
- **メタデータ**: 名前・説明・認証方式・HTTPS・CORS
- **API**: なし（静的Markdown）
- 出典: https://github.com/public-apis/public-apis

## 優先度ランキング（market_map構築向け）

1. **Hugging Face** - API最充実、三軸メタデータ（Stars/DL数/更新日）が無料取得可能
2. **mcp.so + smithery.ai** - MCP特化。合計約26,000サーバー。APIキーあり
3. **composio.dev** - 20+カテゴリの分類体系が統合マップのテンプレートとして最適
4. **libraries.io** - OSS横断検索に最適。詳細APIは有料
5. **rapidapi.com** - 安定基盤。インストール数ソートが特徴的

## 未解決事項

1. smithery.ai の429エラー問題 → 公式APIドキュメント詳細確認要
2. rapidapi.com の登録API総数・カテゴリ一覧
3. 各サイトのAPI rate limit具体数値
4. mcp.so vs smithery.ai の重複率
5. libraries.io 有料プラン費用対効果
