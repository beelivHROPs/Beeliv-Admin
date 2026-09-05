import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeading } from "@/components/shared/PageHeading";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SAMPLE_STAFF } from "@/lib/placeholder-data";

export const metadata: Metadata = { title: "Staff" };

/**
 * Mobile fix: this was a plain `<table>` with no responsive variant, same
 * bug class as the other cramped-mobile layouts fixed this session — four
 * columns (Name/Position/Documentation/Status) squeezed into a phone width
 * forces every cell to wrap across 2-3 lines. A table just isn't the right
 * shape for a phone here; below `sm:` this renders each row as its own
 * tappable card instead (name/position + both status badges, no separate
 * "View" link needed since the whole card is the tap target). The table
 * itself is unchanged above `sm:`, where columns have room.
 */
export default function HrStaffListPage() {
  return (
    <div>
      <PageHeading title="Staff" description="Sample Outlet 1" />

      <div className="flex flex-col gap-3 sm:hidden">
        {SAMPLE_STAFF.map((s) => (
          <Link
            key={s.id}
            href={`/hr/staff/${s.id}`}
            className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-4"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.position}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <StatusBadge
                  label={s.documentationStatus}
                  tone={s.documentationStatus === "Complete" ? "success" : "warning"}
                />
                <StatusBadge
                  label={s.employmentStatus}
                  tone={s.employmentStatus === "Active" ? "success" : "info"}
                />
              </div>
            </div>
            <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card sm:block">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/50 text-left text-xs font-medium uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Position</th>
              <th className="px-4 py-2">Documentation</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {SAMPLE_STAFF.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2 text-foreground">{s.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{s.position}</td>
                <td className="px-4 py-2">
                  <StatusBadge
                    label={s.documentationStatus}
                    tone={
                      s.documentationStatus === "Complete"
                        ? "success"
                        : "warning"
                    }
                  />
                </td>
                <td className="px-4 py-2">
                  <StatusBadge
                    label={s.employmentStatus}
                    tone={s.employmentStatus === "Active" ? "success" : "info"}
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/hr/staff/${s.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
