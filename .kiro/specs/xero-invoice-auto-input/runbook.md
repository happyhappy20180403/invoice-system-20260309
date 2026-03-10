# Runbook - Xero Invoice Auto-Input System

> インシデント対応手順書（localhost:3000 運用）

---

## 1. 重大度定義（Severity Levels）

| レベル | 定義 | 応答時間 | 解決目標 | 例 |
|--------|------|---------|---------|-----|
| SEV1 | システム完全停止。インボイス作成不可 | 15分 | 1時間 | サーバーダウン、DB破損、全トークン失効 |
| SEV2 | コア機能が著しく劣化。手動回避策が必要 | 30分 | 4時間 | Xero API障害、自動補完全滅、トークンリフレッシュ失敗 |
| SEV3 | 一部機能が劣化。業務は継続可能 | 2時間 | 1営業日 | レート制限接近、一部キャッシュ不整合、レイテンシ悪化 |
| SEV4 | 軽微な問題。ユーザー影響なし〜最小限 | 1営業日 | 1週間 | ログ出力エラー、UIの軽微なバグ |

### エスカレーションフロー

```
SEV4 → 開発者が次回スプリントで対応
SEV3 → 開発者が当日中に調査開始
SEV2 → 開発者 + SH-003（システム管理者）に即時通知
SEV1 → 開発者 + SH-003 + SH-002（会計担当者）に即時通知
         → Xero管理画面での手動入力を代替手段として案内
```

---

## 2. インシデントシナリオ

---

### 2.1 Xero OAuthトークン失効（REQ-002, EH-003）

**重大度**: SEV2
**検知方法**: アラート `XeroTokenExpired` / ユーザーに「Xeroセッションが期限切れです」メッセージが表示

#### 症状
- Xero APIへの全リクエストが HTTP 401 を返す
- ユーザーがログイン画面にリダイレクトされる
- `xero_tokens` テーブルの `refresh_token_expires_at` が過去の日時

#### 診断手順

```bash
# 1. トークンの状態を確認
sqlite3 data/invoice-system.db \
  "SELECT id, expires_at, refresh_token_expires_at, updated_at FROM xero_tokens ORDER BY id DESC LIMIT 1;"

# 2. 最後のトークンリフレッシュ試行を確認
# Next.jsのコンソールログを確認
# Windows: PowerShellのログ / ターミナル出力を確認

# 3. Xero Developer Portalで接続状態を確認
# https://developer.xero.com/ → My Apps → 接続状態
```

#### 復旧手順

```
1. SH-003（システム管理者）に連絡
2. ブラウザで http://localhost:3000 にアクセス
3. 「Connect to Xero」ボタンをクリック
4. Xero認証画面でログインし、アクセスを許可
5. 認証完了後、ダッシュボードが表示されることを確認
6. テストとして1件のインボイスプレビュー（送信しない）を実行し、Xero APIが応答することを確認
```

#### 予防策
- リフレッシュトークンの有効期限は60日。2週間に1回以上はシステムを使用する
- `XeroTokenExpiringSoon` アラート（残り14日）で事前に再認証を促す

---

### 2.2 Xero APIレート制限ヒット（REQ-903, EH-018）

**重大度**: SEV3（通常） / SEV2（日次上限到達時）
**検知方法**: アラート `XeroRateLimitApproaching` / `XeroDailyLimitExhausted` / ユーザーに「レート制限に達しました」メッセージ

#### 症状
- Xero APIが HTTP 429 を返す
- インボイス作成時に「Xeroのレート制限に達しました。2分後に再試行してください。」メッセージ
- 日次上限到達時: 「本日のXero API使用上限に達しました。明日再試行してください。」メッセージ

#### 診断手順

```bash
# 1. 日次API使用量を確認
sqlite3 data/invoice-system.db \
  "SELECT key, value, updated_at FROM system_config WHERE key IN ('xero_daily_count', 'xero_daily_reset_at');"

# 2. 直近のAPIリクエスト頻度を確認（ログから）
# アプリケーションログで "429" または "rate limit" を検索

# 3. Xeroレスポンスヘッダーの制限情報を確認
# X-MinLimit-Remaining, X-DayLimit-Remaining
```

#### 復旧手順

**分間制限（60req/min）の場合:**
```
1. 60秒待機する（自動リトライが指数バックオフで実行される）
2. リトライが全て失敗した場合、2分待ってから再度「Xeroへ送信」ボタンを押す
3. 繰り返し発生する場合、バッチ的な操作を控え、1件ずつ間隔を空けて送信する
```

