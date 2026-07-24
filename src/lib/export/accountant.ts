import type { CryptoTx, TaxYearResult } from "@/lib/tax/types";
import { formatJpy } from "@/lib/tax/engine";

function csvEscape(value: string | number): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
}

function withBom(csv: string): string {
  return `\uFEFF${csv}`;
}

export function buildAccountantPack(options: {
  year: number;
  txs: CryptoTx[];
  summary: TaxYearResult;
  otherIncomeJpy: number;
  matchedTransfers?: number;
}): { filename: string; files: { name: string; content: string }[] } {
  const {
    year,
    txs,
    summary,
    otherIncomeJpy,
    matchedTransfers = summary.matchedTransferCount,
  } = options;
  const stamp = new Date().toISOString().slice(0, 10);

  const disposalCsv = withBom(
    toCsv([
      [
        "取引日",
        "区分",
        "暗号資産",
        "数量",
        "売却価額円",
        "取得価額円",
        "所得金額円",
        "計算方法",
        "円換算根拠",
        "データ出典",
        "備考",
      ],
      ...summary.disposals.map((d) => [
        d.date,
        d.kind,
        d.asset,
        d.quantity,
        Math.round(d.proceedsJpy),
        Math.round(d.costBasisJpy),
        Math.round(d.gainJpy),
        "移動平均法",
        d.priceSource ?? "",
        d.source,
        d.note ?? "",
      ]),
    ]),
  );

  const lotsCsv = withBom(
    toCsv([
      ["暗号資産", "期末数量", "平均取得単価円", "簿価円"],
      ...summary.endingLots.map((l) => [
        l.asset,
        l.quantity,
        Math.round(l.avgCostJpy),
        Math.round(l.totalCostJpy),
      ]),
    ]),
  );

  const ledgerCsv = withBom(
    toCsv([
      [
        "取引日",
        "暗号資産",
        "区分",
        "数量",
        "円換算額",
        "単価円",
        "手数料円",
        "円換算根拠",
        "出典",
        "取引所",
        "TxHash",
        "コントラクト",
        "振替マッチID",
        "除外",
        "取得価額上書き円",
        "備考",
      ],
      ...txs.map((t) => [
        t.date,
        t.asset,
        t.side,
        t.quantity,
        Math.round(t.jpyValue),
        t.unitPriceJpy != null ? Math.round(t.unitPriceJpy) : "",
        t.feeJpy != null ? Math.round(t.feeJpy) : "",
        t.priceSource ?? "",
        t.source,
        t.exchange ?? "",
        t.txHash ?? "",
        t.tokenContract ?? "",
        t.matchedTransferId ?? "",
        t.excluded ? "Y" : "",
        t.costBasisOverrideJpy != null
          ? Math.round(t.costBasisOverrideJpy)
          : "",
        t.note ?? "",
      ]),
    ]),
  );

  const readme = [
    `ZEI 暗号資産所得 計算資料（税理士提出用）`,
    `作成日: ${stamp}`,
    `対象年: ${year}`,
    ``,
    `【重要】`,
    `- 本資料は暗号資産（仮想通貨）の所得計算に限定しています。`,
    `- 給与・事業・その他所得を合算した最終税額ではありません。`,
    `- 計算方法: 移動平均法。`,
    `- 所得には売却益のほか、エアドロップ/ステーキング等の受取時時価（income）を含みます。`,
    `- 取引所↔ウォレットの振替は可能な範囲でマッチし、譲渡益を認識しません。`,
    `- 円換算根拠列: exchange_fill / coingecko_history / coingecko_spot / csv_provided / derived_trade 等。`,
    `- 本出力は申告の補助資料です。最終判断は税理士 / 納税者ご本人が行ってください。`,
    ``,
    `【サマリー ${year}】`,
    `- 取引件数（年）: ${summary.txCount}（有効 ${summary.activeTxCount} / 除外 ${summary.excludedTxCount}）`,
    `- 振替マッチ: ${matchedTransfers}`,
    `- 売却価額合計: ${formatJpy(summary.totalProceedsJpy)}`,
    `- 取得価額合計: ${formatJpy(summary.totalCostBasisJpy)}`,
    `- プラス所得合計: ${formatJpy(summary.totalPositiveGainJpy)}`,
    `- 損失合計: ${formatJpy(summary.totalLossJpy)}`,
    `- 受取所得（income）: ${formatJpy(summary.totalIncomeJpy)}`,
    `- 暗号資産雑所得（ネット）: ${formatJpy(summary.totalGainJpy)}`,
    `- 参考: 他所得（任意入力）: ${formatJpy(otherIncomeJpy)} ※最終税額の合算には未使用`,
    ``,
    `【同梱ファイル】`,
    `1. 01_売却明細_${year}.csv … 売却・income・fee ごとの所得金額`,
    `2. 02_期末残高.csv … 期末数量と平均取得単価`,
    `3. 03_全取引台帳.csv … 全取引（円換算根拠・マッチID付き）`,
    `4. 00_README.txt … 本ファイル`,
    ``,
    `【税理士向けメモ】`,
    `- 「所得金額円」の合計（ネット）が当該年の暗号資産雑所得の計算根拠です。`,
    `- 雑所得内の通算はネットに反映済み。他所得区分との通算・繰越は範囲外です。`,
    `- 除外=Y の行は計算から外しています。`,
  ].join("\r\n");

  return {
    filename: `ZEI_税理士提出用_${year}_${stamp}.zip`,
    files: [
      { name: "00_README.txt", content: readme },
      { name: `01_売却明細_${year}.csv`, content: disposalCsv },
      { name: "02_期末残高.csv", content: lotsCsv },
      { name: "03_全取引台帳.csv", content: ledgerCsv },
    ],
  };
}

export function zipStore(
  files: { name: string; content: string }[],
): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const data = enc.encode(file.content);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    parts.push(local, data);

    const cen = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cen.set(nameBytes, 46);
    central.push(cen);
    offset += local.length + data.length;
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const out = new Uint8Array(offset + centralSize + end.length);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  for (const c of central) {
    out.set(c, o);
    o += c.length;
  }
  out.set(end, o);
  return out;
}

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
  }
  return ~c >>> 0;
}

export function downloadAccountantZip(
  filename: string,
  files: { name: string; content: string }[],
) {
  const bytes = zipStore(files);
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
