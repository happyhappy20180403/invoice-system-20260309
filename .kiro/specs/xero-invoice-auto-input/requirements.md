# Requirements: xero-invoice-auto-input

> Xero API連携インボイス自動入力システムの要件定義書（EARS準拠・C.U.T.E.採点対象）

## 1. 目的（概要 / Executive Summary）
- マレーシア・ジョホールバル所在の物件管理会社が、修理・請求リストの5項目（Date, Project, Unit No, Detail, Final Price）を入力すると、過去3年分18,860件の履歴データおよびXero APIから全フィールドを自動補完し、XeroにDRAFTインボイスを作成するWebシステムである。
- 担当スタッフの手作業入力を削減し、Xeroへのインボイス登録にかかる時間を1件あたり10分以上から2分以内に短縮することを目的とする。

## 2. 背景 & Context
- 現在、担当スタッフが修理リスト（紙またはPDF）を参照し、Xeroの画面に手動で全項目を入力している。
- 1件のインボイスにつきContactName、AccountCode、Description、TrackingOption1/2など44項目の入力が必要で、ミスが発生しやすい。
- 過去のXeroエクスポートCSV（2023年1月〜2025年12月、38ファイル、18,860行）が存在し、入力パターンの学習素材として利用可能である。
- Xero Developer Appは取得済み（Web App型、OAuth2、Client ID/Secret保存済み）。
- Xero API Starterティア（$0/月、5接続、転送量無制限）で運用する。

## 3. スコープ
### 3.1 In Scope
- Xero OAuth2認証フロー（Auth.js v5カスタムプロバイダー）
- 5項目入力フォーム（Date, Project, Unit No, Detail, Final Price）
- 過去データ（SQLite）およびXero APIからの自動補完
- 補完結果プレビュー画面（全項目を表示、編集可能）
- XeroへのDRAFTインボイス作成（POST /Invoices）
- インボイス作成ログの保存（ローカルSQLite）
- ContactNameの既存データからの検索（新規自動生成禁止）
- TrackingOption1/2の既存選択肢からの参照（新規自動生成禁止）

### 3.2 Out of Scope（重要）
- Xeroからの支払いステータス管理
- クレジットノートの作成
- PDF/画像からのOCR自動読み取り（Phase 3で検討）
- 複数行一括入力（Phase 2で検討）
- モバイル専用UI
- 多通貨対応（MYR固定）
- Xero以外の会計ソフトとの連携

## 4. 用語集 / Glossary
| 用語 | 定義 |
|------|------|
| インボイス（INVOICE） | 弊社が利益を上乗せして請求する文書。ReferenceフィールドにINVOICEと記録される |
| デビットノート（DEBIT NOTE） | 弊社が代理で受け取り、そのまま払い出す文書。ReferenceフィールドにDEBIT NOTEと記録される |
| Project | 物件開発名。25種類（Suasana, MP4, V@Summerplace等）が存在する |
| Unit No | 物件内のユニット番号（例: B-10-03, 17-07, 31-09） |
| ContactName | Xero上の連絡先名。形式: "{ProjectName} {UnitNumber} (O){OwnerName}" または "{TenantFullName}" |
| AccountCode | Xero上の勘定科目コード。形式: "1003-XXXX"（物件固有）または "506-X"等（汎用） |
| TrackingOption1 | "NATURE OF ACCOUNT"トラッキングカテゴリの値。28種類（IN - REP, (IN) - ROB等） |
| TrackingOption2 | "Categories/Projects"トラッキングカテゴリの値。25プロジェクト名 |
| DRAFT | Xeroのインボイスステータス。送信前の下書き状態 |
| Final Price | 顧客への最終請求額（利益上乗せ後） |
| ROB | Receive on Behalf。代理受取を示すTrackingOption1の値 |
| REP | Repair。修理を示すTrackingOption1の値 |
| REQ | Request。テナントリクエストを示すTrackingOption1の値 |

## 5. ステークホルダー & 役割
| Role | 権限/責務 |
|------|----------|
| 物件管理スタッフ（SH-001） | 修理リストから5項目を入力し、プレビューを確認後にXeroへ送信する。ContactNameが見つからない場合は手動で入力する |
| 会計担当者（SH-002） | Xero上でDRAFTインボイスを確認し、AUTHORISEDに変更して送信する |
| システム管理者（SH-003） | Xero OAuth2の認証・再認証を行う。システムの稼働状態を監視する |

## 6. 前提/仮定（Assumptions）

