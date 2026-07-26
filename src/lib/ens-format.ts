const ETH_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;
/** ASCII .eth names after lowercase (basic labels: a-z 0-9 hyphen). */
const ENS_NAME_RE =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.eth$/;

export function isEthHexAddress(v: string): boolean {
  return ETH_ADDR_RE.test(v.trim());
}

export function isEnsName(v: string): boolean {
  const n = v.trim().toLowerCase();
  return ENS_NAME_RE.test(n);
}

/** Trim; lowercase ENS-looking inputs; leave 0x casing for hex checks. */
export function normalizeWalletInput(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (t.includes(".")) return t.toLowerCase();
  return t;
}
