"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { AdminAvatar } from "@/components/admin/AdminAvatar";
import type { RowMenuItem } from "@/components/admin/overview/RowMenu";
import { X } from "@/components/applicant/icons";
import { StatusChip } from "@/components/client/StatusChip";
import { formatRelativePast } from "@/lib/applicant/time";
import type { AccessRow } from "@/lib/admin/team-access/types";
import { ACCOUNT_LABEL, ACCOUNT_TONE } from "./meta";

/**
 * Person details in the SAME approved side panel as Invitation details / Assignment details: 380px right drawer
 * (bottom sheet on phones), header with close, uppercase field labels, actions at the bottom. Shows only what the
 * live list row already carries; the actions are exactly the row's three-dot menu items (same handlers).
 * Lead 2026-11-24: most cards should be clickable and open details without leaving the page.
 */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[13px] font-bold tracking-wide text-(--ap-muted) uppercase">{label}</div>
      <div className="text-[15px] wrap-anywhere">{children}</div>
    </div>
  );
}

export function PersonDetailsSheet({ row, roleHead, scopeHead, actions, onClose }: { row: AccessRow; roleHead: string; scopeHead: string; actions: RowMenuItem[]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const btn = (it: RowMenuItem) => `ap-btn min-w-[calc(50%-5px)] flex-1 ${it.tone === "danger" ? "ap-btn-danger" : "ap-btn-o"}`;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Person details">
      <button type="button" aria-label="Close details" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-y-0 right-0 flex w-[min(380px,100vw)] flex-col bg-white shadow-2xl max-[719px]:inset-x-0 max-[719px]:top-auto max-[719px]:max-h-[85dvh] max-[719px]:w-full max-[719px]:rounded-t-2xl max-[719px]:pb-[env(safe-area-inset-bottom,0px)]">
        <span className="mx-auto mt-2 hidden h-1 w-10 rounded-full bg-(--ap-line) max-[719px]:block" aria-hidden="true" />
        <div className="flex items-center justify-between border-b border-(--ap-line) px-4 py-3">
          <h2 className="m-0 text-[17px] font-extrabold">Person details</h2>
          <button type="button" autoFocus onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-(--ap-line-2)" aria-label="Close details">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-5 p-4">
            <div className="flex items-center gap-3">
              <AdminAvatar name={row.name} photoUrl={row.photoUrl} size={44} />
              <div className="min-w-0 leading-tight">
                <b className="block truncate text-[16px]">{row.name}</b>
                {row.jobTitle ? <span className="mt-0.5 block truncate text-[13px] font-semibold text-(--ap-ink-2)">{row.jobTitle}</span> : null}
                {row.reference ? <span className="mt-0.5 block truncate text-[13px] text-(--ap-muted)">{row.reference}</span> : null}
              </div>
            </div>
            <Field label="Email">{row.email || "Not set"}</Field>
            <Field label={roleHead}>{row.roleLabel || "Not set"}</Field>
            <Field label={scopeHead}>{row.scopeLabel || "Not set"}</Field>
            <Field label="Status">
              <StatusChip tone={ACCOUNT_TONE[row.status]}>{ACCOUNT_LABEL[row.status]}</StatusChip>
            </Field>
            <Field label="Last active">{row.lastActiveAt ? formatRelativePast(row.lastActiveAt) : "Never"}</Field>
          </div>
        </div>
        {actions.length ? (
          <div className="flex flex-wrap gap-2.5 border-t border-(--ap-line) px-4 py-3">
            {actions.map((it) =>
              it.href ? (
                <Link key={it.label} href={it.href} className={btn(it)}>
                  {it.label}
                </Link>
              ) : (
                <button key={it.label} type="button" className={btn(it)} onClick={() => { onClose(); it.onSelect?.(); }}>
                  {it.label}
                </button>
              ),
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