## Assumption Log（前提・仮定）

| ID | 前提/仮定の内容 | 検証方法 | リスク(H/M/L) | 担当者 | 期限 |
|----|--------------|---------|--------------|-------|------|
| ASM-001 | Xero Developer Appは2026年3月2日以前に作成されたため、広域スコープ（accounting.transactions等）を2027年9月まで使用可能 | Xero Developer Portal で確認 | M | SH-003 | 2027/03 |
| ASM-002 | Xero API Starterティア（$0/月）で月間500件のインボイス作成に対応可能（レート制限: 60回/分、5,000回/日） | 本番運用で監視 | L | SH-003 | 運用開始後1ヶ月 |
| ASM-003 | 全インボイスのTaxTypeは"Tax Exempt"、Currencyは"MYR"である | 過去18,860件のデータで確認済み | L | SH-002 | 確認済み |
| ASM-004 | TrackingCategoryは組織あたり2つ（NATURE OF ACCOUNT、Categories/Projects）で固定されている | Xero管理画面で確認 | L | SH-003 | 確認済み |
| ASM-005 | 同時利用ユーザー数は10名以下である | 運用実態から推定 | L | SH-001 | 運用開始後 |
| ASM-006 | xero-node SDK v14.0.0はNext.js 15のAPI Routes/Server Actions内で動作する（クライアントサイドでは使用しない） | 開発時のビルドテストで確認 | M | SH-003 | 開発Phase 1 Week 1 |

## Constraints（制約）

| ID | 制約内容 | 出典/理由 | 影響範囲 |
|----|---------|---------|---------|
| CON-001 | Xero APIレート制限: 60リクエスト/分、5,000リクエスト/日 | Xero API Documentation | バッチ処理設計 |
| CON-002 | Xero OAuthアクセストークン有効期限: 30分、リフレッシュトークン: 60日 | Xero OAuth2仕様 | トークン管理設計 |
| CON-003 | xero-node SDKはfs依存のためサーバーサイドでのみ使用可能 | xero-node GitHub Issue #543 | Next.jsアーキテクチャ |
| CON-004 | TrackingCategoryはXero組織あたり2つまで | Xero API制限 | トラッキング設計 |
| CON-005 | インボイスバッチ作成: 1リクエストあたり50件まで | Xero API Documentation | バッチ処理設計 |
| CON-006 | localhost:3000で運用する（外部公開しない） | 社内ツール | ネットワーク設計 |

## 7. 制約（Constraints）
- 上記CON-001〜CON-006を参照

## 8. 成功条件（Success Metrics）
| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| 1件あたりのインボイス作成時間 | 120秒以内（入力開始からXero送信完了まで） | ストップウォッチ計測（10件平均） |
| 自動補完の正答率（ContactName） | 90%以上（手動修正不要の割合） | 運用開始後30日間の修正回数/総件数 |
| 自動補完の正答率（AccountCode） | 85%以上 | 運用開始後30日間の修正回数/総件数 |
| Xero APIエラー率 | 1%未満 | created_invoicesテーブルのエラーログ/総送信数 |
| システム稼働率（営業時間内） | 99%以上（月間） | ダウンタイム記録 |

## 9. 機能要件（Functional Requirements）

### REQ-001: Xero OAuth2認証
- 種別: EARS-イベント駆動
- 優先度: MUST
- 要件文(EARS): システム管理者が「Connect to Xero」ボタンを押下したとき、システムはXero OAuth2認証フロー（issuer: identity.xero.com、scopes: openid profile email offline_access accounting.transactions accounting.contacts accounting.settings）を開始し、認証成功後にアクセストークン・リフレッシュトークン・tenantIdをAES-256-GCMで暗号化してSQLiteに保存しなければならない。
- 根拠/目的: Xero APIへのアクセスに必須（SH-003のニーズ）
- 受入テスト(GWT):
  - AT-001: Given システムが未認証状態である When システム管理者が「Connect to Xero」ボタンを押下する Then Xeroのログイン画面にリダイレクトされ、認証完了後にダッシュボード画面が表示され、xero_tokensテーブルにレコードが1件保存される
- 例外・エラー:
  - EH-001: Xero認証サーバーが応答しない場合、システムは「Xeroに接続できません。30秒後に再試行してください。」というエラーメッセージを表示しなければならない。
  - EH-002: ユーザーが認証を拒否した場合、システムはログイン画面に戻り「Xero認証が拒否されました」というメッセージを表示しなければならない。
