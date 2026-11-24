/**
 * Wrong-email protection for Admin invite forms: spots a likely typo in a common email domain
 * ("gmial.com", "yahooo.com", "gmail.con") and suggests the corrected address. Pure, no imports.
 *
 * It only ever SUGGESTS: the admin decides. A domain that is already a known real domain, or that is
 * not close to any of the common domains below, gets no suggestion (most business domains).
 */

/** Domains we suggest. Order matters on a tie: the first, most common one wins. */
const SUGGEST = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "beeliv.co", "live.com", "ymail.com"];

/** Real domains that sit close to a suggested one; never "correct" these. */
const KNOWN = new Set([
  ...SUGGEST,
  "mail.com", "email.com", "gmx.com", "aol.com", "msn.com", "me.com", "mac.com",
  "googlemail.com", "proton.me", "protonmail.com",
  "yahoo.co.uk", "hotmail.co.uk", "outlook.co.uk", "live.co.uk",
]);

/** Edit distance counting a swap of two neighbouring letters as one edit ("gmial" -> "gmail" is 1). */
function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/**
 * Returns the corrected address (e.g. "ada@gmail.com" for "ada@gmial.com"), or null when the domain
 * is already known or nothing is close. Short suggested domains (live.com) only allow one edit in the
 * ending, so an unrelated short business domain is not flagged.
 */
export function emailTypoSuggestion(email: string): string | null {
  const value = email.trim();
  const at = value.lastIndexOf("@");
  if (at <= 0 || value.indexOf("@") !== at) return null;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1).toLowerCase();
  if (domain.length < 3 || KNOWN.has(domain)) return null;
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const candidate of SUGGEST) {
    // Short domains (live.com) only accept an ending typo ("live.co"), so lime.com or dive.com are left alone.
    const short = candidate.length < 9;
    if (short && domain.split(".")[0] !== candidate.split(".")[0]) continue;
    const limit = short ? 1 : 2;
    const dist = distance(domain, candidate);
    if (dist <= limit && dist < bestDistance) {
      best = candidate;
      bestDistance = dist;
    }
  }
  return best ? `${local}@${best}` : null;
}

/** Same address after trimming and ignoring case (for the "Confirm email" field). */
export function emailsMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
