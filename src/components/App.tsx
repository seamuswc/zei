"use client";

import { Suspense } from "react";
import { SpreadsheetUpload } from "./SpreadsheetUpload";
import { WalletConnect } from "./WalletConnect";
import { ExchangeLink } from "./ExchangeLink";
import { IncomeProfile } from "./IncomeProfile";
import { TaxResults } from "./TaxResults";
import { ReviewLedger } from "./ReviewLedger";
import { AuthMenu } from "./AuthMenu";
import { TaxYearsPanel } from "./TaxYearsPanel";
import { PortfolioProvider } from "./PortfolioProvider";

export function App() {
  return (
    <PortfolioProvider>
      <div className="app">
        <header className="topbar">
          <a className="brand" href="#top">
            <span className="brand__mark" aria-hidden />
            ZEI
          </a>
          <nav className="topbar__nav">
            <a href="#import">Import</a>
            <a href="#income">Income</a>
            <a href="#results">Tax year</a>
            <a href="#years">Years</a>
            <a href="#review">Review</a>
            <a href="#export">Export</a>
          </nav>
          <Suspense fallback={<span className="btn btn--solid btn--sm">Log in</span>}>
            <AuthMenu />
          </Suspense>
        </header>

        <main id="top">
          <section className="hero">
            <div className="hero__copy">
              <p className="hero__brand">ZEI</p>
              <h1>Crypto tax for Japan residents</h1>
              <p className="hero__sub">
                Crypto only — verify email, pay in crypto, export a ZIP your
                税理士 can open. Not a full tax return.
              </p>
              <div className="hero__cta">
                <a className="btn btn--solid" href="#import">
                  Import activity
                </a>
                <a className="btn btn--ghost" href="#export">
                  Accountant export
                </a>
              </div>
            </div>
            <div className="hero__visual" aria-hidden>
              <div className="ledger-plane">
                <div className="ledger-plane__rule" />
                <div className="ledger-plane__cols">
                  <span>買付</span>
                  <span>売却</span>
                  <span>原価</span>
                  <span>所得</span>
                </div>
                <ul className="ledger-plane__rows">
                  <li>
                    <span>BTC</span>
                    <span>売</span>
                    <span>¥420,000</span>
                  </li>
                  <li>
                    <span>ETH</span>
                    <span>→WETH</span>
                    <span>not taxed</span>
                  </li>
                  <li>
                    <span>ZIP</span>
                    <span>税理士</span>
                    <span>export</span>
                  </li>
                  <li className="ledger-plane__rows--gain">
                    <span>雑所得</span>
                    <span>暗号のみ</span>
                    <span>ネット</span>
                  </li>
                </ul>
                <div className="ledger-plane__stamp">移動平均法</div>
              </div>
            </div>
          </section>

          <section className="import" id="import">
            <div className="section-intro">
              <p className="import-kicker">Bring data in</p>
              <h2>CSV, live wallet, live exchange</h2>
              <p>
                Price order: exchange fill → on-chain/public quote → CoinGecko →
                manual in Review. Wraps are not taxed.
              </p>
            </div>
            <div className="import-grid">
              <SpreadsheetUpload />
              <WalletConnect />
              <ExchangeLink />
            </div>
          </section>

          <IncomeProfile />
          <div id="export">
            <TaxResults />
          </div>
          <TaxYearsPanel />
          <ReviewLedger />
        </main>

        <footer className="footer">
          <p>
            ZEI · Export ZIP for your tax accountant from Tax year →{" "}
            <strong>Export for accountant</strong>. Not tax advice.
          </p>
        </footer>
      </div>
    </PortfolioProvider>
  );
}