- 補足:
  - 関連: REQ-002
  - トレーサビリティ: SH-003

### REQ-002: トークン自動更新
- 種別: EARS-状態駆動
- 優先度: MUST
- 要件文(EARS): アクセストークンの有効期限まで残り5分以内の間、システムはMutexロックを取得してリフレッシュトークンを使用し新しいアクセストークンを取得してSQLiteに保存しなければならない。
- 根拠/目的: Xeroアクセストークンは30分で失効するため、API呼び出し中の認証エラーを防止する（SH-001, SH-003のニーズ）
- 受入テスト(GWT):
  - AT-002: Given アクセストークンの有効期限まで残り4分である When Xero APIへのリクエストが発生する Then 新しいアクセストークンが取得され、xero_tokensテーブルのaccess_tokenカラムが更新され、APIリクエストが成功する
- 例外・エラー:
  - EH-003: リフレッシュトークンが失効している場合（60日以上未使用）、システムはログイン画面にリダイレクトし「Xeroセッションが期限切れです。再認証してください。」というメッセージを表示しなければならない。
  - EH-004: 同時に2つ以上のリフレッシュリクエストが発生した場合、Mutexロックにより1つのみが実行され、他は完了を待機しなければならない。
- 補足:
  - 関連: REQ-001
  - トレーサビリティ: SH-001, SH-003

### REQ-003: 5項目入力フォーム
- 種別: EARS-普遍
- 優先度: MUST
- 要件文(EARS): システムはDate（日付）、Project（プロジェクト名）、Unit No（ユニット番号）、Detail（修理・購入内容）、Final Price（最終請求額、MYR）の5つの入力フィールドを持つフォームを提供しなければならない。
- 根拠/目的: 担当スタッフが修理リストから転記する最小限の入力項目（SH-001のニーズ）
- 受入テスト(GWT):
  - AT-003: Given ダッシュボード画面が表示されている When 入力フォームを確認する Then Date（日付ピッカー）、Project（ドロップダウン、25プロジェクト）、Unit No（テキスト入力）、Detail（テキスト入力）、Final Price（数値入力、小数点以下2桁）の5フィールドが表示されている
- 例外・エラー:
  - EH-005: Final Priceに0以下または数値以外の値が入力された場合、システムは「金額は0.01 MYR以上の数値を入力してください」というバリデーションエラーを表示しなければならない。
  - EH-006: 必須フィールド（Date, Project, Unit No, Detail, Final Price）のいずれかが空の場合、システムは該当フィールドに「この項目は必須です」と表示し、送信を阻止しなければならない。
- 補足:
  - 関連: REQ-004, REQ-005
  - トレーサビリティ: SH-001

### REQ-004: ContactName自動補完
- 種別: EARS-イベント駆動
- 優先度: MUST
- 要件文(EARS): スタッフがProjectとUnit Noを入力したとき、システムはXero Contacts APIのキャッシュ（TTL: 60分）および過去履歴データベースからContactNameを検索し、一致するContactName候補を最大5件表示しなければならない。
- 根拠/目的: ContactNameの手動入力を削減し、既存コンタクトとの整合性を保つ（SH-001のニーズ）
- 受入テスト(GWT):
  - AT-004: Given Xero Contactsキャッシュに「Suasana Iskandar 17-07 Nur Nadzira Binti MD Sap」が存在する When ProjectにSuasana、Unit Noに17-07を入力する Then ContactName候補として「Suasana Iskandar 17-07 Nur Nadzira Binti MD Sap」が表示される
  - AT-041: Given ProjectにMP4、Unit NoにB-10-03を入力した When 履歴データベースに該当するContactNameが3件存在する Then 3件の候補がスコア順に表示される
- 例外・エラー:
  - EH-007: 一致するContactNameが0件の場合、システムは「一致するコンタクトが見つかりません。手動で入力してください。」という警告を表示し、ContactNameの手動入力フィールドを表示しなければならない。
  - EH-008: Xero Contacts APIがエラーを返した場合、システムはローカルキャッシュのみで検索を続行し、画面上部に「Xero接続エラー: ローカルデータで検索中」という通知を表示しなければならない。
- 補足:
  - 関連: REQ-003, REQ-007
  - ContactNameを自動生成してはならない。既存データにない場合はスタッフが手動で入力する
  - トレーサビリティ: SH-001

