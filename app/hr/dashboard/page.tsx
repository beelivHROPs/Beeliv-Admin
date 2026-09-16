import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock, FileBarChart, MapPin, User, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MetricCard } from "@/components/shared/MetricCard";
import { CountUp } from "@/components/shared/CountUp";
import { ProgressRing } from "@/components/shared/ProgressRing";
import { HeroStatCard } from "@/components/shared/HeroStatCard";
import { PlaceholderWidgetCard } from "@/components/shared/PlaceholderWidgetCard";
import { SAMPLE_STAFF, SAMPLE_ATTENDANCE_TODAY, SAMPLE_WARNINGS } from "@/lib/placeholder-data";
import { DASHBOARD_ACCENT_BG } from "@/lib/dashboard-accent";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Assigned HR Dashboard — docs/architecture/ui-ux-framework.md §4 (major
 * wireframe). Widgets sourced from CONFIRMED capabilities (rbac.md §3):
 * "Staff Overview" (count + onboarding-status breakdown), "Attendance
 * Today", "Recent Warnings Issued". "Pending Leave Requests" is a PROPOSED
 * widget in the framework doc — whether staff can submit leave requests at
 * all is unresolved (rbac.md §11 question 4), so it is intentionally
 * omitted rather than shown with fabricated data.
 *
 * Outlet scope is reinforced twice — the header wash and a dedicated accent
 * metric tile — since this role is outlet-restricted and must never read as
 * Beeliv-wide. Only aggregate counts appear here; no per-person sensitive
 * fields (NIN, banking) — that's a Staff Detail screen concern, out of
 * scope on a dashboard.
 *
 * Visual pass adapting two Pinterest references ("Nixtio"/Crextio HR
 * dashboard, a "healthy team cultures" concept) into Beeliv's own purple/
 * gold palette — project-lead: "adapt them buh still using our brand
 * colors." Adapted STYLE only (dark contrast card for the one ring widget,
 * color-coded legend rows for the reason breakdown, softer card radius),
 * not every widget those references show: neither reference's welcome
 * banner has a real Beeliv photo/name to put in it (no auth/user-profile
 * data exists yet), and their meetings/activity-feed/shoutouts/
 * compensation/devices widgets have no corresponding confirmed capability
 * in rbac.md — adding those would be fabricating features, which the
 * project rules explicitly rule out. Same "Staff Overview / Attendance
 * Today / Recent Warnings Issued" real widgets as before, re-skinned.
 */
