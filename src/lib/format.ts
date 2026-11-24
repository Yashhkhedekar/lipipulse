/* Number, date and string utilities for LipiPulse. */

const inr = new Intl.NumberFormat("en-IN");

export function fmtFull(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return inr.format(Math.round(n));
}

/** Indian short scale: 42.5K · 2.45L · 1.24Cr */
export function fmtCompact(n: number): string {
  const v = Math.round(n);
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a < 1000) return `${sign}${a}`;
  if (a < 1e5) return `${sign}${trim(a / 1e3, 1)}K`;
  if (a < 1e7) return `${sign}${trim(a / 1e5, 2)}L`;
  return `${sign}${trim(a / 1e7, 2)}Cr`;
}

function trim(n: number, digits: number): string {
  const s = n.toFixed(digits);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

export function fmtSigned(n: number): string {
  if (Math.round(n) === 0) return "0";
  return `${n > 0 ? "+" : "-"}${fmtCompact(Math.abs(n))}`;
}

export function fmtPct(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  const s = trim(Math.abs(n), 1);
  return `${n > 0 ? "+" : n < 0 ? "-" : ""}${s}%`;
}

export function fmtRating(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return n.toFixed(1);
}

/* ---------- dates ---------- */

export function isoOf(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return isoOf(new Date());
}

export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return isoOf(dt);
}

export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const A = new Date(ay, am - 1, ad).getTime();
  const B = new Date(by, bm - 1, bd).getTime();
  return Math.round((B - A) / 86400000);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export function weekdayShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(y, m - 1, d).getDay()];
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

/* ---------- fuzzy matching (OCR review) ---------- */

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[।॥|"'“”‘’.,:;!?()\[\]{}\-–—/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  let cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

/** Normalized similarity in [0,1] using Levenshtein distance. */
export function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  const d = lev(na, nb);
  return 1 - d / Math.max(na.length, nb.length);
}

/** Also collapses spaces so "सावळीचं घर" matches "सावळीचंघर". */
export function bestMatch<T extends { title: string }>(query: string, items: T[], threshold = 0.8): { item: T; score: number } | null {
  let best: { item: T; score: number } | null = null;
  for (const it of items) {
    const s = Math.max(similarity(query, it.title), similarity(normalize(query).replace(/\s/g, ""), normalize(it.title).replace(/\s/g, "")));
    if (s >= threshold && (!best || s > best.score)) best = { item: it, score: s };
  }
  return best;
}

/** Parses "1.2K" / "2.45L" / "1.5M" / "1.2Cr" / Devanagari numerals into integers. */
export function parseAbbrev(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.round(raw) : null;
  const deva = raw.replace(/[०१२३४५६७८९]/g, (c) => String("०१२३४५६७८९".indexOf(c)));
  const m = deva.replace(/,/g, "").trim().match(/(-?\d+(?:\.\d+)?)\s*(cr|crore|कोटी|mn|m|mn|l|lakh|लाख|k|hजार|हजार)?/i);
  if (!m) return null;
  const num = parseFloat(m[1]);
  if (!Number.isFinite(num)) return null;
  const unit = (m[2] || "").toLowerCase();
  if (unit.startsWith("cr") || unit === "कोटी") return Math.round(num * 1e7);
  if (unit === "m" || unit.startsWith("mn")) return Math.round(num * 1e6);
  if (unit.startsWith("l") || unit === "लाख") return Math.round(num * 1e5);
  if (unit.startsWith("k") || unit.startsWith("ह") || unit.startsWith("h")) return Math.round(num * 1e3);
  return Math.round(num);
}
