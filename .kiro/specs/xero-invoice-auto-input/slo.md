# SLO / SLI / Error Budget - Xero Invoice Auto-Input System

> localhost:3000 運用、月間約500件インボイス、5-10ユーザー、営業時間 9:00-18:00 MYT

---

## 1. SLI 定義（Service Level Indicators）

### 1.1 可用性（Availability）

```
SLI = (成功したHTTPリクエスト数) / (全HTTPリクエスト数) × 100%
```

- 計測対象: localhost:3000 への全リクエスト（5xx を失敗とみなす）
- 除外: 計画メンテナンス、Xero側の障害（外部依存）
- 計測方法: Next.js middleware でレスポンスステータスを記録

### 1.2 レイテンシ（Latency）

| パーセンタイル | 定義 |
|--------------|------|
| P50 | リクエストの50%がこの時間以内に完了 |
| P95 | リクエストの95%がこの時間以内に完了（REQ-901準拠） |
| P99 | リクエストの99%がこの時間以内に完了 |

- 計測対象: 自動補完API（`/api/autocomplete/*`）のサーバー処理時間
- 計測方法: `performance.now()` によるサーバーサイド計測 + ブラウザ Performance API

### 1.3 エラー率（Error Rate）

```
SLI = (Xero API 失敗リクエスト数) / (Xero API 全リクエスト数) × 100%
```

- 計測対象: Xero API への全リクエスト（HTTP 4xx/5xx）
- 除外: HTTP 429（レート制限）はリトライ後の最終結果で判定
- 計測方法: `created_invoices` テーブルの成功/失敗比率

---

## 2. SLO ターゲット（Service Level Objectives）

| SLO ID | メトリクス | ターゲット | 計測ウィンドウ | 根拠 |
|--------|----------|----------|-------------|------|
| SLO-001 | 可用性（営業時間内） | >= 99.0% | 30日ローリング | REQ: 成功条件「システム稼働率99%以上」 |
| SLO-002 | 自動補完レイテンシ P50 | <= 200ms | 30日ローリング | ユーザー体験目標 |
| SLO-003 | 自動補完レイテンシ P95 | <= 500ms | 30日ローリング | REQ-901「500ms以内」 |
| SLO-004 | 自動補完レイテンシ P99 | <= 1000ms | 30日ローリング | 最悪ケースの上限 |
| SLO-005 | Xero API 成功率 | >= 99.0% | 30日ローリング | REQ: 成功条件「エラー率1%未満」 |
| SLO-006 | Xero API レート制限遵守 | 100%（429発生 0件） | 日次 | REQ-903 |

### 営業時間の定義

- **対象時間**: 月〜金 9:00-18:00 MYT (UTC+8)
- **月間対象時間**: 約198時間（22営業日 × 9時間）
- **99%可用性の許容ダウンタイム**: 約118分/月（約1.98時間）

---

## 3. エラーバジェットポリシー（Error Budget Policy）

### 3.1 バジェット計算

| SLO | ターゲット | 月間エラーバジェット | 単位 |
|-----|----------|-------------------|------|
| 可用性 99% | 1.0% | 118分 | ダウンタイム（営業時間内） |
| P95 レイテンシ 500ms | 5.0% | 約25件 | 500ms超のリクエスト（月500件想定） |
| API 成功率 99% | 1.0% | 約5件 | 失敗API呼び出し（月500件想定） |

### 3.2 バジェット消費率とアクション

| 消費率 | ステータス | アクション |
|--------|----------|----------|
| 0-50% | GREEN | 通常運用。新機能開発を優先可能 |
| 50-80% | YELLOW | 警戒態勢。信頼性改善タスクを優先 |
| 80-100% | ORANGE | 新機能開発を一時停止。信頼性改善に集中 |
| 100%+ | RED | 全開発を停止。インシデント対応と根本原因分析を実施 |

### 3.3 アラート閾値

| レベル | 条件 | 通知先 |
|--------|------|-------|
| WARNING | エラーバジェット消費 50% 到達 | SH-003（システム管理者） |
| CRITICAL | エラーバジェット消費 80% 到達 | SH-003 + 開発者 |
| EMERGENCY | エラーバジェット消費 100% 到達 | SH-003 + 開発者 + SH-002 |

---

## 4. アラートルール（Prometheus / Alertmanager 形式）

> localhost:3000 モニタリング用。Node.js `prom-client` でメトリクスを公開する想定。