export default function HrDashboardPage() {
  const outlet = "Sample Outlet 1";
  const staff = SAMPLE_STAFF.filter((s) => s.outlet === outlet);
  const incompleteCount = staff.filter((s) => s.documentationStatus === "Incomplete").length;
  const onboardingCount = staff.filter((s) => s.employmentStatus === "Onboarding").length;
  const { present, total } = SAMPLE_ATTENDANCE_TODAY;
  const attendancePercent = Math.round((present / total) * 100);

  const onboardingPercent =
    staff.length > 0 ? Math.round(((staff.length - incompleteCount) / staff.length) * 100) : 0;

  // Outlet-scoped, not all of SAMPLE_WARNINGS — this role is outlet-
  // restricted (rbac.md §3) and must never surface another outlet's staff,
  // even in a warnings list. (Previously unfiltered; only became visible
  // once more than one outlet had warnings on record.)
  const outletStaffNames = new Set(staff.map((s) => s.name));
  const outletWarnings = SAMPLE_WARNINGS.filter((w) => outletStaffNames.has(w.staffName));

  // Category Analysis (real data, not an invented KPI) — count of this
  // outlet's warnings grouped by reason, sorted by count for the bar list.
  const warningsByReason = Object.entries(
    outletWarnings.reduce<Record<string, number>>((acc, w) => {
      acc[w.reason] = (acc[w.reason] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
  const maxReasonCount = Math.max(1, ...warningsByReason.map(([, count]) => count));

  // Qualitative palette for the reason legend rows — the app's existing
  // 5-color chart token set (globals.css --chart-1..5, already tuned to the
  // brand), cycled per reason. Same real per-reason counts as before, just
  // color-coded like a donut legend instead of one flat gold bar.
  const REASON_COLORS = [
    "var(--chart-2)",
    "var(--chart-4)",
    "var(--chart-1)",
    "var(--chart-3)",
    "var(--chart-5)",
  ];

  return (
    <div className="mx-auto max-w-5xl">
      {/* Hero row — Mintora-reference gradient stat card (outlet name +
          headline staff count, this dashboard's one gradient moment,
          replacing the previous flat .bg-brand-wash header) beside a
          donut card mirroring Mintora's "Monthly Growth" ring. Outlet name
          stays the load-bearing fact (rbac.md §3 outlet restriction). */}
      <div className="mb-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <HeroStatCard
          tone="gold"
          eyebrow={
            <>
              <MapPin className="h-3 w-3" /> Assigned HR — Outlet-Scoped
            </>
          }
          title={outlet}
          value={<CountUp value={staff.length} />}
          valueLabel="Staff Assigned"
          caption="Everything below is scoped to your assigned outlet only."
          badge={`${incompleteCount} onboarding incomplete`}
        />
        {/* Dark contrast card — project-lead reference: the "Nixtio"/"PBD"
            dashboards each give their one ring/donut widget a dark navy
            card instead of white, so it reads as the focal metric among
            lighter tiles. Same real onboardingPercent value as before,
            just re-skinned — the ring's white->gold gradient already
            reads clearly against a dark ground. */}
        <Card className="rounded-2xl bg-[color:var(--chart-3)] shadow-sm ring-0">
          <CardContent className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <h2 className="text-sm font-semibold tracking-wide text-white/60 uppercase">
              Onboarding Completion
            </h2>
            <ProgressRing
              value={onboardingPercent}
              size={104}
              tone="gold"
              showCenterLabel
              centerLabelClassName="text-lg font-bold text-white"
            />
            <p className="text-sm text-white/60">
              {staff.length - incompleteCount} of {staff.length} staff complete
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Key metrics — staggered entrance, ~70ms/tile (design-system.md §15). */}
      <div className="mb-4 grid grid-cols-2 gap-3 duo:grid-cols-3 sm:grid-cols-4">
        {[
          <MetricCard
            key="staff"
            icon={Users}
            iconTone="purple-solid"
            chipShape="circle"
            label="Staff Overview"
            value={<CountUp value={staff.length} />}
            caption={`${incompleteCount} onboarding incomplete · ${onboardingCount} onboarding total`}
          />,
          <MetricCard
            key="attendance"
            icon={Clock}
            iconTone="purple-solid"
            chipShape="circle"
            label="Attendance Today"
            value={
              <>
                <CountUp value={present} /> / {total}
              </>
            }
            caption={<Progress value={attendancePercent} className="mt-1" />}
          />,
          <MetricCard
            key="warnings"
            icon={AlertTriangle}
            iconTone="destructive-solid"
            chipShape="circle"
            label="Recent Warnings Issued"
            value={<CountUp value={outletWarnings.length} />}
            caption="This period"
          />,
          <MetricCard
            key="scope"
            icon={MapPin}
            iconTone="purple-solid"
            chipShape="circle"
            label="Outlet Scope"
            value={<span className="text-sm font-medium">{outlet}</span>}
            caption="Your assigned outlet — you don't have visibility into other outlets."
            accent
          />,
        ].map((card, i) => (
          <div key={card.key} className="animate-fade-up" style={{ animationDelay: `${i * 70}ms` }}>
            {card}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="rounded-2xl shadow-sm ring-0">
          <CardContent>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Recent Warnings Issued
            </h2>
            {outletWarnings.length > 0 ? (
              <ul className="m-0 list-none space-y-2.5 p-0">
                {outletWarnings.map((warning) => (
                  <li
                    key={warning.id}
                    className="flex items-start justify-between gap-3 border-b border-border pb-2.5 last:border-0 last:pb-0"
                  >
                    <div>
                      <div className="text-sm font-semibold text-foreground">{warning.staffName}</div>
                      <div className="mt-0.5 text-sm text-muted-foreground">{warning.reason}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge label="Warning" tone="danger" />
                      <span className="text-sm font-medium text-muted-foreground">{warning.date}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No warnings on record.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* "Team Snapshot" — the Jobie reference's per-person profile-
              stats card (project-lead: "you can see how they placed the
              profile??"). No real logged-in user/photo data exists yet
              (Stage 1, no auth), so this stays an explicit "Coming in
              Stage 2" placeholder rather than a fabricated name/photo/
              stats. Moved here (this sidebar column, alongside Quick
              Actions/Warnings by Reason) instead of its own full-width
              row — capping its width there left a dead empty gap next to
              it (project-lead: "we can't leave a dead space here"); this
              column is already the narrow one, so the card is naturally
              profile-card-proportioned without a special max-width hack. */}
          <PlaceholderWidgetCard
            icon={User}
            title="Team Snapshot"
            description="A per-user profile summary will live here once account/auth data exists (Stage 2)."
          />

          <Card className="rounded-2xl shadow-sm ring-0">
            <CardContent>
              <h2 className="mb-2.5 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Quick Actions
              </h2>

              {/* Mobile: horizontal icon-grid actions (project-lead's
                  synthesized mobile reference — the "banking/wallet app"'s
                  Top-up/Transfer/Received/Send row) instead of stacked
                  full-width buttons, which read as heavy on a phone.
                  Desktop (sm: and up) keeps the original stacked buttons —
                  a row of two icons alone would look sparse/unbalanced at
                  that width. */}
              <div className="flex gap-6 sm:hidden">
                <Link href="/hr/staff" className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="flex size-12 items-center justify-center rounded-full bg-[color:var(--tone-gold)] text-white shadow-[2px_2px_5px_rgba(0,0,0,0.18),-1px_-1px_4px_rgba(255,255,255,0.25)]">
                    <Users className="h-5 w-5" strokeWidth={2.25} />
                  </span>
                  <span className="text-xs font-medium text-foreground">View Staff</span>
                </Link>
                <Link href="/hr/reports" className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="flex size-12 items-center justify-center rounded-full bg-muted text-foreground shadow-[2px_2px_5px_rgba(0,0,0,0.1),-1px_-1px_4px_rgba(255,255,255,0.7)]">
                    <FileBarChart className="h-5 w-5" strokeWidth={2.25} />
                  </span>
                  <span className="text-xs font-medium text-foreground">Reports</span>
                </Link>
              </div>

              <div className="hidden flex-col gap-2 sm:flex">
                {/* bg matches this dashboard's own nav color (navTone="gold"
                    on AppShell, app/hr/layout.tsx) — project-lead: primary
                    actions should read as belonging to their dashboard. */}
                <Link href="/hr/staff" className={DASHBOARD_ACCENT_BG.gold}>
                  View Staff List
                  <ArrowRight data-icon="inline-end" />
                </Link>
                <Link href="/hr/reports" className={buttonVariants({ variant: "outline" })}>
                  Generate Report
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Analytics section — Category Analysis (real per-reason counts,
              not an invented KPI), deliberately a compact bar list rather
              than another chart/donut so this dashboard doesn't read as one
              repeated widget shape (project-lead: "you don't have to use
              same design for all dashboards"). */}
          {warningsByReason.length > 0 ? (
            <Card className="rounded-2xl shadow-sm ring-0">
              <CardContent>
                <h2 className="mb-2.5 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                  Warnings by Reason
                </h2>
                <ul className="m-0 list-none space-y-2 p-0">
                  {warningsByReason.map(([reason, count], i) => {
                    const color = REASON_COLORS[i % REASON_COLORS.length];
                    return (
                      <li key={reason} className="flex items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="w-24 shrink-0 truncate text-sm text-muted-foreground">{reason}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${(count / maxReasonCount) * 100}%`, backgroundColor: color }}
                          />
                        </span>
                        <span className="w-4 shrink-0 text-right text-sm font-semibold text-foreground">
                          {count}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
