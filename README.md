# ZEI — Japan crypto tax (crypto only)

**ZEI** calculates **暗号資産の雑所得** for Japan residents using **移動平均法**.  
It is **not** a full 確定申告. Language defaults to **日本語** (English toggle in the header).

---

## How it works

```text
Import trades  →  Review / edit ledger  →  Tax year result  →  Accountant ZIP
     ↑ monochrome CSV / wallet / exchange API
Accounts (email verify) autosave the ledger to the cloud; Pro (USDC) unlocks the filing year
```

### 1. Bring data in

| Method | What it does |
|--------|----------------|
| **CSV export** | Upload exchange or manual books (`.csv` / `.txt`) |
| **Wallet** | Live **all Etherscan API V2 EVM mainnets** for one address (same EVM address across chains; optional advanced chain limit) — address or ENS (+ native + ERC-20 + internal transfers) — priced to JPY (Asia/Tokyo dates). ENS resolves on Ethereum mainnet only. |
| **Exchange API** | Read-only keys — **Japan:** bitFlyer, Coincheck, GMO Coin, bitbank, Binance Japan, Zaif · **Overseas:** Binance, Bybit, OKX, Kraken, KuCoin, Bitget, Gate.io, MEXC, Crypto.com, Coinbase Exchange, HTX |

**Exchange keys:** enable **view / history / balance only**. Never enable trade or withdraw. Keys are **not stored** (used once for sync). OKX / KuCoin / Bitget / Coinbase also need the API **passphrase**. Coinbase uses **Exchange** HMAC keys only (**Advanced Trade JWT/CDP is not supported** — use CSV). Overseas USDT/USD fills are converted to JPY (CoinGecko).

**Unlink:** removing a wallet or exchange also deletes that source’s imported rows from the ledger (other sources stay).

### 2. Pricing (waterfall)

1. Exchange fill price (best)  
2. On-chain / public JPY quote  
3. CoinGecko  
4. Manual edit in **Review**

Wraps, bridges, and same-asset transfers are treated as **non-taxable** (basis preserved). Crypto↔crypto trades are taxable.

### 3. Tax engine

- Method: **移動平均法** (moving average cost)  
- Output: crypto **雑所得** for the selected year  
- Optional other income: sketch only (not a final tax bill)  
- Multi-year loss table: **planning simulation only** — **not** current-law carryforward (do not file from it)  

### 4. Accountant export

From **Tax year** / `#export` → download ZIP:

| File | Contents |
|------|----------|
| `00_README.txt` | Japanese methodology notes |
| `01_売却明細_YYYY.csv` | Disposals / income / fees + 所得金額 |
| `02_期末残高.csv` | Year-end lots + average cost |
| `03_全取引台帳.csv` | Full ledger, price sources, matches, overrides |

### 5. Accounts & Pro

1. Register → verify email (`support.cryptozei.com` via Resend)  
2. Pay **Pro (`ZEI_PRO_PRICE_USDC`, default 20 USDC)** via connect-wallet → in-page USDC transfer  
3. Pro unlocks **filing-year totals / accountant ZIP** for ~1 year  

**USDC payment flow**

1. Logged-in user opens Pro pay → invoice stores the **clean** Pro price (no unique micro-amount)  
2. **Connect wallet** (EIP-1193 `window.ethereum` — MetaMask etc.; no WalletConnect in v1)  
3. App binds `from_address` to that invoice, user picks a chain, confirms **USDC `transfer`** in the wallet  
4. **I’ve paid — check** (and auto-poll) scans Etherscan V2: ETH, Base, Arbitrum, Optimism, Polygon, Avalanche, Linea  
5. Match = transfer **from connected wallet → your treasury**, USDC amount ≈ Pro price (small tolerance), recent, unused tx → unlock Pro  

Same receive EOA on every chain. Needs an injected browser wallet (mobile deep-link / WalletConnect not wired yet). No NOWPayments.

---

## Quick todo (go live)