### 4.1 Prometheus メトリクス定義

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'invoice-system'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics'
    scrape_interval: 15s
```

### 4.2 アラートルール

```yaml
# alert_rules.yml
groups:
  - name: invoice_system_slo
    rules:
      # --- 可用性アラート ---
      - alert: HighErrorRate
        expr: |
          (
            sum(rate(http_requests_total{job="invoice-system", code=~"5.."}[5m]))
            /
            sum(rate(http_requests_total{job="invoice-system"}[5m]))
          ) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "エラー率が1%を超過（SLO-001違反リスク）"
          description: "直近5分間のHTTP 5xxエラー率: {{ $value | humanizePercentage }}"

      - alert: ServiceDown
        expr: up{job="invoice-system"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "インボイスシステムがダウン"
          description: "localhost:3000 が応答していません"

      # --- レイテンシアラート ---
      - alert: HighP95Latency
        expr: |
          histogram_quantile(0.95,
            sum(rate(autocomplete_request_duration_seconds_bucket{job="invoice-system"}[5m])) by (le)
          ) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "自動補完P95レイテンシが500msを超過（SLO-003違反リスク）"
          description: "P95レイテンシ: {{ $value }}秒"

      - alert: HighP99Latency
        expr: |
          histogram_quantile(0.99,
            sum(rate(autocomplete_request_duration_seconds_bucket{job="invoice-system"}[5m])) by (le)
          ) > 1.0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "自動補完P99レイテンシが1秒を超過（SLO-004違反リスク）"
          description: "P99レイテンシ: {{ $value }}秒"

      # --- Xero API アラート ---
      - alert: XeroApiErrorRate
        expr: |
          (
            sum(rate(xero_api_requests_total{job="invoice-system", status=~"4..|5.."}[15m]))
            /
            sum(rate(xero_api_requests_total{job="invoice-system"}[15m]))
          ) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Xero APIエラー率が1%を超過（SLO-005違反リスク）"
          description: "直近15分間のXero APIエラー率: {{ $value | humanizePercentage }}"

      - alert: XeroRateLimitApproaching
        expr: xero_api_minute_remaining{job="invoice-system"} < 10
        for: 0m
        labels:
          severity: warning
        annotations:
          summary: "Xero API分間レート制限に接近（残り{{ $value }}リクエスト）"
          description: "REQ-903: 50req/min上限に対し、残り{{ $value }}件"

      - alert: XeroDailyLimitApproaching
        expr: xero_api_daily_remaining{job="invoice-system"} < 500
        for: 0m
        labels:
          severity: warning
        annotations:
          summary: "Xero API日次制限に接近（残り{{ $value }}リクエスト）"
          description: "日次上限4,500件に対し、残り{{ $value }}件"

      - alert: XeroDailyLimitExhausted
        expr: xero_api_daily_remaining{job="invoice-system"} < 100
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "Xero API日次制限がほぼ枯渇（REQ-903 EH-903）"
          description: "残り{{ $value }}件。新規APIリクエストを停止中"

      # --- トークン健全性アラート ---
      - alert: XeroTokenExpiringSoon
        expr: xero_refresh_token_expiry_seconds{job="invoice-system"} < 1209600
        for: 0m
        labels:
          severity: warning
        annotations:
          summary: "Xeroリフレッシュトークンが14日以内に失効"
          description: "残り{{ $value | humanizeDuration }}。管理者の再認証が必要（REQ-002 EH-003）"

      - alert: XeroTokenExpired
        expr: xero_refresh_token_expiry_seconds{job="invoice-system"} <= 0
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "Xeroリフレッシュトークンが失効済み"
          description: "即座に再認証が必要です（REQ-001）"

      # --- エラーバジェットアラート ---
      - alert: ErrorBudgetConsumed50Pct
        expr: |
          1 - (
            sum(rate(http_requests_total{job="invoice-system", code!~"5.."}[30d]))
            /
            sum(rate(http_requests_total{job="invoice-system"}[30d]))
          ) / 0.01 > 0.5
        for: 0m
        labels:
          severity: warning
        annotations:
          summary: "エラーバジェット50%消費"

      - alert: ErrorBudgetConsumed80Pct
        expr: |
          1 - (
            sum(rate(http_requests_total{job="invoice-system", code!~"5.."}[30d]))
            /
            sum(rate(http_requests_total{job="invoice-system"}[30d]))
          ) / 0.01 > 0.8
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "エラーバジェット80%消費 - 新機能開発を一時停止"
```

### 4.3 Alertmanager 設定

```yaml
# alertmanager.yml
global:
  resolve_timeout: 5m

route:
  receiver: 'default'
  group_by: ['alertname']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 1h
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
      repeat_interval: 15m
    - match:
        severity: warning
      receiver: 'warning-alerts'
      repeat_interval: 4h

receivers:
  - name: 'default'
    webhook_configs:
      - url: 'http://localhost:3000/api/alerts/webhook'

  - name: 'critical-alerts'
    webhook_configs:
      - url: 'http://localhost:3000/api/alerts/webhook'
        send_resolved: true
    # ローカル運用のため、メール通知はオプション
    # email_configs:
    #   - to: 'admin@example.com'

  - name: 'warning-alerts'
    webhook_configs:
      - url: 'http://localhost:3000/api/alerts/webhook'
        send_resolved: true
```

---

## 5. ダッシュボード仕様

### 5.1 概要パネル（トップ行）

| パネル | 表示内容 | 可視化 |
|--------|---------|--------|
| 現在のステータス | UP / DOWN | Stat（緑/赤） |
| 可用性（30日） | 99.xx% | Gauge（閾値: 99%） |
| 本日のインボイス作成数 | N件 | Stat |
| エラーバジェット残量 | xx% | Gauge（閾値: 50%, 80%, 100%） |

### 5.2 レイテンシパネル（2行目）

| パネル | 表示内容 | 可視化 |
|--------|---------|--------|
| 自動補完レイテンシ（P50/P95/P99） | 時系列グラフ | Graph（500ms閾値線付き） |
| レイテンシ分布 | ヒストグラム | Heatmap |

### 5.3 Xero API パネル（3行目）

| パネル | 表示内容 | 可視化 |
|--------|---------|--------|
| API 成功率（30日） | 99.xx% | Gauge（閾値: 99%） |
| API リクエスト数（分間） | 時系列 | Graph（50req/min閾値線付き） |
| 日次API消費量 | 累積カウンタ | Graph（4,500閾値線付き） |
| APIエラー内訳 | 400/401/429/500 | StackedBar |

### 5.4 トークン健全性パネル（4行目）

| パネル | 表示内容 | 可視化 |
|--------|---------|--------|
| アクセストークン残り時間 | mm:ss | Stat（閾値: 5分） |
| リフレッシュトークン残り日数 | N日 | Stat（閾値: 14日） |
| トークンリフレッシュ履歴 | 時系列 | Graph |

### 5.5 ビジネスメトリクスパネル（5行目）

| パネル | 表示内容 | 可視化 |
|--------|---------|--------|
| 月間インボイス作成数 | N / 500目標 | Gauge |
| 自動補完正答率（ContactName） | xx% | Stat（閾値: 90%） |
| 自動補完正答率（AccountCode） | xx% | Stat（閾値: 85%） |
| 1件あたり平均作成時間 | N秒 | Stat（閾値: 120秒） |

---

## 6. メトリクス実装ガイド

### 6.1 必要な Prometheus メトリクス

```typescript
// lib/metrics.ts (prom-client)
import { Counter, Histogram, Gauge } from 'prom-client';

// HTTP リクエスト
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'code'],
});

