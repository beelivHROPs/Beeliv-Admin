import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, Building2, ClipboardList, Globe, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { MetricCard } from "@/components/shared/MetricCard";
import { CountUp } from "@/components/shared/CountUp";
import { PipelineBarChart } from "@/components/shared/PipelineBarChart";
import { ProgressRing } from "@/components/shared/ProgressRing";
import { HeroStatCard } from "@/components/shared/HeroStatCard";
import {
  SAMPLE_STAFF,
  SAMPLE_JOB_LISTINGS,
  SAMPLE_RECRUITMENT_PIPELINE,
  SAMPLE_CLIENT_ORGANIZATIONS_COUNT,
  SAMPLE_OUTLETS_COUNT,
} from "@/lib/placeholder-data";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Head of Operations Dashboard — docs/architecture/ui-ux-framework.md §6
 * (major wireframe). Widgets sourced from CONFIRMED capabilities (rbac.md
 * §5): "Organization-wide Overview" (total staff, outlets, open positions —
 * scope CONFIRMED, specific metrics PROPOSED), "Recruitment Pipeline"
 * summary, "Operational Reports" quick links.
 *
 * This is the only role without an outlet boundary — deliberately no
 * single-outlet framing anywhere (unlike Assigned HR/Client): the header
 * reads "All Outlets" / Beeliv-wide, never a specific outlet name.
 */
export default function OpsDashboardPage() {
  const totalStaff = SAMPLE_STAFF.length;
  const openPositions = SAMPLE_JOB_LISTINGS.length;

  // Real derived metric, not an invented KPI: share of the current pipeline
  // that has moved past the initial "Applied" stage into active review.
  const pipelineTotal = SAMPLE_RECRUITMENT_PIPELINE.reduce((sum, s) => sum + s.count, 0);
  const appliedOnly = SAMPLE_RECRUITMENT_PIPELINE.find((s) => s.stage === "Applied")?.count ?? 0;
  const advancedCount = pipelineTotal - appliedOnly;
  const advancedPercent = pipelineTotal > 0 ? Math.round((advancedCount / pipelineTotal) * 100) : 0;

  // Distribution Analysis (real per-outlet counts, not an invented KPI) —
  // Ops is Beeliv-wide, the only role that actually spans multiple outlets,
  // so this is the one dashboard where an outlet breakdown is meaningful.
  const staffByOutlet = Object.entries(
    SAMPLE_STAFF.reduce<Record<string, number>>((acc, s) => {
      acc[s.outlet] = (acc[s.outlet] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
  const SEGMENT_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

  return (
    <div className="mx-auto max-w-5xl">
      {/* Hero row — same gradient hero-stat + donut pattern as the HR
          dashboard (Mintora reference), tone="purple" (default) matching
          Ops's own nav color. "All Outlets" stays the load-bearing fact
          (rbac.md §5: the only role without an outlet boundary). */}
      <div className="mb-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <HeroStatCard
          eyebrow={
            <>
              <Globe className="h-3 w-3" /> Head of Operations — Beeliv-Wide
            </>
          }
          title="All Outlets"
          value={<CountUp value={totalStaff} />}
          valueLabel="Total Staff"
          caption="Organization-wide overview — every client organization and outlet, unrestricted."
          badge={`${openPositions} open positions`}
        />
        <Card>
          <CardContent className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Pipeline Progress
            </h2>
            <ProgressRing
              value={advancedPercent}
              size={104}
              tone="purple"
              showCenterLabel
            />
            <p className="text-xs text-muted-foreground">
              {advancedCount} of {pipelineTotal} applicants past initial application
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Key metrics — staggered entrance, ~70ms/tile (design-system.md §15). */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          <MetricCard
            key="staff"
            icon={Users}
            iconTone="purple"
            label="Total Staff"
            value={<CountUp value={totalStaff} />}
            caption="Across all outlets"
          />,
          <MetricCard
            key="outlets"
            icon={Building2}
            iconTone="purple"
            label="Outlets"
            value={<CountUp value={SAMPLE_OUTLETS_COUNT} />}
            caption="Beeliv-wide"
          />,
          <MetricCard
            key="orgs"
            icon={Briefcase}
            iconTone="purple"
            label="Client Organizations"
            value={<CountUp value={SAMPLE_CLIENT_ORGANIZATIONS_COUNT} />}
            caption="Active clients"
          />,
          <MetricCard
            key="positions"
            icon={ClipboardList}
            iconTone="purple"
            label="Open Positions"
            value={<CountUp value={openPositions} />}
            caption="Across the recruitment pipeline"
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
              Recruitment Pipeline
            </h2>
            {/* Real recharts bar chart (project-lead: "high-end data
                design" for HR/Ops) — purple-to-gold per-stage colors pulled
                from the app's own --chart-1..4 tokens, replacing the
                earlier plain progress-bar list. Same SAMPLE_RECRUITMENT_
                PIPELINE data, nothing invented. */}
            <PipelineBarChart data={SAMPLE_RECRUITMENT_PIPELINE} />
            <Link
              href="/ops/recruitment-pipeline"
              className={buttonVariants({ variant: "outline", className: "mt-2" })}
            >
              View Recruitment Pipeline
            </Link>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent>
              <h2 className="mb-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Quick Actions
              </h2>
              <div className="flex flex-col gap-2">
                <Link href="/ops/organizations" className={buttonVariants()}>
                  View Client Organizations
                </Link>
                <Link href="/ops/staff" className={buttonVariants({ variant: "outline" })}>
                  View Global Staff Directory
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <h2 className="mb-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Operational Reports
              </h2>
              <ul className="m-0 list-none space-y-1.5 p-0 text-sm">
                <li>
                  <Link href="/ops/reports" className="text-primary hover:underline">
                    Reports Overview
                  </Link>
                </li>
                <li>
                  <Link href="/ops/attendance" className="text-primary hover:underline">
                    Attendance (Beeliv-wide)
                  </Link>
                </li>
                <li>
                  <Link href="/ops/warnings" className="text-primary hover:underline">
                    Warnings (Beeliv-wide)
                  </Link>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Analytics section — a single segmented bar rather than another
              bar chart or bar list, so this dashboard doesn't repeat HR's or
              its own Recruitment Pipeline widget's shape (project-lead:
              "you don't have to use same design for all dashboards"). */}
          {totalStaff > 0 ? (
            <Card>
              <CardContent>
                <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Staff Distribution by Outlet
                </h2>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                  {staffByOutlet.map(([outletName, count], i) => (
                    <span
                      key={outletName}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                      style={{
                        width: `${(count / totalStaff) * 100}%`,
                        backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                      }}
                    />
                  ))}
                </div>
                <ul className="mt-3 space-y-1.5">
                  {staffByOutlet.map(([outletName, count], i) => (
                    <li key={outletName} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                        />
                        {outletName}
                      </span>
                      <span className="font-medium text-foreground">
                        {count} · {Math.round((count / totalStaff) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
