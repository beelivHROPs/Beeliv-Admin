"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isSampleAdminRoute } from "@/lib/admin/sample-routes";
import { teamAccessMode } from "@/lib/admin/team-access/mode";
import { ComingSoonScreen } from "@/components/shared/ComingSoonScreen";
import { HR_NAV_ITEMS, OPS_NAV_ITEMS } from "@/components/admin/nav";

const VACANCIES_LIVE = process.env.NEXT_PUBLIC_VACANCIES_BACKEND_ENABLED === "true";

/**
 * Live deployments (`on` is decided on the server: true when sample data is NOT allowed, i.e. production).
 * Lead rule 2026-11-21: real users see REAL data or "Coming soon", never sample data. A page that is not connected to
 * Beeliv records yet (lib/admin/sample-routes.ts) renders the Coming soon screen instead of its sample content.
 * Local previews keep every approved screen with its sample data.
 */
export function SampleDataBanner({ on, children }: { on: boolean; children?: ReactNode }) {
  const pathname = usePathname();
  if (!on || !isSampleAdminRoute(pathname, VACANCIES_LIVE, teamAccessMode() === "live")) return <>{children}</>;
  const under = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const item = [...HR_NAV_ITEMS, ...OPS_NAV_ITEMS].filter((n) => n.href !== "/admin" && n.href !== "/admin/ops" && under(n.href)).sort((a, b) => b.href.length - a.href.length)[0];
  // Dropdown pages (e.g. Recruitment > Interviews) are titled by their own name, not the dropdown's.
  const child = HR_NAV_ITEMS.flatMap((n) => n.children ?? []).filter((c) => under(c.href)).sort((a, b) => b.href.length - a.href.length)[0];
  return <ComingSoonScreen title={child?.label ?? item?.label ?? "Coming soon"} />;
}
