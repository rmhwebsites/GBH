/** Formatting shared by every analytics section, so numbers read consistently. */

export function pct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}

/** Signed percentage, e.g. "+10.8%" / "−5.4%" (true minus sign) */
export function signedPct(x: number, digits = 1): string {
  const s = pct(Math.abs(x), digits);
  return x > 0 ? `+${s}` : x < 0 ? `−${s}` : s;
}

export function money(x: number, digits = 2): string {
  return x.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** "2026-09-18" -> "Sep 18, 2026", parsed as a local date (no UTC shift) */
export function shortDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
