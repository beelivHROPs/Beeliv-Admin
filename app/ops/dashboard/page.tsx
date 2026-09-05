import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, Building2, ClipboardList, Globe, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { MetricCard } from "@/components/shared/MetricCard";
import { CountUp } from "@/components/shared/CountUp";
import { PipelineBarChart } from "@/components/shared/PipelineBarChart";
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

  return (
    <div className="mx-auto max-w-5xl">
      {/* Welcome header — Beeliv-wide scope is the load-bearing fact here
          (rbac.md §5: the only role without an outlet boundary), so it gets
          the same visual weight the other dashboards give their scope. */}
      <div className="bg-brand-wash mb-5 rounded-2xl px-4 py-5 sm:px-6">
        <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold tracking-wide text-warning uppercase">
          <Globe className="h-3 w-3" /> Head of Operations — Beeliv-Wide
        </p>
        <h1 className="font-heading text-2xl font-semibold text-foreground">All Outlets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Organization-wide overview — every client organization and outlet, unrestricted.
        </p>
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
        </div>
      </div>
    </div>
  );
}
