# Architecture Decision Records (ADR)

> Xero Invoice Auto-Input System の技術決定記録

## ADR 一覧

| ADR ID | 決定内容 | Status | 日付 | 根拠 |
|--------|---------|--------|------|------|
| ADR-001 | xero-node SDK v14.0.0 を Next.js Server Actions/API Routes でのみ使用する | Accepted | 2026-03-10 | SDK は fs 依存がありクライアントサイドでは動作しない（CON-003）。REST API 直接呼び出しより型安全性・保守性が高い。廃止時の移行先は直接 fetch（migration surface: lib/xero/xero-service.ts 1ファイル） |
| ADR-002 | Auth.js v5 にカスタム Xero OIDC プロバイダーを定義する | Accepted | 2026-03-10 | Auth.js v5 にビルトイン Xero プロバイダーが存在しない。Xero は標準 OIDC Discovery (identity.xero.com/.well-known/openid-configuration) をサポートしているため、カスタム定義で対応可能。フォールバック: 手動 OAuth2 実装（3日工数） |
| ADR-003 | Drizzle ORM + better-sqlite3 を使用する（Prisma + PostgreSQL ではなく） | Accepted | 2026-03-10 | 単一サーバー・10ユーザー以下のローカルツール。SQLite は外部DB不要・ゼロ設定・バックアップはファイルコピーのみ。Drizzle は型安全な SQL ビルダーで学習コストが低い。スケールアウトが必要になった場合は PostgreSQL へ移行可能（Drizzle は両方サポート） |
| ADR-004 | インボイスは DRAFT ステータスで作成する（AUTHORISED ではなく） | Accepted | 2026-03-10 | 会計担当者（SH-002）が Xero 上で内容を確認してから送信するワークフローを維持する。誤送信リスクの排除。Xero DRAFT は編集・削除が可能で修正コストが低い |
| ADR-005 | InvoiceNumber は Xero の自動採番に委ねる（システム側では指定しない） | Accepted | 2026-03-10 | Xero API は InvoiceNumber を省略すると自動採番する（形式: JJB{YY}-{NNNN}）。システム側で番号管理すると、欠番・重複のリスクが生じる。Xero 側の一元管理により整合性を保証 |

## ADR フォーマット

各 ADR は以下の構造で記録する:

```
## ADR-XXX: タイトル

- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Date**: YYYY-MM-DD
- **Context**: 決定が必要になった背景
- **Decision**: 選択した方針
- **Consequences**: 結果として生じるメリット・デメリット
- **Alternatives Considered**: 検討した代替案
```

## 関連ドキュメント

- [requirements.md](../requirements.md) - 要件定義（EARS 準拠）
- [design.md](../design.md) - 技術設計書（C4 モデル）
- [threat-model.md](../threat-model.md) - 脅威モデル（STRIDE）
- [guardrails.md](../guardrails.md) - ガードレール定義
- [slo.md](../slo.md) - SLO/SLI/Error Budget
- [runbook.md](../runbook.md) - 運用手順書
- [tasks.md](../tasks.md) - タスク分解（Kiro 形式）
