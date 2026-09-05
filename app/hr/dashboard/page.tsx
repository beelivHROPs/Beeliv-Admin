import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock, MapPin, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MetricCard } from "@/components/shared/MetricCard";
import { CountUp } from "@/components/shared/CountUp";
import { ProgressRing } from "@/components/shared/ProgressRing";
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
 */
export default function HrDashboardPage() {
  const outlet = "Sample Outlet 1";
  const staff = SAMPLE_STAFF.filter((s) => s.outlet === outlet);
  const incompleteCount = staff.filter((s) => s.documentationStatus === "Incomplete").length;
  const onboardingCount = staff.filter((s) => s.employmentStatus === "Onboarding").length;
  const { present, total } = SAMPLE_ATTENDANCE_TODAY;
  const attendancePercent = Math.round((present / total) * 100);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Welcome header — outlet name is the load-bearing fact on this
          screen (rbac.md §3 outlet restriction), so it's given the same
          visual weight as the applicant portal's greeting. */}
      <div className="bg-brand-wash mb-5 rounded-2xl px-4 py-5 sm:px-6">
        <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold tracking-wide text-warning uppercase">
          <MapPin className="h-3 w-3" /> Assigned HR — Outlet-Scoped
        </p>
        <h1 className="font-heading text-2xl font-semibold text-foreground">{outlet}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything below is scoped to your assigned outlet only.
        </p>
      </div>

      {/* Key metrics — staggered entrance, ~70ms/tile (design-system.md §15). */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          <MetricCard
            key="staff"
            icon={Users}
            iconTone="gold"
            label="Staff Overview"
            value={<CountUp value={staff.length} />}
            caption={`${incompleteCount} onboarding incomplete · ${onboardingCount} onboarding total`}
          />,
          <MetricCard
            key="attendance"
            icon={Clock}
            iconTone="gold"
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
            iconTone="destructive"
            label="Recent Warnings Issued"
            value={<CountUp value={SAMPLE_WARNINGS.length} />}
            caption="This period"
          />,
          <MetricCard
            key="scope"
            icon={MapPin}
            iconTone="gold"
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
        <Card>
          <CardContent>
            <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Recent Warnings Issued
            </h2>
            {SAMPLE_WARNINGS.length > 0 ? (
              <ul className="m-0 list-none space-y-3 p-0">
                {SAMPLE_WARNINGS.map((warning) => (
                  <li
                    key={warning.id}
                    className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <div className="text-sm font-semibold text-foreground">{warning.staffName}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{warning.reason}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge label="Warning" tone="warning" />
                      <span className="font-mono text-[10.5px] text-muted-foreground">{warning.date}</span>
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
          <Card>
            <CardContent>
              <h2 className="mb-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Quick Actions
              </h2>
              <div className="flex flex-col gap-2">
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

          <Card>
            <CardContent>
              <h2 className="mb-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Onboarding Status
              </h2>
              {/* ProgressRing over the plain bar — this outlet's one
                  purple→gold gradient moment (design-system.md §3, see
                  that component's own comment), matching the "high-end
                  data design" pass this session. */}
              <ProgressRing
                value={staff.length > 0 ? Math.round(((staff.length - incompleteCount) / staff.length) * 100) : 0}
                size={64}
                label={
                  <p className="text-xs text-muted-foreground">
                    {staff.length - incompleteCount} of {staff.length} staff have complete
                    documentation.
                  </p>
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
