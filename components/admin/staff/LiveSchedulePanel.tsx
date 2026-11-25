"use client";

/**
 * Staff profile, Schedule tab, LIVE: this person's REAL shifts at the outlet of their current placement, read from the
 * same weekly rosters as Workforce, Scheduling (lib/admin/workforce/live.ts). Last week, this week and the next three.
 * Managers (roster canCreateSchedule) can edit a shift or add one with the SAME approved ShiftSheet; changes are drafts
 * until the week is published in Scheduling. Shifts dated before yesterday (Africa/Lagos) are read-only.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Files, Pencil, Plus, Users } from "@/components/applicant/icons";
import { EmptyState } from "@/components/applicant/primitives";
import { ShiftSheet } from "@/components/admin/workforce/ShiftSheet";
import { range } from "@/components/admin/workforce/parts";
import { RestrictedError } from "@/lib/admin/adapter";
import { getSchedule, subscribeWorkforce } from "@/lib/admin/workforce/service";
import { isPastShiftDate, lagosDay } from "@/lib/admin/workforce/lagos";
import type { ShiftRow, ShiftState, WeekRoster } from "@/lib/admin/workforce/types";
import { addDays, startOfWeek } from "@/lib/client/format";
import { formatDateShort } from "@/lib/applicant/time";
import { DataTable } from "./DataTable";
import { DCard, LINK_BTN, useFive } from "./detail-kit";

/** Weeks loaded, relative to this week: one back (recent past) and three ahead. */
const WEEK_OFFSETS = [-1, 0, 1, 2, 3];
const STATE_LABEL: Record<ShiftState, string> = { draft: "Draft", published: "Published", changed: "Changed", removing: "Removing" };
const ASSIGNMENTS_HREF = "/admin/staff/assignments";
export const schedulingHref = (outletId: string, weekStart: string) => `/admin/workforce/scheduling?outlet=${encodeURIComponent(outletId)}&week=${encodeURIComponent(weekStart)}`;

type Loaded = { key: string; rosters: WeekRoster[] | null; failed: "error" | "restricted" | null };