- [ ] Set `AUTH_SECRET` to a long random string  
- [ ] Set `APP_BASE_URL` to production URL  
- [ ] Set `RESEND_API_KEY` (domain `support.cryptozei.com` already DNS’d)  
- [ ] Set `ETHERSCAN_API_KEY`  
- [ ] Set `USDC_RECEIVE_ADDRESS` to your real treasury wallet  
- [ ] Set `ZEI_PRO_PRICE_USDC=20` (or your price)  
- [ ] Set `ALLOW_DEV_PAY=0` in production  
- [ ] `REQUIRE_EMAIL_VERIFY=1` in production  
- [ ] Deploy (Node + writable `data/` for SQLite)  
- [ ] Smoke-test: register → verify email → pay USDC → save ledger → export ZIP  
- [ ] Confirm exchange read-only sync for at least one JP and one overseas venue  

---

## Env reference

| Need | Env |
|------|-----|
| Auth | `AUTH_SECRET`, `APP_BASE_URL`, `REQUIRE_EMAIL_VERIFY` |
| Email | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` |
| Wallet / pay verify | `ETHERSCAN_API_KEY` |
| Pro USDC | `USDC_RECEIVE_ADDRESS`, `ZEI_PRO_PRICE_USDC` |
| Local only | `ALLOW_DEV_PAY=1` (shows “Dev: mark paid”) |
| WIP banner | `NEXT_PUBLIC_SHOW_WIP_BANNER=1` (default off; “under construction” only — product honesty bar always shows) |

Copy `.env.example` → `.env.local` and fill in.

---

## Ops / payments

No admin UI — SSH + scripts only.

| | |
|--|--|
| SSH | `ssh root@167.71.217.5` |
| App | `/var/www/zei` · pm2 `zei` |
| DB | `data/zei.db` |
| Support (footer) | `seamus@cryptozei.com` |
| OPS alerts | `OPS_ALERT_EMAIL` → `seamuswconnolly@gmail.com` (never support) |

```bash
cd /var/www/zei

# Lookup
node scripts/lookup-payment.mjs <email|paymentId|txHash>

# Mark refunded (exit 1 if already refunded; email with multiple hits → use paymentId)
node scripts/mark-refunded.mjs <paymentId|txHash|email> [--note "..."]

# List finished payments (optional)
sqlite3 data/zei.db "SELECT p.id, u.email, p.status, p.tx_hash, p.refunded_at, p.created_at FROM payments p JOIN users u ON u.id = p.user_id WHERE p.status = 'finished' ORDER BY p.created_at DESC LIMIT 50;"

# OPS alerts (cron hourly → OPS Gmail only)
node scripts/ops-alerts.mjs           # live
node scripts/ops-alerts.mjs --dry-run
# 0 * * * * cd /var/www/zei && /usr/bin/node scripts/ops-alerts.mjs >> /var/log/zei-ops-alerts.log 2>&1
```

Alerts cover daily signups, user milestones, Etherscan/CoinGecko credit pressure, scale soft advice. Needs `RESEND_API_KEY`, `EMAIL_FROM`, API keys; optional `OPS_ALERT_EMAIL` (forced to ops Gmail).

### Database backup

```bash
sudo mkdir -p /var/backups/zei
sudo cp /var/www/zei/scripts/backup-db.sh /usr/local/bin/zei-backup-db.sh
sudo chmod +x /usr/local/bin/zei-backup-db.sh
# cron daily 03:15 UTC:
# 15 3 * * * ZEI_DB=/var/www/zei/data/zei.db ZEI_BACKUP_DIR=/var/backups/zei /usr/local/bin/zei-backup-db.sh
```

---

## Run locally

```bash
export PATH="$HOME/.local/node/bin:$PATH"
cp .env.example .env.local   # then edit
npm install
npm run dev
```

Optional payment smoke test:

```bash
USDC_RECEIVE_ADDRESS=0x… ETHERSCAN_API_KEY=… node scripts/smoke-pay.mjs
```

---

## Notes

- Crypto-only product; other taxable income is optional and illustrative  
- Login / account: **top right**; language: **日本語 / English**  
- Tax rules explainer is in-app (**税制の説明**)  
- Not tax, legal, or accounting advice — confirm with a 税理士 before filing  