### REQ-005: AccountCode自動補完
- 種別: EARS-イベント駆動
- 優先度: MUST
- 要件文(EARS): スタッフがProjectとUnit Noを入力したとき、システムは過去履歴データベースおよびXero Accounts APIのキャッシュ（TTL: 24時間）からAccountCodeを検索し、最も使用頻度の高いAccountCodeを自動選択しなければならない。
- 根拠/目的: 211種類のAccountCodeから正しいものを自動特定する（SH-001のニーズ）
- 受入テスト(GWT):
  - AT-005: Given 過去データでProject=Suasana、Unit No=17-07に対するAccountCodeが「1003-1025」である When ProjectにSuasana、Unit Noに17-07を入力する Then AccountCodeフィールドに「1003-1025」が自動入力される
- 例外・エラー:
  - EH-009: 過去データに該当するProject+Unit Noの組み合わせが存在しない場合、システムはAccountCodeフィールドを空のまま表示し、Xero Accountsの全リストからドロップダウンで選択できるようにしなければならない。
- 補足:
  - 関連: REQ-003, REQ-004
  - トレーサビリティ: SH-001

### REQ-006: Description自動補完
- 種別: EARS-イベント駆動
- 優先度: MUST
- 要件文(EARS): スタッフがDetailを入力したとき、システムは過去履歴データベースのDescriptionパターンを参照し、費目種別（WATER CHARGES、ELECTRIC CHARGES、RENTAL等）と日付/期間を過去データと同一形式で組み合わせたDescription候補を表示しなければならない。
- 根拠/目的: Descriptionの記述を過去データと統一する（SH-001, SH-002のニーズ）
- 受入テスト(GWT):
  - AT-006: Given Detailに「WATER」と入力し、Dateが「03/02/2026」である When 自動補完が実行される Then Description候補に「WATER CHARGES FEB 2026」が含まれる
  - AT-061: Given Detailに「COOKER HOOD REPAIR」と入力した When 自動補完が実行される Then Descriptionフィールドに「COOKER HOOD REPAIR」がそのまま設定される（定型パターンに該当しないため）
- 例外・エラー:
  - EH-010: 過去データにDetailの類似パターンが存在しない場合、システムはDetailの入力値をそのままDescriptionフィールドに設定しなければならない。
- 補足:
  - 関連: REQ-003
  - トレーサビリティ: SH-001, SH-002

### REQ-007: TrackingOption1自動補完
- 種別: EARS-イベント駆動
- 優先度: MUST
- 要件文(EARS): スタッフがDetailを入力したとき、システムは過去履歴データベースおよびXero TrackingCategories APIのキャッシュ（TTL: 24時間）を参照し、28種類のTrackingOption1（NATURE OF ACCOUNT）から該当する値を自動選択しなければならない。
- 根拠/目的: TrackingOption1の正確な分類（SH-001, SH-002のニーズ）
- 受入テスト(GWT):
  - AT-007: Given Detailに「COOKER HOOD REPAIR」と入力した When 自動補完が実行される Then TrackingOption1に「IN - REP」が自動選択される
  - AT-071: Given Detailに「RENTAL FOR MAR 2026」と入力した When 自動補完が実行される Then TrackingOption1に「(IN) - ROB」が自動選択される
- 例外・エラー:
  - EH-011: 自動判定ができない場合、システムはTrackingOption1フィールドを空にし、28種類の既存選択肢からドロップダウンで選択できるようにしなければならない。TrackingOption1の新規値を自動生成してはならない。
- 補足:
  - 関連: REQ-003, REQ-008
  - トレーサビリティ: SH-001, SH-002

### REQ-008: TrackingOption2自動補完
- 種別: EARS-イベント駆動
- 優先度: MUST
- 要件文(EARS): スタッフがProjectを入力したとき、システムはXero TrackingCategories APIのキャッシュ（TTL: 24時間）を参照し、25種類のTrackingOption2（Categories/Projects）からProject名に対応する値を自動選択しなければならない。
- 根拠/目的: TrackingOption2をProject名から一意に決定する（SH-001のニーズ）
- 受入テスト(GWT):
  - AT-008: Given ProjectにMP4を選択した When 自動補完が実行される Then TrackingOption2に「MP4」が自動選択される
- 例外・エラー:
  - EH-012: 入力されたProjectがTrackingOption2の25種類に含まれない場合、システムはTrackingOption2フィールドを空にし、既存選択肢からドロップダウンで選択できるようにしなければならない。TrackingOption2の新規値を自動生成してはならない。
