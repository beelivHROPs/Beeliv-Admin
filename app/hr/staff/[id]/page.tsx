import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/shared/PageHeading";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { SAMPLE_STAFF } from "@/lib/placeholder-data";

type Params = { id: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const staff = SAMPLE_STAFF.find((s) => s.id === id);
  return { title: staff ? staff.name : "Staff Member" };
}

/**
 * Assigned HR Staff Detail — docs/architecture/ui-ux-framework.md §4 (major
 * wireframe). Deliberately does NOT show NIN, banking, or other sensitive
 * fields: whether Assigned HR may access them is the single highest-priority
 * unresolved question across the whole project (rbac.md §11, STAGE-1-MASTER-
 * PLAN.md §5 item A.1). Do not add those fields here without that decision.
 *
 * Restyled onto the app's current design-system tokens/Card — this page had
 * never been updated since the raw-gray/blue-600 prototype pass and looked
 * like a different app next to the rest of the dashboard (spacing audit
 * follow-up).
 *
 * Outlet-scoped (rbac.md §3) — direct-URL access to another outlet's staff
 * record now 404s the same as a nonexistent id, rather than leaking full
 * detail (found via a QA sweep: the list page was already filtered by
 * outlet in this same fix, but nothing stopped a direct id lookup here).
 */
const ASSIGNED_OUTLET = "Sample Outlet 1";

export default async function HrStaffDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const staff = SAMPLE_STAFF.find((s) => s.id === id);

  if (!staff || staff.outlet !== ASSIGNED_OUTLET) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/hr/staff"
        className="text-sm font-medium text-primary hover:underline"
      >
        ← Back to Staff
      </Link>

      <PageHeading title={staff.name} description={staff.position} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent>
            <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Profile
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Outlet</dt>
                <dd className="font-medium text-foreground">{staff.outlet}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Position</dt>
                <dd className="font-medium text-foreground">{staff.position}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge
                    label={staff.employmentStatus}
                    tone={
                      staff.employmentStatus === "Active" ? "success" : "info"
                    }
                  />
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Documentation
            </h2>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Onboarding documentation</span>
              <StatusBadge
                label={staff.documentationStatus}
                tone={
                  staff.documentationStatus === "Complete" ? "success" : "warning"
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Button
          type="button"
          variant="outline"
          disabled
          title="Not implemented in this slice — requires recruitment/HR authority decisions"
        >
          Issue Warning
        </Button>
      </div>
    </div>
  );
}