**日次制限（4,500req/day）の場合:**
```
1. 本日の残りの作業はXero管理画面から手動で入力する
2. 翌日00:00 UTC（08:00 MYT）にカウンタがリセットされる
3. 根本原因を調査: どの操作が大量のAPIコールを発生させたか確認
4. 必要に応じてキャッシュTTLを延長（Contacts: 60分→120分、Accounts: 24時間→48時間）
```

#### 予防策
- p-queueによる50req/min制限が正常に動作していることを確認
- キャッシュを活用し、不要なAPI呼び出しを削減
- 「データ同期」ボタンの連打を避ける

---

### 2.3 Xero APIダウン / 到達不能（EH-001）

**重大度**: SEV2
**検知方法**: アラート `XeroApiErrorRate` / ユーザーに「Xeroに接続できません」メッセージ

#### 症状
- Xero APIへのリクエストがタイムアウトまたは HTTP 500/502/503 を返す
- 自動補完はローカルキャッシュで動作するが、インボイス作成は不可
- 「Xero接続エラー: ローカルデータで検索中」通知が表示される

#### 診断手順

```bash
# 1. Xero APIの疎通確認
curl -s -o /dev/null -w "%{http_code}" https://api.xero.com/api.xro/2.0/Organisation

# 2. Xeroステータスページを確認
# https://status.xero.com/

# 3. DNSとネットワークの確認
nslookup api.xero.com
ping api.xero.com

# 4. ローカルネットワーク/プロキシの確認
curl -v https://api.xero.com/api.xro/2.0/ 2>&1 | head -30
```

#### 復旧手順

```
1. https://status.xero.com/ でXeroの障害情報を確認
2. Xero側の障害の場合:
   a. ユーザーに状況を伝える
   b. 緊急のインボイスはXero管理画面（Webブラウザ直接アクセス）で手動入力
   c. Xero復旧後に残りを本システムで処理
3. ネットワーク障害の場合:
   a. ルーター/モデムを再起動
   b. DNS設定を確認（8.8.8.8 / 1.1.1.1）
   c. プロキシ設定を確認
4. 復旧確認: http://localhost:3000 でテストインボイスのプレビューを実行
```

---

### 2.4 SQLiteデータベース破損（リスク R-07）

**重大度**: SEV1
**検知方法**: アプリケーションエラー「SQLITE_CORRUPT」/ システム起動失敗

#### 症状
- アプリケーションが起動しない、またはDB操作でエラーが発生
- `SQLITE_CORRUPT`, `SQLITE_NOTADB`, `database disk image is malformed` エラー
- 自動補完が動作しない（履歴データ参照不可）

#### 診断手順

```bash
# 1. データベースファイルの存在とサイズを確認
ls -la data/invoice-system.db
ls -la data/invoice-system.db-wal
ls -la data/invoice-system.db-shm

# 2. 整合性チェック
sqlite3 data/invoice-system.db "PRAGMA integrity_check;"

# 3. バックアップファイルの確認
ls -la data/backups/

# 4. SQLiteのバージョン確認
sqlite3 --version
```

#### 復旧手順

```
【方法1: バックアップからの復元（推奨）】
1. 現在の破損DBをリネーム
   mv data/invoice-system.db data/invoice-system.db.corrupted
   mv data/invoice-system.db-wal data/invoice-system.db-wal.corrupted 2>/dev/null
   mv data/invoice-system.db-shm data/invoice-system.db-shm.corrupted 2>/dev/null

2. 最新のバックアップから復元
   cp data/backups/invoice-system-YYYYMMDD.db data/invoice-system.db

3. アプリケーションを再起動
   # Ctrl+C で停止後
   npm run dev

4. データの確認
   - 自動補完が動作することを確認
   - 復元時点以降に作成したインボイスのログが欠損していないか確認
   - 欠損がある場合、Xero管理画面のインボイスリストと照合

【方法2: 部分復旧（バックアップが古い場合）】
1. 破損DBからデータ抽出を試みる
   sqlite3 data/invoice-system.db.corrupted ".dump" > dump.sql 2>/dev/null

2. 新しいDBに復元
   sqlite3 data/invoice-system-recovered.db < dump.sql

3. 復元結果を確認
   sqlite3 data/invoice-system-recovered.db "PRAGMA integrity_check;"

4. 問題なければ本番DBとして配置
   mv data/invoice-system-recovered.db data/invoice-system.db

【方法3: 完全再構築（バックアップなし・復旧不可の場合）】
1. DBスキーマを再作成（マイグレーション実行）
   npm run db:migrate

2. 履歴データを再インポート
   npm run db:seed  # 元CSVからの再インポート

3. Xero再認証
   ブラウザで http://localhost:3000 → 「Connect to Xero」

4. キャッシュ同期
   「データ同期」ボタンを押下

※ created_invoicesテーブルのログは失われるが、インボイス自体はXero側に存在する
```

