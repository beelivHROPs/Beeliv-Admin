"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar, ChevronRight, UserRound } from "@/components/applicant/icons";
import { listInvitations } from "@/lib/auth/service";
import type { InvitationListItem } from "@/lib/auth/invitation-management-wire";
import { useLiveAdminProfile } from "@/lib/admin/ops/identity";
import { Flat, FlatEmpty, FLAT_BOX, rowLine } from "./Flat";
import { HOME_METRICS, homeMetricNote, homeMetricText, parseHomeSummary, type HomeMetric, type HomeMetricKey, type HomeSummary } from "./live-home-model";
import "./calm.css";

type State = { status: "loading" | "ready" | "failed" | "wait"; summary: HomeSummary | null; invitations: InvitationListItem[] | null };
const INITIAL: State = { status: "loading", summary: null, invitations: null };
const PHONE_CARD = "overflow-hidden rounded-[24px] bg-(--ap-surface) shadow-[0_8px_24px_rgba(60,30,80,.07)]";
const NEED_KEYS: HomeMetricKey[] = ["documentsAwaitingHr", "staffUnplaced", "pendingInvitations"];
const ROLE_LABEL = { hr_manager: "HR Manager", hr_officer: "HR Officer", head_of_operations: "Head of Operations", client: "Client", talent: "Staff" };

async function readHome(): Promise<State> {
  try {
    const response = await fetch("/api/admin/summary", { cache: "no-store", credentials: "same-origin", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30000) });
    if (response.status === 429) return { ...INITIAL, status: "wait" };
    const summary = response.ok ? parseHomeSummary(await response.json()) : null;
    if (!summary) return { ...INITIAL, status: "failed" };
    let invitations: InvitationListItem[] | null = null;
    if (summary.pendingInvitations.status === "available") {
      try {
        const reply = await listInvitations({ limit: 5 });
        if (reply.ok) invitations = reply.items;
      } catch { /* A failed list stays unavailable, never an invented empty queue. */ }
    }
    return { status: "ready", summary, invitations };
  } catch { return { ...INITIAL, status: "failed" }; }
}