- 補足:
  - 関連: REQ-003, REQ-007
  - トレーサビリティ: SH-001

### REQ-009: Reference自動判定
- 種別: EARS-イベント駆動
- 優先度: MUST
- 要件文(EARS): スタッフがDetailを入力したとき、システムは過去履歴データベースのパターンを参照し、ReferenceフィールドにINVOICEまたはDEBIT NOTEのいずれかを自動設定しなければならない。
- 根拠/目的: インボイスとデビットノートの分類を自動化する（SH-001, SH-002のニーズ）
- 受入テスト(GWT):
  - AT-009: Given Detailが修理内容（REPAIRを含む）で利益上乗せがある When 自動補完が実行される Then Referenceに「INVOICE」が設定される
  - AT-091: Given Detailが代理受取（RENTAL, WATER CHARGES等）である When 自動補完が実行される Then Referenceに「DEBIT NOTE」が設定される
- 例外・エラー:
  - EH-013: 自動判定ができない場合、システムはReferenceフィールドにINVOICEをデフォルト設定し、スタッフがドロップダウン（INVOICE, DEBIT NOTE）から変更できるようにしなければならない。
- 補足:
  - 関連: REQ-003
  - トレーサビリティ: SH-001, SH-002

### REQ-010: Address自動補完
- 種別: EARS-イベント駆動
- 優先度: MUST
- 要件文(EARS): ContactNameが選択されたとき、システムはXero Contacts APIまたはローカルキャッシュからそのContactNameに紐づくSAAddressLine1（物件住所）を取得し、プレビュー画面に表示しなければならない。
- 根拠/目的: Address Line 1をContactNameから自動取得する（SH-001のニーズ）
- 受入テスト(GWT):
  - AT-010: Given ContactNameに「Suasana Iskandar 17-07 Nur Nadzira Binti MD Sap」が選択された When プレビュー画面に遷移する Then SAAddressLine1に「17-07 Suasana Iskandar 82C, JALAN TRUS, 80000 JOHOR BAHRU, JOHOR」が表示される
- 例外・エラー:
  - EH-014: ContactNameに紐づくアドレスが存在しない場合、システムはアドレスフィールドを空のまま表示しなければならない。
- 補足:
  - 関連: REQ-004
  - トレーサビリティ: SH-001

### REQ-011: インボイスプレビュー画面
- 種別: EARS-普遍
- 優先度: MUST
- 要件文(EARS): システムは自動補完された全フィールド（ContactName、EmailAddress、SAAddressLine1、InvoiceDate、DueDate、Reference、Description、Quantity、UnitAmount、LineAmount、AccountCode、TaxType、TrackingOption1、TrackingOption2、Currency）を1画面で表示し、全フィールドを編集可能な状態でプレビューしなければならない。
- 根拠/目的: Xero送信前に全項目を確認・修正する（SH-001のニーズ）
- 受入テスト(GWT):
  - AT-011: Given 5項目を入力し自動補完が完了した When プレビュー画面が表示される Then 上記15フィールドがすべて表示され、各フィールドをクリックして編集できる
- 例外・エラー:
  - EH-015: 自動補完が不完全（ContactNameが空など）のフィールドがある場合、システムは該当フィールドを赤色のボーダーでハイライトし、「この項目を確認してください」と表示しなければならない。
- 補足:
  - 関連: REQ-003〜REQ-010
  - トレーサビリティ: SH-001

### REQ-012: DueDate自動計算
- 種別: EARS-イベント駆動
- 優先度: MUST
- 要件文(EARS): スタッフがDateを入力したとき、システムはXeroのContactに設定された支払条件を参照し、DueDateを自動計算してプレビュー画面に表示しなければならない。
- 根拠/目的: DueDateの手動計算を不要にする（SH-001のニーズ）
- 受入テスト(GWT):
  - AT-012: Given Dateに「03/02/2026」が入力され、Contactの支払条件が7日後である When プレビュー画面が表示される Then DueDateに「10/02/2026」が表示される
- 例外・エラー:
  - EH-016: Contactに支払条件が設定されていない場合、システムはDateと同日をDueDateに設定しなければならない。
- 補足:
  - 関連: REQ-003, REQ-004
  - トレーサビリティ: SH-001

