"use client";

import { useEffect, useId, useState } from "react";
import { useI18n } from "./I18nProvider";

export function TaxRulesGuide() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="btn btn--ghost btn--sm rules-trigger"
        onClick={() => setOpen(true)}
      >
        {t("tax_rules")}
      </button>

      {open && (
        <div
          className="rules-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="rules-sheet">
            <header className="rules-sheet__head">
              <div>
                <p className="import-kicker">{t("brand")}</p>
                <h2 id={titleId}>{t("rules_title")}</h2>
              </div>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setOpen(false)}
              >
                {t("rules_close")}
              </button>
            </header>

            <div className="rules-sheet__body">
              <section className="rules-card rules-card--now">
                <h3>{t("rules_now")}</h3>
                <ul>
                  <li>{t("rules_now_1")}</li>
                  <li>{t("rules_now_2")}</li>
                  <li>{t("rules_now_3")}</li>
                  <li>{t("rules_now_4")}</li>
                  <li>{t("rules_now_5")}</li>
                </ul>
              </section>

              <section className="rules-card rules-card--next">
                <h3>{t("rules_next")}</h3>
                <ul>
                  <li>{t("rules_next_1")}</li>
                  <li>{t("rules_next_2")}</li>
                  <li>{t("rules_next_3")}</li>
                </ul>
              </section>

              <section className="rules-card">
                <h3>{t("rules_notax")}</h3>
                <div className="rules-pills">
                  <span>{t("rules_pill_wrap")}</span>
                  <span>{t("rules_pill_bridge")}</span>
                  <span>{t("rules_pill_transfer")}</span>
                </div>
                <p className="muted">{t("rules_notax_p")}</p>
              </section>

              <section className="rules-card rules-card--zei">
                <h3>{t("rules_zei")}</h3>
                <ul>
                  <li>{t("rules_zei_1")}</li>
                  <li>{t("rules_zei_2")}</li>
                  <li>{t("rules_zei_3")}</li>
                  <li>{t("rules_zei_4")}</li>
                  <li>{t("rules_zei_5")}</li>
                  <li>{t("rules_zei_6")}</li>
                  <li>{t("rules_zei_7")}</li>
                </ul>
              </section>

              <p className="rules-disclaimer">{t("rules_disclaimer")}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
