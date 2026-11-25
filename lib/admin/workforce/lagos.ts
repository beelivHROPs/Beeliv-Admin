/**
 * Calendar days in Africa/Lagos, the zone workforce_shift_save checks against: a shift may be added or changed only
 * from YESTERDAY (Lagos) onwards. Pure, so the screens and tests share one rule. The server stays the authority.
 */
const FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" });

/** "YYYY-MM-DD" for `now` in Lagos. */
export const lagosDay = (now: Date = new Date()): string => FMT.format(now);

/** Yesterday in Lagos: the earliest shift date that can still be added or changed. */
export function earliestEditableShiftDate(now: Date = new Date()): string {
  const d = new Date(`${lagosDay(now)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Past shifts (before yesterday, Lagos) are read-only. */
export const isPastShiftDate = (date: string, now: Date = new Date()): boolean => date < earliestEditableShiftDate(now);
