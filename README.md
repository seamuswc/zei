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

Sending domain: **support.cryptozei.com** (Resend / DNS confirmed).

1. Set `RESEND_API_KEY` and keep `EMAIL_FROM=ZEI <noreply@support.cryptozei.com>`
2. Optional: `EMAIL_REPLY_TO=support@cryptozei.com`
3. Create account (top right) → verify via email
4. Local without Resend: link written to `data/mail/` and shown in UI

Also: forgot password + reset page `/reset?token=…`

## APIs you need (recommended)

| Need | Best option | Env |
|------|-------------|-----|
| Transactional email | **Resend** (`support.cryptozei.com`) | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` |
| App URL in emails | — | `APP_BASE_URL` |
| Auth secret | — | `AUTH_SECRET` |
| ETH + ERC-20 | **Etherscan** | `ETHERSCAN_API_KEY` |
| BTC | blockchain.info | — |
| JPY fallback | CoinGecko | — |
| Japan exchanges (read-only API) | bitFlyer, Coincheck, GMO, bitbank, Binance JP, Zaif | pasted in UI; never stored |
| Pro checkout | **USDC QR** (ETH + L2s via Etherscan) | `USDC_RECEIVE_ADDRESS`, `ETHERSCAN_API_KEY`, `ZEI_PRO_PRICE_USDC` |

## Run

```bash
export PATH="$HOME/.local/node/bin:$PATH"
cp .env.example .env.local
npm install
npm run dev
```

## Pro payment (USDC QR)

1. Set `USDC_RECEIVE_ADDRESS` to your wallet (same address on ETH + L2s)
2. Keep `ETHERSCAN_API_KEY` set (multichain V2)
3. User pays **exact** USDC amount shown (≈20 USDC + unique micros for matching)
4. Ref code looks like `ZEI:username:abcd1234` — put in memo if wallet allows
5. Click **I’ve paid — check** → ZEI scans ETH, Base, Arbitrum, Optimism, Polygon, Avalanche, Linea (Etherscan V2)

## Notes

- Other taxable income: **manual entry only** (no presets)
- Log in / Create account: **top right**
- JP 雑所得 loss carryforward is usually disallowed — Years table is an accountant helper
- Use read-only exchange keys