### REQ-013: Xero DRAFTインボイス作成
- 種別: EARS-イベント駆動
- 優先度: MUST
- 要件文(EARS): スタッフがプレビュー画面で「Xeroへ送信」ボタンを押下したとき、システムはXero Invoices API（POST /api.xro/2.0/Invoices）にStatus=DRAFTでインボイスを作成し、Xeroからのレスポンスに含まれるInvoiceIDとInvoiceNumberを画面に表示しなければならない。
- 根拠/目的: DRAFTステータスで作成し、会計担当者がXero上で最終確認できるようにする（SH-001, SH-002のニーズ）
- 受入テスト(GWT):
  - AT-013: Given プレビュー画面で全フィールドが入力されている When 「Xeroへ送信」ボタンを押下する Then Xeroにインボイスが作成され、画面に「インボイス JJB26-XXXX を作成しました」というメッセージとXero管理画面へのリンクが表示される
- 例外・エラー:
  - EH-017: Xero APIがHTTP 400（バリデーションエラー）を返した場合、システムはXeroからのエラーメッセージを画面に表示し、該当フィールドをハイライトしなければならない。
  - EH-018: Xero APIがHTTP 429（レート制限）を返した場合、システムは指数バックオフ（1秒→2秒→4秒→8秒→16秒、最大5回）でリトライし、全リトライが失敗した場合は「Xeroのレート制限に達しました。2分後に再試行してください。」というメッセージを表示しなければならない。
  - EH-019: Xero APIがHTTP 401（認証エラー）を返した場合、システムはトークンの自動更新を試行し、更新に失敗した場合はログイン画面にリダイレクトしなければならない。
- 補足:
  - 関連: REQ-001, REQ-002, REQ-011
  - InvoiceNumberはXeroが自動採番する。システム側では指定しない
  - トレーサビリティ: SH-001, SH-002

### REQ-014: インボイス作成ログ保存
- 種別: EARS-イベント駆動
- 優先度: MUST
- 要件文(EARS): Xeroへのインボイス作成が成功したとき、システムはInvoiceID、InvoiceNumber、ContactName、Total、作成日時、作成者をSQLiteのcreated_invoicesテーブルに保存しなければならない。
- 根拠/目的: 監査証跡としてローカルにログを保持する（SH-002, SH-003のニーズ）
- 受入テスト(GWT):
  - AT-014: Given プレビュー画面で「Xeroへ送信」ボタンを押下しXeroから成功レスポンスを受信した When created_invoicesテーブルを確認する Then InvoiceID、InvoiceNumber、ContactName、Total、作成日時が記録されている
- 例外・エラー:
  - EH-020: SQLiteへの書き込みが失敗した場合、システムはコンソールログにエラーを出力するが、Xeroへのインボイス作成自体は成功として扱わなければならない（Xero側のデータが正）。
- 補足:
  - 関連: REQ-013
  - トレーサビリティ: SH-002, SH-003

### REQ-015: キャッシュ同期
- 種別: EARS-イベント駆動
- 優先度: SHOULD
- 要件文(EARS): スタッフが「データ同期」ボタンを押下したとき、システムはXero Contacts API、Accounts API、TrackingCategories APIから最新データを取得し、ローカルキャッシュ（SQLite + インメモリ）を更新しなければならない。
- 根拠/目的: Xero側でContactやAccountCodeが追加された場合に同期する（SH-003のニーズ）
- 受入テスト(GWT):
  - AT-015: Given Xeroに新しいContactが追加された When 「データ同期」ボタンを押下する Then 同期完了後に新しいContactがContactName候補に表示される
- 例外・エラー:
  - EH-021: 同期中にXero APIがエラーを返した場合、システムは「同期に失敗しました。ローカルデータで続行します。」というメッセージを表示し、既存キャッシュを保持しなければならない。
- 補足:
  - 関連: REQ-004, REQ-005, REQ-007, REQ-008
  - トレーサビリティ: SH-003

### REQ-016: 固定値自動設定
- 種別: EARS-普遍
- 優先度: MUST
- 要件文(EARS): システムはインボイス作成時にTaxTypeを「Tax Exempt」、Currencyを「MYR」、Quantityを「1.0000」、Typeを「Sales invoice」に固定設定しなければならない。
- 根拠/目的: 過去18,860件のデータで確認済みの固定値（SH-002のニーズ）
- 受入テスト(GWT):
  - AT-016: Given プレビュー画面が表示された When TaxType、Currency、Quantity、Typeを確認する Then それぞれ「Tax Exempt」「MYR」「1.0000」「Sales invoice」が設定されている
