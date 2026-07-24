"use client";

import { useRef, useState } from "react";
import { parseSpreadsheetCsv, SAMPLE_CSV } from "@/lib/import/csv";
import { usePortfolio } from "./PortfolioProvider";

export function SpreadsheetUpload() {
  const { addTxs } = usePortfolio();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  function handleText(text: string, label: string) {
    const { txs, errors: errs } = parseSpreadsheetCsv(text);
    setErrors(errs.slice(0, 5));
    if (txs.length) {
      addTxs(txs);
      setStatus(`Imported ${txs.length} row${txs.length === 1 ? "" : "s"} from ${label}.`);
    } else {
      setStatus("No valid rows found.");
    }
  }

  async function onFile(file: File) {
    const text = await file.text();
    handleText(text, file.name);
  }

  return (
    <div className="import-panel">
      <div className="import-panel__head">
        <p className="import-kicker">01 · Spreadsheet</p>
        <h3>Upload CSV</h3>
        <p>
          Drop an exchange export or your own books. Supports buy/sell,
          transfer_in/out, income (staking/airdrop), fee, and trade (+
          counter_asset, counter_qty).
        </p>
      </div>

      <div
        className={`dropzone ${dragging ? "dropzone--active" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void onFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
      >
        <span className="dropzone__title">Drop CSV here</span>
        <span className="dropzone__sub">or click to browse · .csv / .txt</span>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
            e.target.value = "";
          }}
        />
      </div>

      <div className="import-actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => handleText(SAMPLE_CSV, "sample.csv")}
        >
          Load sample CSV
        </button>
        <a
          className="btn btn--ghost"
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE_CSV)}`}
          download="zei-sample.csv"
        >
          Download template
        </a>
      </div>

      {status && <p className="status-ok">{status}</p>}
      {errors.length > 0 && (
        <ul className="status-err">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