#### 予防策
- SQLite WALモードを有効化（`PRAGMA journal_mode=WAL;`）
- 日次バックアップを設定（R-07の緩和策）
- ディスク空き容量を監視

---

### 2.5 誤ったインボイス作成（リスク R-11）

**重大度**: SEV3（DRAFT状態） / SEV2（AUTHORISEDに変更後に発覚）
**検知方法**: ユーザー/会計担当者からの報告

#### 症状
- 間違ったContactNameに対してインボイスが作成された
- 金額が間違っている
- AccountCodeやTrackingOptionが不正確

#### 対応手順

```
【30秒以内に気づいた場合（Undo機能がある場合）】
1. 送信完了画面で「取り消し」ボタンをクリック
2. DRAFTインボイスがXeroでVOIDED状態になる
3. 正しい内容で再入力・再送信

【DRAFT状態のインボイスの修正】
1. 送信完了画面に表示されたXeroリンクをクリック
   または Xero管理画面 → Business → Invoices → Draft
2. 該当インボイスを開く
3. 方法A: Xero上で直接修正して保存
4. 方法B: Xero上でインボイスを削除（DRAFTはDelete可能）し、本システムで再入力

【AUTHORISED状態に変更されてしまった場合】
1. SH-002（会計担当者）に連絡
2. Xero管理画面でインボイスをVOIDにする
3. 正しい内容で新しいインボイスを作成
4. ※ 顧客に既に送信済みの場合は、クレジットノートの発行が必要（Out of Scope - 手動対応）

【監査ログの確認】
sqlite3 data/invoice-system.db \
  "SELECT invoice_id, invoice_number, contact_name, total, created_at
   FROM created_invoices
   ORDER BY created_at DESC LIMIT 10;"
```

#### 予防策
- プレビュー画面で全フィールドを確認してから送信（REQ-011）
- DRAFTステータスでの作成を維持（REQ-013, ADR-004）
- 会計担当者がXero上で最終確認してからAUTHORISE（SH-002の役割）

---

### 2.6 トークンリフレッシュMutexデッドロック

**重大度**: SEV2
**検知方法**: 自動補完・インボイス作成が無限待機状態になる / ブラウザタイムアウト

#### 症状
- ページが永遠にローディング状態
- サーバーログに「Acquiring token refresh lock...」が出力されたまま完了ログがない
- 複数のAPI呼び出しが同時にトークンリフレッシュを試行した形跡がある

#### 診断手順

```bash
# 1. Node.jsプロセスの状態確認
# Windowsの場合
tasklist | grep node

# 2. サーバーログの確認（最新のmutex関連ログ）
# ターミナル出力で "mutex" "lock" "refresh" を確認

# 3. アクティブなリクエストの確認
curl -s http://localhost:3000/api/xero/health
# タイムアウトするならデッドロックの可能性が高い
```

#### 復旧手順

```
【即時復旧】
1. Next.js開発サーバーを再起動
   Ctrl+C で停止
   npm run dev

2. ブラウザのページをリロード
3. 動作確認: http://localhost:3000 でプレビューを実行

【根本原因の調査】
1. デッドロック発生時のサーバーログを保存
2. 以下を確認:
   - Mutexのタイムアウト設定が適切か（推奨: 10秒）
   - リフレッシュ処理内で例外が発生し、ロック解放が漏れていないか
   - try/finallyでロック解放が保証されているか

【コード修正が必要な場合】
- TokenManagerのmutex実装にタイムアウトを追加
- finally句でのロック解放を保証
- デッドロック検知ロジック（N秒後に強制解放）を追加
```

#### 予防策
- Mutexにタイムアウトを設定（10秒推奨）
- `try/finally` パターンでロック解放を保証
- REQ-002 EH-004: 同時リフレッシュは1つのみ実行、他は待機

