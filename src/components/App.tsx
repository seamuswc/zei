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
import { TaxRulesGuide } from "./TaxRulesGuide";
import { LanguageToggle } from "./LanguageToggle";
import { PortfolioProvider } from "./PortfolioProvider";
import { I18nProvider, useI18n } from "./I18nProvider";

function AppShell() {
  const { t } = useI18n();

  return (
    <PortfolioProvider>
      <div className="app">
        <header className="topbar">
          <a className="brand" href="#top">
            <span className="brand__mark" aria-hidden />
            {t("brand")}
          </a>
          <nav className="topbar__nav">
            <a href="#import">{t("nav_import")}</a>
            <a href="#income">{t("nav_income")}</a>
            <a href="#results">{t("nav_results")}</a>
            <a href="#years">{t("nav_years")}</a>
            <a href="#review">{t("nav_review")}</a>
            <a href="#export">{t("nav_export")}</a>
          </nav>
          <LanguageToggle />
          <TaxRulesGuide />
          <Suspense
            fallback={
              <span className="btn btn--solid btn--sm">{t("auth_login")}</span>
            }
          >
            <AuthMenu />
          </Suspense>
        </header>

        <div className="wip-banner" role="status">
          {t("wip_banner")}
        </div>

        <main id="top">
          <section className="hero">
            <div className="hero__copy">
              <p className="hero__brand">{t("brand")}</p>
              <h1>{t("hero_title")}</h1>
              <p className="hero__sub">{t("hero_sub")}</p>
              <div className="hero__cta">
                <a className="btn btn--solid" href="#import">
                  {t("hero_cta_import")}
                </a>
                <a className="btn btn--ghost" href="#export">
                  {t("hero_cta_export")}
                </a>
                <TaxRulesGuide />
              </div>
            </div>
            <div className="hero__visual" aria-hidden>
              <div className="ledger-plane">
                <div className="ledger-plane__rule" />
                <div className="ledger-plane__cols">
                  <span>{t("hero_col_buy")}</span>
                  <span>{t("hero_col_sell")}</span>
                  <span>{t("hero_col_basis")}</span>
                  <span>{t("hero_col_income")}</span>
                </div>
                <ul className="ledger-plane__rows">
                  <li>
                    <span>BTC</span>
                    <span>{t("hero_row_sell")}</span>
                    <span>¥420,000</span>
                  </li>
                  <li>
                    <span>ETH</span>
                    <span>→WETH</span>
                    <span>{t("hero_row_nontax")}</span>
                  </li>
                  <li>
                    <span>ZIP</span>
                    <span>{t("hero_row_accountant")}</span>
                    <span>{t("hero_row_export")}</span>
                  </li>
                  <li className="ledger-plane__rows--gain">
                    <span>{t("hero_row_misc")}</span>
                    <span>{t("hero_row_crypto_only")}</span>
                    <span>{t("hero_row_net")}</span>
                  </li>
                </ul>
                <div className="ledger-plane__stamp">{t("hero_stamp")}</div>
              </div>
            </div>
          </section>

          <section className="import" id="import">
            <div className="section-intro">
              <p className="import-kicker">{t("import_kicker")}</p>
              <h2>{t("import_title")}</h2>
              <p>{t("import_sub")}</p>
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
          <p>{t("footer")}</p>
        </footer>
      </div>
    </PortfolioProvider>
  );
}

export function App() {
  return (
    <I18nProvider>
      <AppShell />
    </I18nProvider>
  );
}
