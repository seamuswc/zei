# ZEI — Crypto tax for Japan residents (crypto only)

Accounts · email verify · crypto pay · 移動平均法 · wraps not taxed · **accountant ZIP export**.

## Accountant export (yes — built in)

After you import trades, open **Tax year** (or `#export`) and click:

- **Export for accountant** / **Download accountant pack**

Downloads a ZIP your 税理士 can open:

| File | Contents |
|------|----------|
| `00_README.txt` | Japanese methodology notes |
| `01_売却明細_YYYY.csv` | Disposals / income / fees with 所得金額 (移動平均法) |
| `02_期末残高.csv` | Year-end lots + avg cost |
| `03_全取引台帳.csv` | Full ledger, price sources, match IDs, cost overrides |

## Price waterfall

1. **Exchange fill** (preferred)
2. **On-chain / public quote** (Binance JPY tickers + DexScreener→JPY for today)
3. **CoinGecko** history → spot
4. **Manual** in Review (always)

## Email verify

1. Create account (top right)
2. Verify via email (Resend) — local: link written to `data/mail/` and shown in UI
3. Then log in

Also: forgot password + reset page `/reset?token=…`

## APIs you need (recommended)

| Need | Best option | Env |
|------|-------------|-----|
| Transactional email | **Resend** | `RESEND_API_KEY`, `EMAIL_FROM` |
| App URL in emails | — | `APP_BASE_URL` |
| Auth secret | — | `AUTH_SECRET` |
| ETH + ERC-20 | **Etherscan** | `ETHERSCAN_API_KEY` |
| BTC | blockchain.info | — |
| JPY fallback | CoinGecko | — |
| Japan exchanges | user API keys in UI | — |
| Crypto checkout | **NOWPayments** | `NOWPAYMENTS_*` |

## Run

```bash
export PATH="$HOME/.local/node/bin:$PATH"
cp .env.example .env.local
npm install
npm run dev
```

## Notes

- Other taxable income: **manual entry only** (no presets)
- Log in / Create account: **top right**
- JP 雑所得 loss carryforward is usually disallowed — Years table is an accountant helper
- Use read-only exchange keys