/** The approved Home presentation, fed only by the caller's scoped live services. */
export function LiveDesignedHome({ variant }: { variant: "hr" | "ops" }) {
  const profile = useLiveAdminProfile();
  const [state, setState] = useState<State>(INITIAL);
  const generation = useRef(0);
  const load = useCallback(() => {
    const current = ++generation.current;
    setState(INITIAL);
    void readHome().then(next => { if (generation.current === current) setState(next); });
  }, []);
  const invalidate = useCallback(() => { ++generation.current; }, []);
  useEffect(() => {
    const current = ++generation.current;
    void readHome().then(next => { if (generation.current === current) setState(next); });
    return invalidate;
  }, [invalidate]);
  const firstName = profile?.fullName.trim().split(/\s+/)[0] || "";
  const metric = (key: HomeMetricKey) => state.summary?.[key];
  const status = state.status === "wait" ? "Too many refreshes. Please wait before trying again." : state.status === "failed" ? "We could not load your Home. Try again." : null;
  return <div>
    <h1 className="sr-only">Home</h1>
    <div className="mb-3 flex items-center justify-between gap-3">
      <span className="text-[13px] text-(--ap-muted)">{state.summary ? "Your current records" : "Home"}</span>
      <button type="button" disabled={state.status === "loading"} onClick={load} className="ap-btn ap-btn-s min-h-11 disabled:opacity-50">{state.status === "loading" ? "Refreshing..." : "Refresh"}</button>
    </div>
    {status ? <p role="status" className="mb-4 rounded-[10px] border border-(--ap-line) bg-(--ap-surface) p-4 text-(--ap-muted)">{status}</p> : null}
    <div aria-busy={state.status === "loading"}>
      <div className="calm-home flex flex-col gap-3.5 pb-10 min-[768px]:hidden">
        <div className="flex items-center justify-between gap-3 px-1"><p className="text-[14px] text-(--ap-muted)">{firstName ? `Welcome back, ${firstName}.` : "Welcome back."}</p><Link href="/admin/calendar" aria-label="Open calendar" className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-(--ap-surface) text-(--ap-ink) shadow-[0_4px_12px_rgba(60,30,80,.08)]"><Calendar className="size-[21px]" aria-hidden="true" /></Link></div>
        <div className={`${PHONE_CARD} p-4`}>
          <div className="flex items-center gap-2.5"><span className="inline-flex size-[34px] items-center justify-center rounded-[12px] bg-(--ap-tint) text-(--ap-violet)" aria-hidden="true"><UserRound className="size-[19px]" /></span><span className="text-[14px] font-semibold text-(--ap-muted)">Staff placed</span></div>
          <Link href="/admin/staff/directory" className="block min-h-11"><b className="mt-3 block text-[38px] leading-none font-extrabold text-(--ap-ink) tabular-nums">{homeMetricText(metric("staffPlaced"))}</b><span className="mt-2 block text-[13px] text-(--ap-muted)">{homeMetricNote(metric("staffPlaced"))}</span></Link>
        </div>
        <section aria-label="Today" className="grid min-w-0 grid-cols-2 gap-3">
          <PhoneMetric keyName="documentsAwaitingHr" value={metric("documentsAwaitingHr")} colour="rose" />
          <PhoneMetric keyName="pendingInvitations" value={metric("pendingInvitations")} colour="lilac" />
        </section>
        <section aria-label="Quick numbers" className="grid min-w-0 grid-cols-2 gap-3">
          <PhoneMetric keyName="activeClients" value={metric("activeClients")} />
          <PhoneMetric keyName="activeOutlets" value={metric("activeOutlets")} />
        </section>
        <PhoneMetric keyName="staffUnplaced" value={metric("staffUnplaced")} />
        <Needs summary={state.summary} />
        <RecentInvitations items={state.invitations} loading={state.status === "loading"} />
      </div>
      {variant === "hr" ? <div className="calm-home calm-desktop hidden flex-col gap-6 pb-24 min-[768px]:flex">
        <div className="grid grid-cols-1 gap-6 min-[1241px]:grid-cols-12"><Greeting firstName={firstName} className="min-[1241px]:col-span-7" /><Needs summary={state.summary} className="min-[1241px]:col-span-5" /></div>
        <StatStrip summary={state.summary} />
        <div className="grid grid-cols-1 gap-6 min-[768px]:grid-cols-2 min-[1241px]:grid-cols-12">
          <RecentInvitations items={state.invitations} loading={state.status === "loading"} className="min-[768px]:col-span-2 min-[1241px]:col-span-8" />
          <Unavailable title="Needs attention" className="min-[768px]:col-span-2 min-[1241px]:col-span-4" />
          <Unavailable title="Recruitment pipeline" className="min-[768px]:col-span-2 min-[1241px]:col-span-5" />
          <Unavailable title="Applicants by department" className="min-[1241px]:col-span-3" />
          <Unavailable title="Attendance" className="min-[1241px]:col-span-4" />
          <Unavailable title="Vacancies" className="min-[768px]:col-span-2 min-[1241px]:col-span-8" />
          <Unavailable title="Tasks" className="min-[1241px]:col-span-4" />
          <Unavailable title="Recent activity" className="min-[768px]:col-span-2 min-[1241px]:col-span-8" />
          <div className="flex flex-col gap-6 min-[768px]:col-span-2 min-[1241px]:col-span-4"><Placement summary={state.summary} /><Clients summary={state.summary} /><Unavailable title="Talent pool" /></div>
        </div>
      </div> : <div className="ops-calm hidden flex-col gap-6 pb-24 min-[768px]:flex">
        <Greeting firstName={firstName} />
        <StatStrip summary={state.summary} />
        <div className="grid grid-cols-1 gap-6 min-[1100px]:grid-cols-12"><Needs summary={state.summary} className="min-[1100px]:col-span-7" /><Placement summary={state.summary} className="min-[1100px]:col-span-5" /></div>
        <div className="grid grid-cols-1 gap-6 min-[1100px]:grid-cols-12"><Clients summary={state.summary} className="min-[1100px]:col-span-8" /><Unavailable title="Recruitment snapshot" className="min-[1100px]:col-span-4" /></div>
        <div className="grid grid-cols-1 gap-6 min-[1100px]:grid-cols-12"><RecentInvitations items={state.invitations} loading={state.status === "loading"} className="min-[1100px]:col-span-7" /><Unavailable title="HR workload" className="min-[1100px]:col-span-5" /></div>
      </div>}
    </div>
  </div>;
}

