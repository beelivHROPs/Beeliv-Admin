import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/shared/PageHeading";
import { Card } from "@/components/shared/Card";
import { StatusBadge } from "@/components/shared/StatusBadge";
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
 */
export default async function HrStaffDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const staff = SAMPLE_STAFF.find((s) => s.id === id);

  if (!staff) {
    notFound();
  }

  return (
    <div>
      <Link
        href="/hr/staff"
        className="text-sm font-medium text-blue-600 hover:underline"
      >
        ← Back to Staff
      </Link>

      <PageHeading title={staff.name} description={staff.position} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Profile">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Outlet</dt>
              <dd className="text-gray-900">{staff.outlet}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Position</dt>
              <dd className="text-gray-900">{staff.position}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Status</dt>
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
        </Card>

        <Card title="Documentation">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700">Onboarding documentation</span>
            <StatusBadge
              label={staff.documentationStatus}
              tone={
                staff.documentationStatus === "Complete" ? "success" : "warning"
              }
            />
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <button
          type="button"
          disabled
          title="Not implemented in this slice — requires recruitment/HR authority decisions"
          className="cursor-not-allowed rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-400"
        >
          Issue Warning
        </button>
      </div>
    </div>
  );
}
