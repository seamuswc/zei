"use client";

import { Suspense, useState } from "react";
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
import { AuthProvider, useAuth } from "./AuthProvider";
import { filingTaxYear } from "@/lib/billing";

function FreemiumBanner() {
  const { t } = useI18n();
  const { isPro, loading, user, startProPay } = useAuth();
  const [busy, setBusy] = useState(false);

  if (loading || isPro) return null;

  const year = filingTaxYear();

  async function unlock() {
    if (!user) {
      document.querySelector<HTMLButtonElement>(".auth-menu > button")?.click();
      return;
    }
    setBusy(true);
    try {
      await startProPay();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="freemium-banner" role="status">
      <p>{t("freemium_banner", { year })}</p>
      <button
        type="button"
        className="btn btn--solid btn--sm"
        disabled={busy}
        onClick={() => void unlock()}
      >
        {busy ? (
          <span className="btn-loading">
            <span className="spinner" aria-hidden />
            {t("auth_creating")}
          </span>
        ) : user ? (
          t("freemium_cta_pay")
        ) : (
          t("freemium_cta_login")
        )}
      </button>
    </div>
  );
}

function AppShell() {
  const { t } = useI18n();

  return (
    <PortfolioProvider>
      <AuthProvider>
        <div className="app">
          <header className="topbar">
            <a className="brand" href="#top">
              <span className="brand__mark" aria-hidden />
              {t("brand")}
            </a>
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
          <FreemiumBanner />

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
      </AuthProvider>
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
