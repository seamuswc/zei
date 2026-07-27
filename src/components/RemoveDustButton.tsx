"use client";

import { useMemo, useState } from "react";
import { dustTxIds } from "@/lib/tax/dust";
import { usePortfolio } from "./PortfolioProvider";
import { useI18n } from "./I18nProvider";

type Props = {
  /** Extra class on the wrapper (e.g. results placement). */
  className?: string;
};

export function RemoveDustButton({ className }: Props) {
  const { txs, removeManyTxs } = usePortfolio();
  const { t } = useI18n();
  const [status, setStatus] = useState<string | null>(null);

  const ids = useMemo(() => dustTxIds(txs), [txs]);
  const count = ids.length;

  function onClick() {
    setStatus(null);
    if (count === 0) {
      setStatus(t("dust_none"));
      return;
    }
    if (!window.confirm(t("dust_confirm", { n: count }))) return;
    removeManyTxs(ids);
    setStatus(t("dust_removed", { n: count }));
  }

  return (
    <div className={`dust-remove${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className="btn btn--ghost dust-remove__btn"
        onClick={onClick}
        title={t("dust_hint")}
      >
        {t("dust_remove")}
        {count > 0 ? ` (${count})` : ""}
      </button>
      <p className="dust-remove__hint muted">{t("dust_hint")}</p>
      {status && (
        <p className="dust-remove__status" role="status" aria-live="polite">
          {status}
        </p>
      )}
    </div>
  );
}