function Greeting({ firstName, className = "" }: { firstName: string; className?: string }) {
  return <section className={`relative flex flex-col overflow-hidden rounded-[10px] border border-(--ap-line) bg-(--ap-tint) p-6 ${className}`}>
    <p className="flex items-center gap-2 text-[11.5px] font-semibold tracking-[.14em] text-(--ap-muted) uppercase"><span aria-hidden="true" className="h-0.5 w-5 rounded-full bg-(--ap-gold)" />Home</p>
    <h2 className="ap-serif mt-3 text-[32px] leading-[1.1] text-(--ap-ink)">{firstName ? `Welcome back, ${firstName}.` : "Welcome back."}</h2>
    <p className="mt-2 text-[15px] leading-[1.5] text-(--ap-ink-2)">Your current records and the work that needs your attention.</p>
    <div className="mt-5 border-t border-(--ap-line) pt-3.5"><h2 className="text-[14px] font-semibold text-(--ap-ink)">Today</h2><FlatEmpty title="No interviews today" description="Interviews you schedule will show here." /></div>
  </section>;
}
function StatStrip({ summary }: { summary: HomeSummary | null }) {
  return <section aria-label="Current records" className={`${FLAT_BOX} grid min-w-0 grid-cols-3 overflow-hidden min-[1100px]:grid-cols-6 min-[768px]:p-0`}>
    {HOME_METRICS.map(t => <Link key={t.key} href={t.href} className="flex min-h-[104px] min-w-0 flex-col justify-center gap-1 border-r border-(--ap-line-2) px-4 py-3 hover:bg-(--ap-tint-soft)"><span className="text-[12px] leading-tight text-(--ap-muted)">{t.label}</span><b className="text-[22px] leading-tight font-semibold text-(--ap-ink) tabular-nums">{homeMetricText(summary?.[t.key])}</b><span className="text-[11.5px] text-(--ap-muted)">{homeMetricNote(summary?.[t.key])}</span></Link>)}
  </section>;
}
function Needs({ summary, className = "" }: { summary: HomeSummary | null; className?: string }) {
  return <Flat title="Needs you today" className={className}><ul className="m-0 list-none p-0">{NEED_KEYS.map((key, i) => {
    const t = HOME_METRICS.find(m => m.key === key)!;
    return <li key={key} className={rowLine(i)}><Link href={t.href} className="flex min-h-14 items-center gap-3 min-[768px]:min-h-11"><b className="w-8 shrink-0 text-right text-[20px] font-semibold text-(--ap-ink) tabular-nums">{homeMetricText(summary?.[key])}</b><span className="min-w-0 flex-1 text-[14px] text-(--ap-ink)">{t.label}<span className="block text-[12px] text-(--ap-muted)">{homeMetricNote(summary?.[key])}</span></span><ChevronRight className="size-4 shrink-0 text-(--ap-faint)" aria-hidden="true" /></Link></li>;
  })}</ul></Flat>;
}
function PhoneMetric({ keyName, value, colour }: { keyName: HomeMetricKey; value?: HomeMetric; colour?: "rose" | "lilac" }) {
  const t = HOME_METRICS.find(m => m.key === keyName)!;
  const style = colour ? { background: colour === "rose" ? "linear-gradient(135deg, #f0a9c9, #c24a86)" : "linear-gradient(135deg, #cdbff7, #9886ea)", color: colour === "rose" ? "#3a0f26" : "#251552", boxShadow: colour === "rose" ? "0 12px 24px rgba(194,74,134,.3)" : "0 12px 24px rgba(152,134,234,.3)" } : undefined;
  return <Link href={t.href} className="block min-w-0"><div className={`${PHONE_CARD} flex h-full min-h-[116px] flex-col p-4 ${colour ? "" : "text-(--ap-ink)"}`} style={style}><p className="flex items-center justify-between gap-1 text-[13.5px] font-bold"><span>{t.label}</span><ChevronRight className="size-4 shrink-0" aria-hidden="true" /></p><b className="mt-auto pt-3 text-[36px] leading-none font-extrabold tabular-nums">{homeMetricText(value)}</b><span className="mt-1.5 text-[12px] font-semibold">{homeMetricNote(value)}</span></div></Link>;
}
function RecentInvitations({ items, loading, className = "" }: { items: InvitationListItem[] | null; loading: boolean; className?: string }) {
  return <Flat title="Recent invitations" href="/admin/team-access" className={className}>{!items ? <FlatEmpty title={loading ? "Loading invitations" : "Invitations are unavailable"} description={loading ? "Please wait." : "Open Team & Access to check your invitations."} /> : items.length === 0 ? <FlatEmpty title="No invitations yet" description="Invitations you can access will appear here." /> : <ul className="m-0 list-none p-0">{items.map((item, i) => <li key={item.id} className={rowLine(i)}><Link href="/admin/team-access" className="flex min-h-14 items-center gap-3 py-2"><span className="min-w-0 flex-1"><b className="block break-words text-[14px] font-semibold text-(--ap-ink)">{item.displayName}</b><span className="text-[12px] text-(--ap-muted)">{ROLE_LABEL[item.role]}</span></span><span className="text-[12px] text-(--ap-muted)">{item.status.replaceAll("_", " ")}</span><ChevronRight className="size-4 shrink-0 text-(--ap-faint)" aria-hidden="true" /></Link></li>)}</ul>}</Flat>;
}
function Placement({ summary, className = "" }: { summary: HomeSummary | null; className?: string }) {
  return <Flat title="Staff placements" href="/admin/staff/assignments" className={className}><p className="py-2 text-[14px] text-(--ap-ink)"><b className="font-semibold tabular-nums">{homeMetricText(summary?.staffPlaced)}</b> placed <span className="text-(--ap-muted)">&middot; {homeMetricNote(summary?.staffPlaced)}</span></p><p className="py-2 text-[14px] text-(--ap-ink)"><b className="font-semibold tabular-nums">{homeMetricText(summary?.staffUnplaced)}</b> not yet placed <span className="text-(--ap-muted)">&middot; {homeMetricNote(summary?.staffUnplaced)}</span></p></Flat>;
}
function Clients({ summary, className = "" }: { summary: HomeSummary | null; className?: string }) {
  return <Flat title="Clients and outlets" href="/admin/clients" className={className}><p className="py-2 text-[14px] text-(--ap-ink)"><b className="font-semibold tabular-nums">{homeMetricText(summary?.activeClients)}</b> active clients <span className="text-(--ap-muted)">&middot; {homeMetricNote(summary?.activeClients)}</span></p><p className="py-2 text-[14px] text-(--ap-ink)"><b className="font-semibold tabular-nums">{homeMetricText(summary?.activeOutlets)}</b> active outlets <span className="text-(--ap-muted)">&middot; {homeMetricNote(summary?.activeOutlets)}</span></p></Flat>;
}
function Unavailable({ title, className = "" }: { title: string; className?: string }) {
  return <Flat title={title} className={className}><FlatEmpty title="Not connected yet" description="Current records will appear here when this feature is available." /></Flat>;
}
