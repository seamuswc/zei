# ZEI — Japan crypto tax (crypto only)

**ZEI** calculates **暗号資産の雑所得** for Japan residents using **移動平均法**.  
It is **not** a full 確定申告. Language defaults to **日本語** (English toggle in the header).

---

## How it works

```text
Import trades  →  Review / edit ledger  →  Tax year result  →  Accountant ZIP
     ↑ monochrome CSV / wallet / exchange API
Accounts (email verify) unlock cloud save after Pro (USDC)
```

### 1. Bring data in

| Method | What it does |
|--------|----------------|
| **CSV / Excel export** | Upload exchange or manual books |
| **Wallet** | Live ETH (+ ERC-20) via Etherscan, or BTC — priced to JPY |
| **Exchange API** | Read-only keys for bitFlyer, Coincheck, GMO Coin, bitbank, Binance Japan, Zaif |

**Exchange keys:** enable **view / history / balance only**. Never enable trade or withdraw. Keys are **not stored** (used once for sync).

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
- Multi-year loss table: helper / 2028 prep — **not** current-law carryforward advice  

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
2. Pay **Pro (~20 USDC)** with QR / address  
3. Pro unlocks **cloud ledger save** for ~1 year  

**USDC payment flow**

1. App shows QR (receive address) + **exact** amount (20 USDC + unique micros so each invoice is unique)  
2. Ref looks like `ZEI:username:abcd1234` (optional wallet memo)  
3. User sends native **USDC** on Ethereum or an L2  
4. **I’ve paid — check** scans Etherscan V2: ETH, Base, Arbitrum, Optimism, Polygon, Avalanche, Linea  
5. Match = exact amount to your treasury → unlock Pro  

Same EOA on every chain. No NOWPayments.

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
- [ ] Confirm exchange read-only sync for at least one JP venue  

---

## Env reference

| Need | Env |
|------|-----|
| Auth | `AUTH_SECRET`, `APP_BASE_URL`, `REQUIRE_EMAIL_VERIFY` |
| Email | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` |
| Wallet / pay verify | `ETHERSCAN_API_KEY` |
| Pro USDC | `USDC_RECEIVE_ADDRESS`, `ZEI_PRO_PRICE_USDC` |
| Local only | `ALLOW_DEV_PAY=1` (shows “Dev: mark paid”) |

Copy `.env.example` → `.env.local` and fill in.

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