---

## 3. ロールバック手順

### 3.1 DRAFTインボイスのロールバック

DRAFTステータスのインボイスはXero管理画面から**削除可能**（ADR-004の設計意図）。

```
【単一インボイスの削除】
1. Xero管理画面にログイン
2. Business → Invoices → Draft
3. 該当インボイスを選択
4. 「Delete」ボタンをクリック
5. ローカルDBのログを更新（任意）:
   sqlite3 data/invoice-system.db \
     "UPDATE created_invoices SET status='DELETED' WHERE invoice_number='JJB26-XXXX';"

【複数インボイスの一括削除】
1. Xero管理画面 → Business → Invoices → Draft
2. チェックボックスで複数選択
3. 「Delete」をクリック
```

### 3.2 アプリケーションのロールバック

```bash
# 直前のバージョンに戻す（Gitを使用している場合）
git log --oneline -5
git checkout <previous-commit-hash>
npm install
npm run dev

# 環境変数は .env.local に保持されているため変更不要
```

### 3.3 データベースのロールバック

```bash
# バックアップから復元
cp data/backups/invoice-system-YYYYMMDD.db data/invoice-system.db
# アプリケーション再起動
```

---

## 4. ポストモーテムテンプレート

### インシデントポストモーテム

```markdown
# ポストモーテム: [インシデントタイトル]

**日時**: YYYY-MM-DD HH:MM - HH:MM MYT
**重大度**: SEV-X
**担当者**: [名前]
**ステータス**: [調査中 / 完了]

---

## タイムライン

| 時刻 (MYT) | イベント |
|------------|---------|
| HH:MM | [検知方法]: [何が起きたか] |
| HH:MM | [最初のアクション] |
| HH:MM | [根本原因の特定] |
| HH:MM | [復旧アクション] |
| HH:MM | [復旧確認] |

---

## 影響範囲

- **影響を受けたユーザー数**: X人
- **影響を受けたインボイス数**: X件
- **ダウンタイム**: X分
- **SLOへの影響**: [エラーバジェット消費量]

---

## 5-Whys 分析

1. **Why**: なぜインシデントが発生したか？
   → [直接原因]

2. **Why**: なぜ[直接原因]が起きたか？
   → [原因の原因]

3. **Why**: なぜ[原因の原因]が起きたか？
   → [さらに深い原因]

4. **Why**: なぜ[さらに深い原因]が起きたか？
   → [根本原因に近づく]

5. **Why**: なぜ[根本原因に近づく]が起きたか？
   → **根本原因**: [Root Cause]

---

## 根本原因

[根本原因の詳細な説明]

---

## 教訓

### うまくいったこと
- [例: アラートが即座に発火し、検知が早かった]

### うまくいかなかったこと
- [例: Runbookの手順が古く、実際の環境と異なっていた]

---

## アクションアイテム

| # | アクション | 担当 | 期限 | ステータス |
|---|----------|------|------|----------|
| 1 | [再発防止策] | [名前] | YYYY-MM-DD | [ ] |
| 2 | [検知改善] | [名前] | YYYY-MM-DD | [ ] |
| 3 | [Runbook更新] | [名前] | YYYY-MM-DD | [ ] |
```

---

## 5. オンコール連絡先

| 役割 | 担当者 | 連絡方法 | 対応時間 |
|------|--------|---------|---------|
| システム管理者（SH-003） | [名前] | [社内チャット / 電話番号] | 営業時間 9:00-18:00 MYT |
| 会計担当者（SH-002） | [名前] | [社内チャット / 電話番号] | 営業時間 9:00-18:00 MYT |
| 開発者 | [名前] | [社内チャット / メール] | 営業時間 + 緊急時は時間外 |

### 連絡判断基準

| 状況 | 連絡先 |
|------|-------|
| SEV1: システム完全停止 | 開発者 → SH-003 → SH-002 |
| SEV2: コア機能障害 | 開発者 → SH-003 |
| SEV3: 一部機能劣化 | 開発者（次営業日で可） |
| SEV4: 軽微な問題 | 開発者（チケット起票） |
| Xero側の障害 | SH-003（Xero管理画面で手動対応を案内） |
| 誤ったインボイス作成 | SH-001 → SH-002（Xeroで修正/削除） |

---

## 改訂履歴

| 日付 | バージョン | 変更内容 |
|------|----------|---------|
| 2026-03-10 | 1.0 | 初版作成 |
