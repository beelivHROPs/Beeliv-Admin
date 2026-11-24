"use client";

import { useEffect, useState } from "react";
import { listTeamWire } from "@/lib/auth/service";
import { teamAccessMode } from "@/lib/admin/team-access/mode";

type Person = { name: string; email: string; status: string; outlets: string };
const STATUS: Record<string, string> = { active: "Active", invited: "Invited", suspended: "Suspended", deactivated: "Deactivated" };
const DOT: Record<string, string> = { active: "#3fb27f", invited: "#e3b341", suspended: "#c4566f", deactivated: "#9a8a92" };

/**
 * The REAL client users who can sign in for this client (team-access-read.sql), on live deployments.
 * Readers without Team & Access (HR officers) and previews keep the summary sentence.
 */
export function WhoCanSignIn({ clientName, summary }: { clientName: string; summary: string }) {
  const live = teamAccessMode() === "live";
  const [people, setPeople] = useState<Person[] | null>(null);
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    listTeamWire("client").then((r) => {
      if (cancelled) return;
      if (!r.ok) { setDenied(true); return; }
      const rows = r.items.map((x) => x as Record<string, unknown>).flatMap((x) => {
        const scopes = (Array.isArray(x.scopes) ? x.scopes : []) as Record<string, unknown>[];
        const mine = scopes.filter((s) => s.clientName === clientName);
        if (!mine.length) return [];
        const outlets = mine.map((s) => (typeof s.outletName === "string" && s.outletName ? s.outletName : "All outlets")).join(", ");
        return [{ name: String(x.name ?? ""), email: String(x.email ?? ""), status: String(x.status ?? ""), outlets }];
      });
      setPeople(rows);
    }, () => { if (!cancelled) setDenied(true); });
    return () => { cancelled = true; };
  }, [live, clientName]);

  if (!live || denied) return <p className="text-[14px] leading-snug text-(--ap-ink-2)">{summary || "Client users appear here once they accept their invitation."}</p>;
  if (!people) return <div className="ap-shimmer h-12 rounded-xl" role="status" aria-label="Loading" />;
  if (!people.length) return <p className="text-[14px] leading-snug text-(--ap-muted)">No one from this client can sign in yet. Invite someone from Clients → Invite client.</p>;
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {people.map((p, i) => (
        <li key={i} className="min-w-0">
          <span className="flex items-center gap-2 text-[15px] font-bold"><span aria-hidden="true" className="size-2 rounded-full" style={{ background: DOT[p.status] ?? "#9a8a92" }} />{p.name || p.email}</span>
          <span className="block truncate text-[13px] text-(--ap-muted)">{p.email} · {STATUS[p.status] ?? p.status} · {p.outlets}</span>
        </li>
      ))}
    </ul>
  );
}
