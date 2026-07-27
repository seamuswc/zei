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
import { filingTaxYears } from "@/lib/billing";

function FreemiumBanner() {
  const { t } = useI18n();
  const { isPro, loading, user, startProPay } = useAuth();
  const [busy, setBusy] = useState(false);

  if (loading || isPro) return null;

  const [lastYear, thisYear] = filingTaxYears();

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
      <p>{t("freemium_banner", { lastYear, thisYear })}</p>
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

          <div className="honesty-bar" role="note">
            {t("honesty_bar")}
          </div>

          {process.env.NEXT_PUBLIC_SHOW_WIP_BANNER === "1" && (
            <div className="wip-banner" role="status">
              {t("wip_banner")}
            </div>
          )}
          <FreemiumBanner />

          <main id="top">
            <section className="import" id="import">
              <div className="section-intro">
                <p className="import-kicker">{t("import_kicker")}</p>
                <h2>{t("import_title")}</h2>
                <p>{t("import_sub")}</p>
                <p className="muted">
                  <a href="#export">{t("import_export_link")}</a>
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
            <p>{t("footer")}</p>
            <p className="footer__contact">
              {t("footer_contact")}{" "}
              <a href="mailto:seamus@cryptozei.com">seamus@cryptozei.com</a>
            </p>
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
