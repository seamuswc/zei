"use client";

import { useI18n } from "./I18nProvider";
import type { Locale } from "@/lib/i18n/messages";

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="lang-toggle" role="group" aria-label={t("lang_toggle")}>
      {(["ja", "en"] as Locale[]).map((code) => (
        <button
          key={code}
          type="button"
          className={
            locale === code
              ? "lang-toggle__btn lang-toggle__btn--active"
              : "lang-toggle__btn"
          }
          onClick={() => setLocale(code)}
        >
          {code === "ja" ? t("lang_ja") : t("lang_en")}
        </button>
      ))}
    </div>
  );
}
