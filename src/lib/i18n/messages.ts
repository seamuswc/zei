export type Locale = "ja" | "en";

export const messages = {
  ja: {
    brand: "ZEI",
    nav_import: "取込",
    nav_income: "所得",
    nav_results: "税額年度",
    nav_years: "複数年",
    nav_review: "確認",
    nav_export: "出力",
    lang_ja: "日本語",
    lang_en: "English",
    lang_toggle: "Language",

    wip_banner: "現在準備中です — まだ本番公開前です。見つけた方へ：もう少しお待ちください。",
    freemium_banner:
      "暗号資産のみ。無料は取込・確認・それより前の年の税額。Proで今年と昨年（{lastYear}年・{thisYear}年）の合計・出力を解除 — 申告・期限後の対応で使う年です。",
    freemium_cta_login: "ログインしてProへ",
    freemium_cta_pay: "USDCでProを解除",
    freemium_locked_kicker: "今年・昨年 · Pro",
    freemium_locked_title: "{lastYear}年・{thisYear}年はProで解除",
    freemium_locked_body:
      "無料プランでは取込・台帳確認・それより前の年の計算は自由です。今年と昨年（{lastYear}年・{thisYear}年）の雑所得合計と税理士向けZIPだけがProです。",
    freemium_export_locked:
      "{lastYear}年・{thisYear}年（今年・昨年）の税理士向けZIPはProで解除されます。それより前の年は無料で出力できます。",
    freemium_table_locked: "今年・昨年の明細はProで表示されます。",
    freemium_cell_locked: "Pro",
    freemium_year_option: "{year} · Pro",
    tax_rules: "税制の説明",
    import_kicker: "日本居住者向け · 暗号資産税",
    import_title: "CSV・ウォレット・取引所",
    import_sub:
      "取込から計算まで。価格の優先順：取引所約定 → オンチェーン／公開価格 → CoinGecko → 確認画面で手動。ラップは非課税です。",
    import_export_link: "結果・税理士向け出力は下へ →",

    csv_kicker: "01 · スプレッドシート",
    csv_title: "CSV / Excelをアップロード",
    csv_desc:
      "取引所のエクスポートや手記帳に対応。APIキーが使えないときはこちら。buy/sell、transfer、income、fee、wrap、bridge、borrow/repay（借入・返済・非所得）、trade をサポート。",
    csv_drop: "CSVをドロップ",
    csv_drop_sub: "またはクリックして選択 · .csv / .txt",
    csv_sample: "サンプルCSVを読込",
    csv_template: "テンプレートをダウンロード",
    csv_imported: "{n}行を取り込みました（{label}）",
    csv_none: "有効な行がありません。",

    wallet_kicker: "02 · オンチェーン · ライブ",
    wallet_title: "ウォレット接続",
    wallet_desc:
      "ETH / EVMアドレスまたはENS名（ネイティブ＋主要ERC-20）をライブ取得し、円換算します。",
    wallet_address: "ETH / EVMアドレス / ENS",
    wallet_sync: "接続して同期",
    wallet_syncing: "同期中…",
    wallet_resolving: "ENSを解決しています…",
    wallet_sync_wait:
      "同期中です。完了するまでお待ちください（別のアドレスは今は追加できません）。",
    wallet_hint:
      "0xアドレスまたはENS名（例: vitalik.eth）を貼り付けてください。ENSはサーバー側で解決します。APIキーは不要です。1件終わってから次を追加できます。DeFiは自動ラベル付け（スワップ・ラップ・自己送金など）します。Reviewで確認・修正してください。",
    wallet_linked: "接続済み: {address}",
    wallet_linked_ens: "接続済み: {ens} → {address}",
    wallet_resolved: "解決済み: {ens} → {address}",
    wallet_ens_invalid:
      "ENS名が無効です。英数字とハイフンの name.eth 形式で入力してください。",
    wallet_sync_ok:
      "同期完了 · {chain} · {n}件（税額計算に反映）。DeFiは可能な範囲で自動分類済み — Reviewで確認してください。",
    unlink: "解除",

    exchange_kicker: "03 · 取引所 · 読み取り専用API",
    exchange_title: "取引所を連携（かんたん）",
    exchange_desc:
      "Excel/CSVでもOK。かんたんにするなら読み取り専用APIキー（日本・海外）。出金・注文権限は絶対に付けないでください。キーは保存しません（この同期だけ使用）。",
    exchange_readonly_title: "必ず読み取り専用キーを使う",
    exchange_readonly_body:
      "APIキー発行時は「照会／履歴／残高」のみON。「注文・取引・出金・送付」はすべてOFF。ZEIは秘密鍵をサーバーに保存しません。",
    exchange_label: "取引所",
    exchange_key: "APIキー（読み取り専用）",
    exchange_secret: "APIシークレット",
    exchange_passphrase: "APIパスフレーズ（OKX / KuCoin）",
    exchange_connect: "読み取り同期",
    exchange_syncing: "同期中…",
    exchange_linked: "連携済み",
    exchange_docs: "権限のヘルプ",
    exchange_csv_alt: "年間フル履歴は左のCSVアップロードも使えます。",
    exchange_synced: "{name} · {n}件を取り込みました",
    exchange_perm_bitflyer:
      "bitFlyer: 「資産・取引履歴の参照」のみ。注文・出金はOFF。",
    exchange_perm_coincheck:
      "Coincheck: 「取引情報の参照／残高」のみ。注文・出金はOFF。",
    exchange_perm_gmo:
      "GMOコイン: 「取引履歴・資産」の参照のみ。注文・出金はOFF。",
    exchange_perm_bitbank: "bitbank: 「照会」のみ。注文・出金はOFF。",
    exchange_perm_binance:
      "Binance Japan: Enable Reading のみ。Trading・Withdrawals はOFF。",
    exchange_perm_zaif: "Zaif: 情報取得のみ。注文・出金権限は付けない。",
    exchange_perm_binance_global:
      "Binance（海外）: Enable Reading のみ。Trading・Withdrawals はOFF。USDT建て約定を円換算します。",
    exchange_perm_bybit:
      "Bybit: Read-Only。Trade / Withdraw はOFF。スポット約定を円換算します。",
    exchange_perm_okx:
      "OKX: Read のみ + パスフレーズ。Trade / Withdraw はOFF。",
    exchange_perm_kraken:
      "Kraken: Query / Query Funds のみ。Orders / Withdraw は付けない。",
    exchange_perm_kucoin:
      "KuCoin: General / Spot の読み取りのみ + パスフレーズ。Trade / Transfer はOFF。",
    exchange_hist_gmo:
      "注意: GMOのAPIは直近の約定が中心です。年間フル履歴はCSVも併用してください。",
    exchange_hist_overseas:
      "注意: 海外取引所はUSDT等をCoinGeckoで円換算します。年間フル履歴はCSV併用を推奨。",

    income_kicker: "暗号資産のみ",
    income_title: "任意：他の所得（税率の目安用）",
    income_sub:
      "ZEIは暗号資産の雑所得のみ計算します。累進税率の目安が必要なときだけ、他の課税所得を手入力してください。最終税額ではありません。",
    income_label: "他の課税所得（任意・円）",
    income_ph: "例: 5000000",
    income_warn:
      "参考値です。確定申告では税理士／ご本人が全所得を合算します。今年の暗号資産所得: {gain}",
    income_sketch: " 暗号資産分の税額目安: {tax}。",

    results_empty_kicker: "暗号資産の税額年度",
    results_empty_title: "ここに雑所得が表示されます",
    results_empty_sub:
      "スプレッドシート・ウォレット・取引所を取り込むと、移動平均法で計算します。",
    results_kicker: "暗号資産のみ · 移動平均法",
    results_title: "{year}年 暗号資産の雑所得",
    results_year: "年度",
    results_export: "税理士向けに出力",
    results_clear: "すべてクリア",
    results_active: "有効な取引",
    results_matched: "振替マッチ",
    results_income: "報酬・受取",
    results_losses: "損失",
    results_gains: "プラス所得",
    results_net: "雑所得（ネット）",
    results_after_carry: "繰越後",
    results_export_banner:
      "税理士提出用パック: 「税理士向けに出力」でZIPをダウンロード（README・売却明細・期末残高・全取引台帳）。",
    results_impact_kicker: "暗号資産所得（最終税額ではない）",
    results_impact_p:
      "売却・受取・手数料後のネットです。他所得との合算はZEIの範囲外です。",
    results_impact_sketch:
      "他の課税所得が {other} の場合の目安: 暗号資産分 約 {tax}（参考）。",
    results_impact_optional:
      "他所得欄は任意です。税率のスケッチ用で確定ではありません。",
    results_zip_p:
      "税理士向けZIP: 売却明細、期末残高、価格根拠付き台帳、振替マッチ、日本語README。",
    results_download: "税理士パックをダウンロード",
    results_disposals: "{year}年の譲渡・所得",
    results_no_disposals: "この年の課税イベントはまだありません。",
    results_lots: "期末残高（移動平均）",
    results_no_lots: "残高なし",
    th_date: "日付",
    th_kind: "区分",
    th_asset: "資産",
    th_qty: "数量",
    th_proceeds: "売却価額",
    th_cost: "取得価額",
    th_gain: "所得金額",
    th_price_src: "円換算根拠",
    th_avg: "平均取得単価",
    th_book: "簿価",

    years_kicker: "複数年 · アカウント",
    years_title: "暗号資産の損失繰越（参考）",
    years_sub:
      "現行の雑所得は原則繰越不可です。2028年頃の改正では、国内取引所の対象資産に3年繰越が入る見込みです。税理士に確認してください。「税制の説明」で詳細を表示。",
    years_th_year: "年",
    years_th_net: "ネット",
    years_th_in: "繰越入",
    years_th_after: "繰越後",
    years_th_out: "繰越出",

    review_kicker: "確認 · すべて編集可",
    review_title: "価格・数量・取得価額を修正",
    review_sub:
      "どの欄も変更できます（DeFiの受取・借入・返済の区分も含む）。利息・ステーキング等は「受取」、借入は「借入」、返済は「返済」（所得・売却ではない）。「円」は価額／売却額。「取得価額上書き」は任意です。",
    th_side: "区分",
    th_jpy: "円（価格）",
    th_fee: "手数料円",
    th_cost_override: "取得価額上書き",
    th_actions: "操作",
    review_exclude: "除外",
    review_include: "含める",
    review_delete: "削除",
    review_auto: "自動",
    review_matched: "マッチ済",
    ledger_showing: "{from}–{to} / 全{total}件",
    ledger_page_size: "表示件数",
    ledger_page_all: "すべて",
    ledger_prev: "前へ",
    ledger_next: "次へ",
    ledger_page: "{page} / {pages}",

    footer:
      "ZEI · 暗号資産の雑所得のみ。確定申告の代わりではありません。税理士向けZIPは「税額年度」→「税理士向けに出力」から。税務・法務・会計の助言ではありません。",

    auth_login: "ログイン",
    auth_register: "アカウント作成",
    auth_email: "メール",
    auth_password: "パスワード（8文字以上）",
    auth_forgot: "パスワードを忘れた",
    auth_resend: "確認メールを再送",
    auth_back: "ログインに戻る",
    auth_send_reset: "リセットリンクを送信",
    auth_creating: "…",
    auth_register_hint:
      "作成後、確認メールを送信します。受信箱（迷惑メールも）のリンクを開いてからログインしてください。",
    auth_verified: "確認済み",
    auth_unverified: "未確認",
    auth_pricing:
      "無料：取込・確認・それより前の年の計算＋クラウド自動保存。Pro：今年と昨年（{lastYear}年・{thisYear}年）の合計・税理士ZIPを解除。",
    auth_plan_free: "Free（{lastYear}・{thisYear}年ロック）",
    auth_plan_pro: "Pro",
    auth_pay: "USDCでPro（今年・昨年を解除）",
    auth_autosave_hint:
      "メール確認済みのアカウントでは、取込・編集・クリアがクラウドに自動保存されます。",
    pay_title: "USDCでProを購入",
    pay_close: "閉じる",
    pay_lead:
      "今年と昨年の税額合計と税理士ZIPを解除します。ブラウザのウォレットを接続し、表示のUSDCを送金してください。",
    pay_steps_title: "流れ",
    pay_step1: "ウォレットを接続する",
    pay_step2: "ウォレットでUSDC送金を承認する",
    pay_step3: "接続中のアドレスからの送金を確認したらProを解除します",
    pay_price: "料金",
    pay_wallet: "ウォレット",
    pay_connect: "ウォレットを接続",
    pay_connected: "接続中 {addr}",
    pay_disconnect: "切断",
    pay_no_wallet:
      "ブラウザウォレットが見つかりません。MetaMaskなどの拡張機能を入れるか、ウォレット付きデスクトップブラウザで開いてください。",
    pay_mobile_hint:
      "モバイルは注入型ウォレット（WalletConnectなし）のため制限があります。デスクトップのブラウザウォレットを推奨します。",
    pay_select_chain: "ネットワーク",
    pay_send: "{amount} USDCを送る",
    pay_sending: "ウォレットで確認中…",
    pay_confirming: "チェーン上の確認を待っています…",
    pay_tx_submitted: "送信済み {tx} — 確認を待っています",
    pay_chains: "対応チェーン",
    pay_check: "支払いを確認",
    pay_checking: "チェーンを確認中…",
    pay_waiting:
      "まだ検出されていません。ウォレット送金のあと約1分待って再確認してください。",
    pay_confirmed: "支払い確認: {chain} · {tx}",
    pay_dev_confirm: "開発用：支払い済みにする",
    pay_user_rejected: "ウォレットでキャンセルされました。",
    pay_bind_failed: "ウォレットの紐づけに失敗しました。",
    auth_logout: "ログアウト",
    auth_dev_link: "開発用確認リンク:",
    auth_click_verify: "クリックして確認",
    auth_logged_in: "ログインしました。",
    auth_created:
      "アカウントを作成しました。確認メールを送信済みです — 受信箱（と迷惑メール）を開き、リンクをクリックしてからログインしてください。届かない場合は「確認メールを再送」を押してください。",
    auth_verify_ok: "メール確認完了 — ログインできます。",
    auth_verify_bad: "確認リンクが無効または期限切れです。",

    rules_title: "現行ルールと2028年改正",
    rules_close: "閉じる",
    rules_now: "いま（〜2028年頃まで）",
    rules_now_1:
      "個人：暗号資産は雑所得。所得税・住民税合わせて最大約55%の累進課税。",
    rules_now_2: "損失：原則、損益通算・繰越控除不可。",
    rules_now_3: "暗号資産同士の交換：課税対象。",
    rules_now_4: "含み益：個人は未実現なら非課税。",
    rules_now_5:
      "価格：国税庁の公式レート表なし。ZEIは取引所→オンチェーン／公開→CoinGecko→手動。",
    rules_next: "2028年1月頃〜（2026年度改正）",
    rules_next_note:
      "重要：すべての暗号資産が約20%になるわけではありません。一律約20.315%は、国内認可取引所で扱う「対象（適格）暗号資産」のみ。対象外はこれまでどおり累進課税（最大約55%）です。",
    rules_next_1:
      "適格資産のみ：国内認可取引所の対象銘柄 → 分離課税の一律約20.315%。",
    rules_next_2: "損失繰越：対象（適格）資産のみ3年（見込み）。",
    rules_next_3:
      "対象外の例：OTC・自己管理ウォレット・海外所・DEX・ステーキング・レンディング・エアドロ・NFT → 引き続き累進（最大約55%）。",
    rules_notax: "非課税（支配権が変わらない）",
    rules_pill_wrap: "ラップ（ETH→WETH）",
    rules_pill_bridge: "ブリッジ",
    rules_pill_transfer: "ウォレット間送金",
    rules_notax_p:
      "ZEIはラップ・ブリッジ・マッチした振替を非課税とし、取得単価を引き継ぎます。",
    rules_zei: "ZEIがいま行うこと",
    rules_zei_1: "✅ 暗号資産のみの雑所得（移動平均法）",
    rules_zei_2: "✅ ラップ／ブリッジ／振替は非課税",
    rules_zei_3: "✅ 暗号資産同士の交換は課税",
    rules_zei_4: "✅ 価格ウォーターフォール＋手動編集",
    rules_zei_5: "✅ 税理士向けZIP出力",
    rules_zei_6:
      "⚠️ 複数年の繰越表は参考／2028年準備用 — 現行申告の助言ではありません",
    rules_zei_7: "⏳ 国内取引所の一律20.315%モードは今後対応",
    rules_disclaimer:
      "税務・法務・会計の助言ではありません。申告前に税理士へ確認してください。",

    reset_title: "パスワード再設定",
    reset_sub: "新しいパスワード（8文字以上）を入力してください。",
    reset_update: "パスワードを更新",
    reset_back: "ZEIに戻る",
    loading: "読み込み中…",

    side_buy: "買付",
    side_sell: "売却",
    side_transfer_in: "振替入",
    side_transfer_out: "振替出",
    side_income: "受取",
    side_fee: "手数料",
    side_wrap: "ラップ",
    side_bridge: "ブリッジ",
    side_borrow: "借入",
    side_repay: "返済",
    kind_sell: "売却",
    kind_income: "受取",
    kind_fee: "手数料",

    live: "ライブ",
    region_japan: "日本",
    region_overseas: "海外",
  },
  en: {
    brand: "ZEI",
    nav_import: "Import",
    nav_income: "Income",
    nav_results: "Tax year",
    nav_years: "Years",
    nav_review: "Review",
    nav_export: "Export",
    lang_ja: "日本語",
    lang_en: "English",
    lang_toggle: "Language",

    wip_banner:
      "Still under construction — not launched yet. If you found this early: hang tight.",
    freemium_banner:
      "Crypto only. Free: import, review, and older years. Pro unlocks this calendar year and last year ({lastYear} and {thisYear}) — the ones that matter for filing / late filing.",
    freemium_cta_login: "Log in for Pro",
    freemium_cta_pay: "Unlock Pro with USDC",
    freemium_locked_kicker: "This year & last · Pro",
    freemium_locked_title: "{lastYear} and {thisYear} unlock with Pro",
    freemium_locked_body:
      "Free lets you import, edit the ledger, and run older years. Only this year and last year ({lastYear} and {thisYear}) totals and accountant ZIP need Pro.",
    freemium_export_locked:
      "Accountant ZIP for {lastYear} and {thisYear} (this year and last) is Pro. Older years export for free.",
    freemium_table_locked: "This-year and last-year detail is shown with Pro.",
    freemium_cell_locked: "Pro",
    freemium_year_option: "{year} · Pro",
    tax_rules: "Tax rules",
    import_kicker: "Crypto tax · Japan residents",
    import_title: "CSV, live wallet, live exchange",
    import_sub:
      "Import to calculate. Price order: exchange fill → on-chain/public quote → CoinGecko → manual in Review. Wraps are not taxed.",
    import_export_link: "Results & accountant export below →",

    csv_kicker: "01 · Spreadsheet",
    csv_title: "Upload CSV / Excel export",
    csv_desc:
      "Exchange exports or manual books. Use this if you prefer not to use an API key. Supports buy/sell, transfer, income, fee, wrap, bridge, borrow/repay (loans — not income), trade.",
    csv_drop: "Drop CSV here",
    csv_drop_sub: "or click to browse · .csv / .txt",
    csv_sample: "Load sample CSV",
    csv_template: "Download template",
    csv_imported: "Imported {n} row(s) from {label}.",
    csv_none: "No valid rows found.",

    wallet_kicker: "02 · On-chain · live",
    wallet_title: "Connect wallet",
    wallet_desc:
      "Live read: ETH / EVM address or ENS (native + major ERC-20) — priced to JPY.",
    wallet_address: "ETH / EVM address / ENS",
    wallet_sync: "Connect & sync",
    wallet_syncing: "Syncing…",
    wallet_resolving: "Resolving ENS…",
    wallet_sync_wait:
      "Sync in progress — please wait. You can’t add another address until this finishes.",
    wallet_hint:
      "Paste a 0x address or ENS name (e.g. vitalik.eth). ENS is resolved on the server — no API key needed. Add another after this sync completes. DeFi is auto-labeled when possible (swaps, wraps, self-transfers); check Review.",
    wallet_linked: "Linked: {address}",
    wallet_linked_ens: "Linked: {ens} → {address}",
    wallet_resolved: "Resolved: {ens} → {address}",
    wallet_ens_invalid:
      "Invalid ENS name. Use a basic name.eth (letters, numbers, hyphens).",
    wallet_sync_ok:
      "Synced · {chain} · {n} rows (added to tax calc). DeFi auto-labeled when possible — check Review.",
    unlink: "Unlink",

    exchange_kicker: "03 · Exchange · read-only API",
    exchange_title: "Link exchange (easiest)",
    exchange_desc:
      "CSV/Excel works too. Easier: paste a read-only API key (Japan or overseas). Never enable trade or withdraw. Keys are not stored — used only for this sync.",
    exchange_readonly_title: "Read-only API keys only",
    exchange_readonly_body:
      "When creating a key, enable view/history/balance only. Turn OFF order, trade, withdraw, and send. ZEI never stores your secret.",
    exchange_label: "Exchange",
    exchange_key: "API key (read-only)",
    exchange_secret: "API secret",
    exchange_passphrase: "API passphrase (OKX / KuCoin)",
    exchange_connect: "Sync read-only",
    exchange_syncing: "Syncing…",
    exchange_linked: "Linked",
    exchange_docs: "Permission help",
    exchange_csv_alt: "For full-year history you can also upload CSV (left panel).",
    exchange_synced: "{name} · imported {n} rows",
    exchange_perm_bitflyer:
      "bitFlyer: enable asset/trade history read only. No order or withdraw.",
    exchange_perm_coincheck:
      "Coincheck: enable transaction/balance read only. No order or withdraw.",
    exchange_perm_gmo:
      "GMO Coin: enable trade-history/assets read only. No order or withdraw.",
    exchange_perm_bitbank:
      "bitbank: enable 照会 (read) only. No order or withdraw.",
    exchange_perm_binance:
      "Binance Japan: Enable Reading only. Disable Trading and Withdrawals.",
    exchange_perm_zaif:
      "Zaif: info/history only. Do not enable order or withdraw.",
    exchange_perm_binance_global:
      "Binance (global): Enable Reading only. No Trading or Withdrawals. USDT fills are converted to JPY.",
    exchange_perm_bybit:
      "Bybit: Read-Only. No Trade or Withdraw. Spot fills converted to JPY.",
    exchange_perm_okx:
      "OKX: Read only + passphrase. No Trade or Withdraw.",
    exchange_perm_kraken:
      "Kraken: Query / Query Funds only. No Orders or Withdraw.",
    exchange_perm_kucoin:
      "KuCoin: General/Spot read only + passphrase. No Trade or Transfer.",
    exchange_hist_gmo:
      "Note: GMO’s API mainly covers recent fills. Use CSV for a full tax year.",
    exchange_hist_overseas:
      "Note: Overseas venues convert USDT (etc.) to JPY via CoinGecko. Prefer CSV for a full tax year.",

    income_kicker: "Crypto only",
    income_title: "Optional: other income for a rough rate check",
    income_sub:
      "ZEI calculates crypto 雑所得 only. Enter other taxable income manually if you want a bracket sketch — not a final tax rate.",
    income_label: "Other taxable income (optional, JPY)",
    income_ph: "e.g. 5000000",
    income_warn:
      "Illustrative only. Your accountant / 確定申告 combines all income. Crypto gain this year: {gain}",
    income_sketch: " Rough crypto tax sketch: {tax}.",

    results_empty_kicker: "Crypto tax year",
    results_empty_title: "Your crypto 雑所得 appears here",
    results_empty_sub:
      "Import spreadsheets, live wallets, or live exchanges — we run 移動平均法 for crypto only.",
    results_kicker: "Crypto only · 移動平均法",
    results_title: "{year} crypto 雑所得",
    results_year: "Year",
    results_export: "Export for accountant",
    results_clear: "Clear all",
    results_active: "Active txs",
    results_matched: "Matched transfers",
    results_income: "Income / rewards",
    results_losses: "Losses",
    results_gains: "Positive gains",
    results_net: "Net crypto 雑所得",
    results_after_carry: "After loss carry",
    results_export_banner:
      "Tax accountant pack: click Export for accountant to download a ZIP (README + sale detail + lots + full ledger).",
    results_impact_kicker: "Crypto gain (not final tax)",
    results_impact_p:
      "Net figure after sells, income receipts, and in-asset fees. Japan adds this to other income — this app does not finalize that.",
    results_impact_sketch:
      " Rough sketch if other 課税所得 were {other}: about {tax} on crypto (illustrative).",
    results_impact_optional:
      " Optional other-income field only sketches a rate — it does not finalize anything.",
    results_zip_p:
      "ZIP for your accountant: sale detail, lots, full ledger with price sources, matched transfers, Japanese README.",
    results_download: "Download accountant pack",
    results_disposals: "Disposals / income in {year}",
    results_no_disposals: "No taxable events in this year yet.",
    results_lots: "Ending lots (移動平均)",
    results_no_lots: "No open positions.",
    th_date: "Date",
    th_kind: "Kind",
    th_asset: "Asset",
    th_qty: "Qty",
    th_proceeds: "Proceeds",
    th_cost: "Cost",
    th_gain: "Gain",
    th_price_src: "Price src",
    th_avg: "Avg cost",
    th_book: "Book value",

    years_kicker: "Multi-year · account",
    years_title: "Crypto loss carry across years",
    years_sub:
      "Japan generally does not allow 雑所得 loss carryforward today. From ~2028, eligible JP-exchange assets may get 3-year carry. Confirm with a tax accountant. Open Tax rules for details.",
    years_th_year: "Year",
    years_th_net: "Net crypto",
    years_th_in: "Carry in",
    years_th_after: "After carry",
    years_th_out: "Carry out",

    review_kicker: "Review · fully editable",
    review_title: "Edit prices, quantities, and cost basis",
    review_sub:
      "Change any field (including DeFi sides). Interest/staking → income; loan proceeds → borrow; loan repayment → repay (neither is taxable income/sell). JPY is price/proceeds. Cost override is optional.",
    th_side: "Side",
    th_jpy: "JPY (price)",
    th_fee: "Fee JPY",
    th_cost_override: "Cost override",
    th_actions: "Actions",
    review_exclude: "Exclude",
    review_include: "Include",
    review_delete: "Delete",
    review_auto: "auto",
    review_matched: "matched",
    ledger_showing: "Showing {from}–{to} of {total}",
    ledger_page_size: "Page size",
    ledger_page_all: "All",
    ledger_prev: "Prev",
    ledger_next: "Next",
    ledger_page: "{page} / {pages}",

    footer:
      "ZEI · Crypto 雑所得 only — not a full tax return (確定申告). Export ZIP from Tax year → Export for accountant. Not tax advice.",

    auth_login: "Log in",
    auth_register: "Create account",
    auth_email: "Email",
    auth_password: "Password (8+)",
    auth_forgot: "Forgot password",
    auth_resend: "Resend verify email",
    auth_back: "Back to log in",
    auth_send_reset: "Send reset link",
    auth_creating: "…",
    auth_register_hint:
      "We’ll email you a verification link. Open it (check spam too) before you log in.",
    auth_verified: "Verified",
    auth_unverified: "Unverified",
    auth_pricing:
      "Free: import, review, older years, and cloud autosave. Pro: unlock this year and last year ({lastYear} and {thisYear}) totals and accountant ZIP.",
    auth_plan_free: "Free ({lastYear} & {thisYear} locked)",
    auth_plan_pro: "Pro",
    auth_pay: "Pay USDC (unlock this year & last)",
    auth_autosave_hint:
      "With a verified email, imports, edits, and clears autosave to your account.",
    pay_title: "Pay Pro with USDC",
    pay_close: "Close",
    pay_lead:
      "Unlocks this-year and last-year totals and accountant ZIP. Connect your browser wallet, then send the USDC price shown.",
    pay_steps_title: "How it works",
    pay_step1: "Connect your wallet",
    pay_step2: "Confirm the USDC send in your wallet",
    pay_step3: "We unlock Pro when that transfer from your wallet is seen",
    pay_price: "Price",
    pay_wallet: "Wallet",
    pay_connect: "Connect wallet",
    pay_connected: "Connected {addr}",
    pay_disconnect: "Disconnect",
    pay_no_wallet:
      "No browser wallet found. Install MetaMask (or another extension), or open this page in a desktop browser with an injected wallet.",
    pay_mobile_hint:
      "Mobile is limited without WalletConnect — a desktop browser wallet works best for v1.",
    pay_select_chain: "Network",
    pay_send: "Pay {amount} USDC",
    pay_sending: "Confirm in wallet…",
    pay_confirming: "Waiting for on-chain confirmation…",
    pay_tx_submitted: "Submitted {tx} — waiting to confirm",
    pay_chains: "Supported chains",
    pay_check: "I’ve paid — check",
    pay_checking: "Checking chains…",
    pay_waiting:
      "Not seen yet. After your wallet confirms the transfer, wait ~1 minute, then check again.",
    pay_confirmed: "Paid on {chain} · {tx}",
    pay_dev_confirm: "Dev: mark paid",
    pay_user_rejected: "Cancelled in wallet.",
    pay_bind_failed: "Could not link wallet to this payment.",
    auth_logout: "Log out",
    auth_dev_link: "Dev verify link:",
    auth_click_verify: "click to verify",
    auth_logged_in: "Logged in.",
    auth_created:
      "Account created. A verification email was sent — open your inbox (and spam), click the link, then log in. If nothing arrives, use “Resend verify email”.",
    auth_verify_ok: "Email verified — you can log in.",
    auth_verify_bad: "Verification link invalid or expired.",

    rules_title: "Current rules & 2028 reform",
    rules_close: "Close",
    rules_now: "Now (until ~2028)",
    rules_now_1:
      "Individuals: crypto is 雑所得, progressive up to ~55% (45% national + 10% local).",
    rules_now_2: "Losses: not deductible, no carryforward under current practice.",
    rules_now_3: "Crypto↔crypto trades: taxable.",
    rules_now_4: "Unrealized gains: not taxed for individuals.",
    rules_now_5:
      "Prices: no official NTA table — ZEI uses exchange → on-chain/public → CoinGecko → manual.",
    rules_next: "From ~Jan 2028 (2026 reform)",
    rules_next_note:
      "Important: not all crypto is taxed at ~20%. The flat ~20.315% rate applies only to eligible assets on Japan-licensed exchanges. Everything else stays progressive (up to ~55%).",
    rules_next_1:
      "Eligible only: designated assets on Japan-licensed exchanges → flat 20.315% separate taxation.",
    rules_next_2: "Loss carryforward: 3 years (eligible assets only).",
    rules_next_3:
      "Not eligible (examples): OTC, private wallets, overseas exchanges, DEXs, staking, lending, airdrops, NFTs → still progressive (up to ~55%).",
    rules_notax: "Not taxed (ownership unchanged)",
    rules_pill_wrap: "Wrapping ETH→WETH",
    rules_pill_bridge: "Bridging chains",
    rules_pill_transfer: "Wallet↔wallet transfers",
    rules_notax_p:
      "ZEI treats wraps, bridges, and matched transfers as non-taxable and keeps cost basis.",
    rules_zei: "What ZEI does today",
    rules_zei_1: "✅ Crypto-only 雑所得 via 移動平均法",
    rules_zei_2: "✅ Wraps / bridges / transfers not taxed",
    rules_zei_3: "✅ Crypto↔crypto as taxable trades",
    rules_zei_4: "✅ Price waterfall + full manual edit",
    rules_zei_5: "✅ Accountant ZIP export",
    rules_zei_6:
      "⚠️ Multi-year loss table = helper / 2028 prep — not current-law filing advice",
    rules_zei_7: "⏳ 2028 flat 20.315% mode for JP-exchange assets — coming later",
    rules_disclaimer:
      "Not tax, legal, or accounting advice. Confirm with a 税理士 before filing.",

    reset_title: "Reset password",
    reset_sub: "Enter a new password (8+ characters).",
    reset_update: "Update password",
    reset_back: "Back to ZEI",
    loading: "Loading…",

    side_buy: "buy",
    side_sell: "sell",
    side_transfer_in: "transfer_in",
    side_transfer_out: "transfer_out",
    side_income: "income",
    side_fee: "fee",
    side_wrap: "wrap",
    side_bridge: "bridge",
    side_borrow: "borrow",
    side_repay: "repay",
    kind_sell: "sell",
    kind_income: "income",
    kind_fee: "fee",

    live: "live",
    region_japan: "Japan",
    region_overseas: "Overseas",
  },
} as const;

export type MessageKey = keyof (typeof messages)["ja"];

export function formatMessage(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    vars[k] != null ? String(vars[k]) : `{${k}}`,
  );
}