- 例外・エラー:
  - EH-022: Xeroの組織設定が変更されTax Exemptが利用不可になった場合、システムはXero APIからのエラーメッセージを表示しなければならない。
- 補足:
  - 関連: REQ-013
  - トレーサビリティ: SH-002

## 10. 非機能要件（Non-Functional Requirements）

### REQ-901: 応答時間
- 種別: EARS-普遍
- 優先度: MUST
- 要件文(EARS): システムは自動補完処理（Project + Unit No入力からContactName候補表示まで）を500ミリ秒以内に完了しなければならない。
- 根拠/目的: スタッフの入力フロー中断を防止する
- 受入テスト(GWT):
  - AT-901: Given 18,860件の履歴データがロード済みである When ProjectとUnit Noを入力する Then 500ミリ秒以内にContactName候補が表示される（ブラウザDevToolsのNetwork/Performanceタブで計測）
- 例外・エラー:
  - EH-901: 自動補完が500ミリ秒を超えた場合、システムはローディングインジケーターを表示しなければならない。
- 補足:
  - Fuse.jsによるインメモリ検索で達成する設計
  - トレーサビリティ: SH-001

### REQ-902: データ暗号化
- 種別: EARS-普遍
- 優先度: MUST
- 要件文(EARS): システムはXero OAuthトークン（access_token、refresh_token）をAES-256-GCM方式で暗号化し、暗号化された状態でのみSQLiteに保存しなければならない。
- 根拠/目的: トークンの平文保存を防止する
- 受入テスト(GWT):
  - AT-902: Given Xero認証が成功した When SQLiteのxero_tokensテーブルのaccess_tokenカラムを直接参照する Then Base64エンコードされた暗号文が保存されており、平文のJWTトークンが含まれていない
- 例外・エラー:
  - EH-902: 環境変数ENCRYPTION_KEYが未設定の場合、システムは起動時にエラーをログに出力し、認証フローを無効化しなければならない。
- 補足:
  - 暗号化キーは環境変数ENCRYPTION_KEYから取得する。.env.localファイルに保存し、.gitignoreに含める
  - トレーサビリティ: SH-003

### REQ-903: APIレート制限対応
- 種別: EARS-普遍
- 優先度: MUST
- 要件文(EARS): システムはXero APIへのリクエストを50リクエスト/分以下に制限し、日次上限4,500リクエスト/日（5,000の90%）を超えた場合はAPIリクエストを停止しなければならない。
- 根拠/目的: Xero APIレート制限（60回/分、5,000回/日）への余裕を持った対応
- 受入テスト(GWT):
  - AT-903: Given 直近1分間に49件のAPIリクエストが送信された When 51件目のリクエストが発生する Then リクエストは次の1分境界までキューに入れられ、即座には送信されない
- 例外・エラー:
  - EH-903: 日次上限4,500件に達した場合、システムは「本日のXero API使用上限に達しました。明日再試行してください。」というメッセージを表示しなければならない。
- 補足:
  - p-queueライブラリで制御する設計
  - トレーサビリティ: SH-003

### REQ-904: 認証情報保護
- 種別: EARS-普遍
- 優先度: MUST
- 要件文(EARS): システムはXero Client ID、Client Secret、ENCRYPTION_KEY、NEXTAUTH_SECRETを環境変数（.env.local）からのみ読み取り、ソースコード、ログ出力、クライアントサイドJavaScript、Gitリポジトリに含まない形で管理しなければならない。
- 根拠/目的: 認証情報の漏洩を防止する
- 受入テスト(GWT):
  - AT-904: Given プロジェクトのソースコードを確認する When Grepで「XERO_CLIENT_SECRET」「ENCRYPTION_KEY」を検索する Then .env.localおよび.env.example（値なし）以外のファイルにヒットしない
- 例外・エラー:
  - EH-904: 必須環境変数（XERO_CLIENT_ID, XERO_CLIENT_SECRET, ENCRYPTION_KEY, NEXTAUTH_SECRET）のいずれかが未設定の場合、システムは起動時に「必須環境変数 {変数名} が未設定です」というエラーを出力し、起動を中止しなければならない。
- 補足:
  - .gitignoreに.env*を含める
  - トレーサビリティ: SH-003

## 11. セキュリティ/プライバシー要件
- REQ-902（トークン暗号化）およびREQ-904（認証情報保護）で要件化済み
- OAuth2 PKCE対応（Auth.js v5のデフォルト設定）
- localhost:3000のみで運用するため、外部からのアクセスは発生しない

