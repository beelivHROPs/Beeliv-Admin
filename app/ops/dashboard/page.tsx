import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, Building2, ClipboardList, Globe, MapPin, TrendingUp, User, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { MetricCard } from "@/components/shared/MetricCard";
import { CountUp } from "@/components/shared/CountUp";
import { PipelineBarChart } from "@/components/shared/PipelineBarChart";
import { ProgressRing } from "@/components/shared/ProgressRing";
import { HeroStatCard } from "@/components/shared/HeroStatCard";
import { PlaceholderWidgetCard } from "@/components/shared/PlaceholderWidgetCard";
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
 *
 * Visual pass matching the HR dashboard's adapted Pinterest reference
 * (app/hr/dashboard/page.tsx's doc comment) — same dark contrast card for
 * the one ring widget, same rounded-2xl/shadow-sm card treatment, same
 * circular icon chips. "Staff Distribution by Outlet" already had
 * color-coded legend rows before this pass (SEGMENT_COLORS), so it's
 * unchanged here.
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
        <Card className="rounded-2xl border-none bg-[color:var(--chart-3)] shadow-sm">
          <CardContent className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <h2 className="text-sm font-semibold tracking-wide text-white/60 uppercase">
              Pipeline Progress
            </h2>
            <ProgressRing
              value={advancedPercent}
              size={104}
              tone="purple"
              showCenterLabel
              centerLabelClassName="text-lg font-bold text-white"
            />
            <p className="text-sm text-white/60">
              {advancedCount} of {pipelineTotal} applicants past initial application
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Key metrics — staggered entrance, ~70ms/tile (design-system.md §15).
          Pulled back from solid-fill tiles (project-lead: "doesn't look
          good, just looks like a bunch of modals or cards" — four
          consecutive solid blocks, with --tone-gold being the same purple
          as --primary in this token setup, read as one repetitive wall of
          purple rather than a rich dashboard). Back to light cards with a
          colored icon chip, same language HR already uses — the hero card
          and the dark Pipeline Progress ring stay as the two bold accent
          moments instead of competing with four more. Same real counts as
          before, just less visual weight. */}
      <div className="mb-4 grid grid-cols-2 gap-3 duo:grid-cols-3 sm:grid-cols-4">
        {[
          <MetricCard
            key="staff"
            icon={Users}
            iconTone="purple-solid"
            chipShape="circle"
            label="Total Staff"
            value={<CountUp value={totalStaff} />}
            caption="Across all outlets"
          />,
          <MetricCard
            key="outlets"
            icon={Building2}
            iconTone="purple-solid"
            chipShape="circle"
            label="Outlets"
            value={<CountUp value={SAMPLE_OUTLETS_COUNT} />}
            caption="Beeliv-wide"
          />,
          <MetricCard
            key="orgs"
            icon={Briefcase}
            iconTone="purple-solid"
            chipShape="circle"
            label="Client Organizations"
            value={<CountUp value={SAMPLE_CLIENT_ORGANIZATIONS_COUNT} />}
            caption="Active clients"
          />,
          <MetricCard
            key="positions"
            icon={ClipboardList}
            iconTone="purple-solid"
            chipShape="circle"
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

      {/* "Team Snapshot" / "Recruitment Trend" — the Jobie reference's
          per-person profile-stats card and its wavy weekly trend chart.
          Neither has real data behind it yet: Team Snapshot needs a real
          logged-in user (no auth/user-profile data exists in Stage 1) and
          is arguably a Staff "My Profile" concept anyway, not an Ops-wide
          one; Recruitment Trend needs real week-by-week historical
          numbers (SAMPLE_RECRUITMENT_PIPELINE is only current stage
          totals). Project-lead: "put the placeholders and we'll do the
          functionality in stage 2" — explicit "Coming in Stage 2" cards
          instead of fabricated numbers filling the shape. Split 1fr/2fr,
          not an even 50/50 (project-lead: "the recruitment trend should
          be bigger than the profile just like our reference") — Jobie's
          own profile card is a narrow column next to a noticeably wider
          chart card, not an equal pair. */}
      <div className="mb-4 grid gap-4 sm:grid-cols-[1fr_2fr]">
        <PlaceholderWidgetCard
          icon={User}
          title="Team Snapshot"
          description="A per-user profile summary will live here once account/auth data exists (Stage 2)."
        />
        <PlaceholderWidgetCard
          icon={TrendingUp}
          title="Recruitment Trend"
          description="Week-by-week application/interview trends will appear here once historical pipeline tracking is built (Stage 2)."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="rounded-2xl shadow-sm ring-0">
          <CardContent>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
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
              className={buttonVariants({ variant: "outline", className: "mt-2 rounded-full" })}
            >
              View Recruitment Pipeline
            </Link>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-2xl shadow-sm ring-0">
            <CardContent>
              <h2 className="mb-2.5 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Quick Actions
              </h2>

              {/* Mobile: horizontal icon-grid actions (same pattern as
                  HR's — project-lead's synthesized mobile reference, the
                  "banking/wallet app"'s icon-row). Desktop keeps the
                  stacked buttons. */}
              <div className="flex gap-6 sm:hidden">
                <Link href="/ops/organizations" className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="flex size-12 items-center justify-center rounded-full bg-primary text-white shadow-[2px_2px_5px_rgba(0,0,0,0.18),-1px_-1px_4px_rgba(255,255,255,0.25)]">
                    <Building2 className="h-5 w-5" strokeWidth={2.25} />
                  </span>
                  <span className="text-xs font-medium text-foreground">Organizations</span>
                </Link>
                <Link href="/ops/staff" className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="flex size-12 items-center justify-center rounded-full bg-muted text-foreground shadow-[2px_2px_5px_rgba(0,0,0,0.1),-1px_-1px_4px_rgba(255,255,255,0.7)]">
                    <Users className="h-5 w-5" strokeWidth={2.25} />
                  </span>
                  <span className="text-xs font-medium text-foreground">Staff Directory</span>
                </Link>
              </div>

              <div className="hidden flex-col gap-2 sm:flex">
                <Link href="/ops/organizations" className={buttonVariants({ className: "rounded-full" })}>
                  View Client Organizations
                </Link>
                <Link
                  href="/ops/staff"
                  className={buttonVariants({ variant: "outline", className: "rounded-full" })}
                >
                  View Global Staff Directory
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm ring-0">
            <CardContent>
              <h2 className="mb-2.5 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
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
            <Card className="rounded-2xl shadow-sm ring-0">
              <CardContent>
                <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                  Staff Distribution by Outlet
                </h2>
                {/* Callout badge over the largest outlet's segment — same
                    idea as a reference dashboard's highlighted-bar tooltip,
                    adapted to a real value from staffByOutlet (already
                    sorted descending, so index 0 is the largest) instead
                    of an invented one. */}
                <div className="relative pt-6">
                  <div
                    className="absolute top-0 flex justify-center"
                    style={{ left: 0, width: `${(staffByOutlet[0][1] / totalStaff) * 100}%` }}
                  >
                    <span className="whitespace-nowrap rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background shadow-sm">
                      {staffByOutlet[0][1]} at {staffByOutlet[0][0]}
                    </span>
                  </div>
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
                </div>
                <ul className="mt-3 space-y-1.5">
                  {staffByOutlet.map(([outletName, count], i) => (
                    <li key={outletName} className="flex items-center justify-between gap-2 text-sm">
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

      {/* "Recommended Jobs" from the reference, built with real data
          (SAMPLE_JOB_LISTINGS — the same listings the public /positions
          pages show), unlike the two placeholders above. */}
      {SAMPLE_JOB_LISTINGS.length > 0 ? (
        <div className="mt-4">
          <h2 className="mb-2.5 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Open Positions
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {SAMPLE_JOB_LISTINGS.map((job) => (
              <Card key={job.id} className="rounded-xl shadow-none ring-0 sm:rounded-2xl sm:shadow-sm">
                <CardContent>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{job.title}</h3>
                    <Briefcase className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.25} />
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {job.location}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{job.summary}</p>
                  <Link
                    href={`/positions/${job.id}`}
                    className="mt-3 inline-flex items-center text-sm font-medium text-primary hover:underline"
                  >
                    View Posting →
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