export function LiveSchedulePanel({ staffId, outletId }: { staffId: string; outletId: string }) {
  const [attempt, setAttempt] = useState(0);
  const [ver, setVer] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [sheet, setSheet] = useState<{ roster: WeekRoster; shift: ShiftRow | null; date: string } | null>(null);
  const [saved, setSaved] = useState<{ text: string; weekStart: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const key = `${outletId}:${attempt}:${ver}`;

  useEffect(() => subscribeWorkforce(() => setVer((v) => v + 1)), []);
  useEffect(() => {
    if (!outletId) return;
    let cancelled = false;
    const thisWeek = startOfWeek(lagosDay());
    Promise.all(WEEK_OFFSETS.map((n) => getSchedule({ outletId, weekStart: addDays(thisWeek, n * 7) }))).then(
      (pages) => {
        if (cancelled) return;
        // The server falls back to another outlet when this one is out of scope: keep only rosters for THIS outlet.
        const rosters = pages.map((p) => p.roster).filter((r): r is WeekRoster => !!r && r.outletId === outletId);
        setLoaded({ key, rosters, failed: null });
      },
      (e: unknown) => !cancelled && setLoaded({ key, rosters: null, failed: e instanceof RestrictedError ? "restricted" : "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [key, outletId]);

  const rosters = loaded?.key === key ? loaded.rosters : loaded?.rosters ?? null;
  const shifts = (rosters ?? []).flatMap((r) => r.shifts.filter((s) => s.staff.id === staffId).map((s) => ({ s, roster: r }))).sort((a, b) => `${a.s.date}${a.s.start}`.localeCompare(`${b.s.date}${b.s.start}`));
  const { rows, more } = useFive(shifts);

  if (!outletId) {
    return (
      <DCard title="Schedule" hideTitleOnPhone>
        <EmptyState
          icon={Users}
          title="Not placed yet, so no shifts"
          description="Shifts are scheduled at the outlet of a current placement."
          action={
            <Link href={ASSIGNMENTS_HREF} className={LINK_BTN}>
              Open Assignments
            </Link>
          }
        />
      </DCard>
    );
  }

  const thisWeekRoster = rosters?.find((r) => r.weekStart === startOfWeek(lagosDay())) ?? null;
  const canManage = !!thisWeekRoster?.canCreateSchedule && thisWeekRoster.staff.some((p) => p.id === staffId);
  // Add starts on today (Lagos): never before yesterday, and inside this week's roster.
  const addDate = lagosDay();

  return (
    <DCard
      title="Schedule"
      hideTitleOnPhone
      right={
        canManage && thisWeekRoster ? (
          <button type="button" onClick={() => { setSaved(null); setFailed(null); setSheet({ roster: thisWeekRoster, shift: null, date: addDate }); }} className="ap-btn ap-btn-s ap-btn-sm">
            <Plus className="size-4" aria-hidden="true" /> Add shift
          </button>
        ) : undefined
      }
    >
      {saved ? (
        <p role="status" className="mb-3 rounded-xl bg-(--ap-tint-soft) p-3 text-[14px] text-(--ap-ink)">
          {saved.text}{" "}
          <Link href={schedulingHref(outletId, saved.weekStart)} className="font-bold text-(--ap-violet)">
            Publish the week in Scheduling so staff can see changes
          </Link>
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className="mb-3 rounded-xl bg-(--ap-tint-soft) p-3 text-[14px] text-(--ap-ink)">
          {failed}
        </p>
      ) : null}
      {loaded?.failed && !rosters ? (
        <p className="text-[14px] text-(--ap-muted)">
          We could not load shifts.{" "}
          <button type="button" onClick={() => setAttempt((a) => a + 1)} className="font-bold text-(--ap-violet)">
            Try again
          </button>
        </p>
      ) : !rosters ? (
        <p className="text-[14px] text-(--ap-muted)">Loading shifts...</p>
      ) : shifts.length === 0 ? (
        <EmptyState icon={Files} title="No shifts" description="Shifts for this person from last week to three weeks ahead show here once they are scheduled in Workforce, Scheduling." />
      ) : (
        <>
          <DataTable
            label="Shifts"
            heads={["Date", "Shift", "Break", "Role", "State", "Actions"]}
            cols="@min-[560px]:grid-cols-[1fr_1.1fr_0.7fr_1.4fr_0.9fr_44px]"
            rows={rows.map(({ s, roster }) => {
              const past = isPastShiftDate(s.date);
              return {
                key: s.id,
                cells: [
                  formatDateShort(s.date),
                  range(s.start, s.end),
                  `${s.breakMins} min`,
                  [s.role, s.section].filter(Boolean).join(", "),
                  STATE_LABEL[s.state] ?? "Published",
                  roster.canCreateSchedule && s.state !== "removing" ? (
                    <button
                      key="e"
                      type="button"
                      disabled={past}
                      onClick={() => { setSaved(null); setFailed(null); setSheet({ roster, shift: s, date: s.date }); }}
                      aria-label={past ? "Past shifts can't be changed" : `Edit the shift on ${formatDateShort(s.date)}`}
                      title={past ? "Past shifts can't be changed" : "Edit"}
                      className="inline-flex size-8 items-center justify-center rounded-full text-(--ap-muted) transition-colors hover:bg-(--ap-line-2) hover:text-(--ap-ink) focus-visible:ring-2 focus-visible:ring-(--ap-violet) focus-visible:outline-none disabled:opacity-50"
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </button>
                  ) : (
                    <span key="e" className="text-(--ap-muted)">-</span>
                  ),
                ],
              };
            })}
          />
          {more}
        </>
      )}

      {sheet ? (
        <ShiftSheet
          roster={sheet.roster}
          shift={sheet.shift}
          defaultDate={sheet.date}
          defaultStaffId={staffId}
          onClose={() => setSheet(null)}
          onSaved={(r, text) => {
            setSheet(null);
            setSaved({ text, weekStart: r.weekStart });
          }}
          onFailed={(text) => {
            setSheet(null);
            setFailed(text);
          }}
        />
      ) : null}
    </DCard>
  );
}