## 12. ログ/監視/運用要件
- REQ-014（インボイス作成ログ）で要件化済み
- トークン有効期限の監視: REQ-002で対応
- Xero APIエラーのログ: REQ-013のEH-017〜EH-019で対応

## 13. 未解決事項（Open Questions）
- なし

## 14. SLO/SLI/SLA（信頼性目標）

| Metric | Target | Measurement |
|--------|--------|-------------|
| 可用性（営業時間内 9:00-18:00 MYT） | 99%以上（月間） | ダウンタイム記録（手動） |
| 自動補完応答時間（P95） | 500ms以内 | ブラウザPerformance API |
| Xero API成功率 | 99%以上 | created_invoicesテーブルの成功/失敗比率 |

## 15. 関連ADR（技術決定記録）

| ADR ID | 決定内容 | Status |
|--------|---------|--------|
| ADR-001 | xero-node SDK v14.0.0をNext.js API Routes/Server Actionsでのみ使用する（直接REST APIではなくSDK） | Accepted |
| ADR-002 | Auth.js v5にカスタムXero OIDCプロバイダーを定義する（ビルトインプロバイダーなし） | Accepted |
| ADR-003 | Drizzle ORM + better-sqlite3を使用する（Prisma + PostgreSQLではなく軽量構成） | Accepted |
| ADR-004 | インボイスはDRAFTステータスで作成する（AUTHORISEDではなく） | Accepted |
| ADR-005 | InvoiceNumberはXeroの自動採番に委ねる（システム側では指定しない） | Accepted |

## 16. セキュリティ脅威と対策

| 脅威 | リスク | 緩和策 | 対応要件 |
|------|--------|--------|---------|
| OAuthトークンの平文保存 | H | AES-256-GCM暗号化 | REQ-902 |
| 認証情報のソースコード混入 | H | 環境変数+.gitignore | REQ-904 |
| 不正なインボイス作成 | M | DRAFTステータス+プレビュー確認 | REQ-011, REQ-013 |
| XSSによるトークン窃取 | L | localhost運用+Next.js CSP | REQ-904 |

## 17. ガードレール（AI制約）
- 許可パス: `src/`, `tests/`, `.kiro/`, `data/`, `research/`
- 禁止パス: `.env*`, `secrets/`, `~/.ssh/`
- 必須承認: Xero APIへのインボイス送信、トークンの削除、DBスキーマ変更

## 18. 運用手順書参照
- オンコール連絡先: システム管理者（SH-003）
- インシデント対応: Xero再認証（REQ-001）、トークン失効時（REQ-002 EH-003）
- ロールバック手順: DRAFTインボイスはXero管理画面から削除可能

## 19. 成熟度レベル

| Level | 名称 | 達成条件 | 現在 |
|-------|------|---------|------|
| L1 | Draft | requirements.md作成 | ✅ |
| L2 | Review Ready | C.U.T.E. >= 90 | ✅ (100/100) |
| L3 | Implementation Ready | C.U.T.E. >= 98, SDD全7アーティファクト完成, CC整合性チェック完了 | ✅ |
| L4 | Production Ready | 実装完了, テスト完了, セキュリティレビュー | - |
| L5 | Enterprise Ready | SLO達成, 監視設定, Runbook完備 | - |

## Non-Goals（本バージョンでは実装しない）

| # | やらないこと | 除外理由 | 将来バージョンでの検討 |
|---|------------|---------|-------------------|
| NG-001 | 複数行一括入力（Excelペースト） | Phase 1はMVPとして単票入力に集中。一括入力はUIとバッチ処理の複雑性が増す | Phase 2 |
| NG-002 | PDF/画像からのOCR自動読み取り | OCR精度の不確実性が高く、Phase 1の安定稼働を優先する | Phase 3 |
| NG-003 | クレジットノート作成 | 現在のワークフローで必要とされていない。インボイスとデビットノートのみが対象 | 未定 |
| NG-004 | 多通貨対応 | 過去18,860件全てMYR。多通貨の業務要件が存在しない | 対象外 |
| NG-005 | モバイル専用UI | 事務所内のPC操作が主用途。モバイル対応の業務要件が存在しない | 未定 |
| NG-006 | Xero以外の会計ソフト連携 | 現在Xeroのみを使用。他ソフトの導入予定なし | 対象外 |
| NG-007 | インボイスのAUTHORISED自動化 | DRAFTで作成し会計担当者が確認後に送信する運用フローを維持する | 未定 |