// 自動補完レイテンシ
export const autocompleteLatency = new Histogram({
  name: 'autocomplete_request_duration_seconds',
  help: 'Autocomplete request duration',
  buckets: [0.05, 0.1, 0.2, 0.3, 0.5, 0.75, 1.0, 2.0],
});

// Xero API リクエスト
export const xeroApiRequests = new Counter({
  name: 'xero_api_requests_total',
  help: 'Total Xero API requests',
  labelNames: ['endpoint', 'status'],
});

// Xero レート制限残量
export const xeroMinuteRemaining = new Gauge({
  name: 'xero_api_minute_remaining',
  help: 'Xero API minute rate limit remaining',
});

export const xeroDailyRemaining = new Gauge({
  name: 'xero_api_daily_remaining',
  help: 'Xero API daily rate limit remaining',
});

// トークン有効期限
export const xeroRefreshTokenExpiry = new Gauge({
  name: 'xero_refresh_token_expiry_seconds',
  help: 'Seconds until Xero refresh token expires',
});
```

### 6.2 メトリクスエンドポイント

```
GET /api/metrics → Prometheus形式のメトリクスを返却
```

---

## 改訂履歴

| 日付 | バージョン | 変更内容 |
|------|----------|---------|
| 2026-03-10 | 1.0 | 初版作成 |
