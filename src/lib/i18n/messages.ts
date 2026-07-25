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
    hero_title: "日本居住者向け暗号資産の税務",
    hero_sub:
      "暗号資産のみ対応。メール認証、暗号資産で決済、税理士に渡せるZIPを出力。確定申告の代わりではありません。",
    hero_cta_import: "取引を取り込む",
    hero_cta_export: "税理士向け出力",
    tax_rules: "税制の説明",
    hero_col_buy: "買付",
    hero_col_sell: "売却",
    hero_col_basis: "原価",
    hero_col_income: "所得",
    hero_row_sell: "売",
    hero_row_nontax: "非課税",
    hero_row_accountant: "税理士",
    hero_row_export: "出力",
    hero_row_misc: "雑所得",
    hero_row_crypto_only: "暗号のみ",
    hero_row_net: "ネット",
    hero_stamp: "移動平均法",
    import_kicker: "データを取り込む",
    import_title: "CSV・ウォレット・取引所",
    import_sub:
      "価格の優先順：取引所約定 → オンチェーン／公開価格 → CoinGecko → 確認画面で手動。ラップは非課税です。",

    csv_kicker: "01 · スプレッドシート",
    csv_title: "CSV / Excelをアップロード",
    csv_desc:
      "取引所のエクスポートや手記帳に対応。APIキーが使えないときはこちら。buy/sell、transfer、income、fee、wrap、bridge、trade をサポート。",
    csv_drop: "CSVをドロップ",
    csv_drop_sub: "またはクリックして選択 · .csv / .txt",
    csv_sample: "サンプルCSVを読込",
    csv_template: "テンプレートをダウンロード",
    csv_imported: "{n}行を取り込みました（{label}）",
    csv_none: "有効な行がありません。",

    wallet_kicker: "02 · オンチェーン · ライブ",
    wallet_title: "ウォレット接続",
    wallet_desc:
      "Ethereum（ネイティブ＋主要ERC-20）またはBitcoinをライブ取得し、円換算します。",
    wallet_address: "ウォレットアドレス",
    wallet_etherscan: "Etherscan APIキー",
    wallet_etherscan_ph: "etherscan.io/apikey の無料キー",
    wallet_sync: "接続して同期",
    wallet_syncing: "同期中…",
    wallet_hint:
      "EthereumにはEtherscanキーが必要です（またはサーバー環境変数 ETHERSCAN_API_KEY）。",
    wallet_linked: "接続済み: {address}",

    exchange_kicker: "03 · 取引所 · 読み取り専用API",
    exchange_title: "取引所を連携（かんたん）",
    exchange_desc:
      "Excel/CSVでもOK。かんたんにするなら読み取り専用APIキー。出金・注文権限は絶対に付けないでください。キーは保存しません（この同期だけ使用）。",
    exchange_readonly_title: "必ず読み取り専用キーを使う",
    exchange_readonly_body:
      "APIキー発行時は「照会／履歴／残高」のみON。「注文・取引・出金・送付」はすべてOFF。ZEIは秘密鍵をサーバーに保存しません。",
    exchange_label: "日本の取引所",
    exchange_key: "APIキー（読み取り専用）",
    exchange_secret: "APIシークレット",
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
    exchange_hist_gmo:
      "注意: GMOのAPIは直近の約定が中心です。年間フル履歴はCSVも併用してください。",

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
      "どの欄も変更できます。「円」は価額／売却額。「取得価額上書き」は任意です。買いでは取得原価、売り／手数料では移動平均の代わりに使います。空欄ならエンジン計算。",
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

    footer:
      "ZEI · 税理士向けZIPは「税額年度」→「税理士向けに出力」から。税務・法務・会計の助言ではありません。",

    auth_login: "ログイン",
    auth_register: "アカウント作成",
    auth_email: "メール",
    auth_password: "パスワード（8文字以上）",
    auth_forgot: "パスワードを忘れた",
    auth_resend: "確認メールを再送",
    auth_back: "ログインに戻る",
    auth_send_reset: "リセットリンクを送信",
    auth_creating: "…",
    auth_verified: "確認済み",
    auth_unverified: "未確認",
    auth_pay: "USDCでPro（20）",
    auth_save: "台帳を保存",
    pay_title: "USDCでProを購入",
    pay_close: "閉じる",
    pay_lead:
      "下のQRまたはアドレスに、表示の金額ぴったりでUSDCを送金してください。Ethereumおよび主要L2に対応。",
    pay_amount: "送金額（ぴったりの金額）",
    pay_address: "受取アドレス",
    pay_ref: "照合用メモ（ユーザー情報）",
    pay_ref_hint:
      "ウォレットにメモ欄があればこの参照コードを入れてください。照合は主に金額で行います。",
    pay_chains: "対応チェーン",
    pay_exact_warn:
      "端数まで含めた金額を正確に送ってください（あなた専用の照合用金額です）。",
    pay_check: "支払いを確認",
    pay_checking: "チェーンを確認中…",
    pay_waiting: "まだ検出されていません。送金後1分ほど待って再確認してください。",
    pay_confirmed: "支払い確認: {chain} · {tx}",
    pay_copy: "コピー",
    pay_copied: "コピー済み",
    pay_dev_confirm: "開発用：支払い済みにする",
    auth_logout: "ログアウト",
    auth_dev_link: "開発用確認リンク:",
    auth_click_verify: "クリックして確認",
    auth_logged_in: "ログインしました。",
    auth_created:
      "アカウントを作成しました。メールを確認してからログインしてください。",
    auth_saved: "台帳を保存しました。",
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
    rules_next_1:
      "国内認可取引所の対象暗号資産：分離課税の一律約20.315%。",
    rules_next_2: "損失繰越：対象資産は3年（見込み）。",
    rules_next_3:
      "OTC・自己管理ウォレット・海外所・DEX・ステーキング・レンディング・エアドロ・NFTは引き続き累進（最大約55%）。",
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
    kind_sell: "売却",
    kind_income: "受取",
    kind_fee: "手数料",

    live: "ライブ",
    region_japan: "日本",
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
    hero_title: "Crypto tax for Japan residents",
    hero_sub:
      "Crypto only — verify email, pay in crypto, export a ZIP your tax accountant can open. Not a full tax return.",
    hero_cta_import: "Import activity",
    hero_cta_export: "Accountant export",
    tax_rules: "Tax rules",
    hero_col_buy: "Buy",
    hero_col_sell: "Sell",
    hero_col_basis: "Basis",
    hero_col_income: "Income",
    hero_row_sell: "Sell",
    hero_row_nontax: "Non-tax",
    hero_row_accountant: "Accountant",
    hero_row_export: "Export",
    hero_row_misc: "Misc income",
    hero_row_crypto_only: "Crypto only",
    hero_row_net: "Net",
    hero_stamp: "Moving average",
    import_kicker: "Bring data in",
    import_title: "CSV, live wallet, live exchange",
    import_sub:
      "Price order: exchange fill → on-chain/public quote → CoinGecko → manual in Review. Wraps are not taxed.",

    csv_kicker: "01 · Spreadsheet",
    csv_title: "Upload CSV / Excel export",
    csv_desc:
      "Exchange exports or manual books. Use this if you prefer not to use an API key. Supports buy/sell, transfer, income, fee, wrap, bridge, trade.",
    csv_drop: "Drop CSV here",
    csv_drop_sub: "or click to browse · .csv / .txt",
    csv_sample: "Load sample CSV",
    csv_template: "Download template",
    csv_imported: "Imported {n} row(s) from {label}.",
    csv_none: "No valid rows found.",

    wallet_kicker: "02 · On-chain · live",
    wallet_title: "Connect wallet",
    wallet_desc:
      "Live read: Ethereum native + major ERC-20 (Etherscan) or Bitcoin, priced to JPY.",
    wallet_address: "Wallet address",
    wallet_etherscan: "Etherscan API key",
    wallet_etherscan_ph: "Free key from etherscan.io/apikey",
    wallet_sync: "Connect & sync",
    wallet_syncing: "Syncing live…",
    wallet_hint:
      "Ethereum needs an Etherscan key here, or set ETHERSCAN_API_KEY in the server env.",
    wallet_linked: "Linked: {address}",

    exchange_kicker: "03 · Exchange · read-only API",
    exchange_title: "Link exchange (easiest)",
    exchange_desc:
      "CSV/Excel works too. Easier: paste a read-only exchange API key. Never enable trade or withdraw. Keys are not stored — used only for this sync.",
    exchange_readonly_title: "Read-only API keys only",
    exchange_readonly_body:
      "When creating a key, enable view/history/balance only. Turn OFF order, trade, withdraw, and send. ZEI never stores your secret.",
    exchange_label: "Japan exchange",
    exchange_key: "API key (read-only)",
    exchange_secret: "API secret",
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
    exchange_hist_gmo:
      "Note: GMO’s API mainly covers recent fills. Use CSV for a full tax year.",

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
      "Change any field. JPY is the price/proceeds total. Cost override is optional — on buys it sets acquisition cost; on sells/fees it sets 取得価額 instead of 移動平均. Leave blank to use the engine.",
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

    footer:
      "ZEI · Export ZIP for your tax accountant from Tax year → Export for accountant. Not tax advice.",

    auth_login: "Log in",
    auth_register: "Create account",
    auth_email: "Email",
    auth_password: "Password (8+)",
    auth_forgot: "Forgot password",
    auth_resend: "Resend verify email",
    auth_back: "Back to log in",
    auth_send_reset: "Send reset link",
    auth_creating: "…",
    auth_verified: "Verified",
    auth_unverified: "Unverified",
    auth_pay: "Pay USDC (Pro · 20)",
    auth_save: "Save ledger",
    pay_title: "Pay Pro with USDC",
    pay_close: "Close",
    pay_lead:
      "Scan the QR or send USDC to the address for the exact amount shown. Works on Ethereum and major L2s.",
    pay_amount: "Exact amount",
    pay_address: "Receive address",
    pay_ref: "Your payment ref (username)",
    pay_ref_hint:
      "Paste this ref in the wallet memo if available. Matching is primarily by the exact amount.",
    pay_chains: "Supported chains",
    pay_exact_warn:
      "Send the exact amount including decimals — it uniquely identifies your payment.",
    pay_check: "I’ve paid — check",
    pay_checking: "Checking chains…",
    pay_waiting: "Not seen yet. Wait ~1 minute after sending, then check again.",
    pay_confirmed: "Paid on {chain} · {tx}",
    pay_copy: "Copy",
    pay_copied: "Copied",
    pay_dev_confirm: "Dev: mark paid",
    auth_logout: "Log out",
    auth_dev_link: "Dev verify link:",
    auth_click_verify: "click to verify",
    auth_logged_in: "Logged in.",
    auth_created: "Account created. Verify your email, then log in.",
    auth_saved: "Ledger saved.",
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
    rules_next_1:
      "Eligible assets on Japan-licensed exchanges: flat 20.315% separate taxation.",
    rules_next_2: "Loss carryforward: 3 years (eligible assets only).",
    rules_next_3:
      "Still progressive (up to 55%): OTC, private wallets, overseas exchanges, DEXs, staking, lending, airdrops, NFTs.",
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
    kind_sell: "sell",
    kind_income: "income",
    kind_fee: "fee",

    live: "live",
    region_japan: "Japan",
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
