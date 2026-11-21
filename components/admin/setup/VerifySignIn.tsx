"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { AuthFrame, AuthBody } from "@/components/public/auth/AuthFrame";
import { AuthHeading } from "@/components/public/auth/parts";
import { MfaPanel } from "./MfaPanel";
import { createAdminSetupService } from "@/lib/admin/setup/service";
import { getAccountSetup, getSession, signOut } from "@/lib/auth/service";
import { returningAdminNeedsMfa } from "@/lib/auth/admin-entry";
import { destinationFor, hasAccess, readAccess } from "@/lib/server/auth/policy";
import { setupErrorText } from "@/lib/admin/setup/types";

/** A returning sign-in, not another first-run setup. All authority stays on server. */
export function VerifySignIn() {
  const router = useRouter();
  const service = useMemo(() => createAdminSetupService("live"), []);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const working = useRef(false);
  const active = useRef(false);
  const mfaBusy = useRef(false);
  const [checkingCode, setCheckingCode] = useState(false);
  const onMfaBusy = useCallback((busy: boolean) => {
    mfaBusy.current = busy;
    if (active.current) setCheckingCode(busy);
  }, []);

  const complete = useCallback(async () => {
    if (working.current) return;
    working.current = true; setFinishing(true); setError(null);
    try {
      const setup = await service.getSetup();
      if (!active.current) return;
      if (setup.state !== "active") {
        const result = await service.finish();
        if (!active.current) return;
        if (!result.ok) { router.replace("/admin/setup"); return; }
      }
      // Never navigate as authenticated solely from a client callback/code success.
      const session = await getSession("admin");
      if (!active.current) return;
      const access = session.ok === true ? readAccess("access" in session ? session.access : null, "admin") : null;
      if (!hasAccess(access) || !access) throw new Error("unavailable");
      router.replace(destinationFor(access)); router.refresh();
    } catch (e) { if (active.current) setError(setupErrorText(e, "We couldn't finish signing you in. Please try again.")); }
    finally { working.current = false; if (active.current) setFinishing(false); }
  }, [router, service]);

  const load = useCallback(() => getAccountSetup("admin").then(async result => {
    if (!active.current) return;
    setError(null);
    if (!result.ok) {
      if (result.reason === "unauthenticated") router.replace("/admin/login");
      else setError(result.error.message);
      return;
    }
    if (result.setup.mfaVerified) { await complete(); return; }
    if (returningAdminNeedsMfa(result.setup)) setReady(true);
    else router.replace("/admin/setup");
  }), [router, complete]);
  useEffect(() => { active.current = true; void load(); return () => { active.current = false; }; }, [load]);

  return <AuthFrame screen="login" portal="admin"><div className="contents" style={{
    "--ap-surface": "#ffffff", "--ap-ink": "#11111b", "--ap-ink-2": "#3b1828",
    "--ap-muted": "#61535b", "--ap-line": "#9b8e95", "--ap-violet": "#8b2252",
    "--ap-rose": "#b42318", "--ap-rose-bg": "#fff1f0",
  } as CSSProperties}><AuthBody as="div" ariaBusy={finishing}>
    <AuthHeading lead="Enter your" accent="code." sub="Type the 6-digit code from your authenticator app." />
    {ready && !finishing ? <MfaPanel service={service} onVerified={() => void complete()} onBusyChange={onMfaBusy} embedded signIn /> : !error ? <p role="status">Checking your sign-in...</p> : null}
    {error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => void load()} className="ap-btn ap-btn-s mt-3">Try again</button></div> : null}
    <button type="button" disabled={finishing || checkingCode} className="text-sm underline" onClick={() => {
      if (working.current || mfaBusy.current) return;
      working.current = true; setFinishing(true);
      void signOut("admin").then(result => {
        if (!active.current) return;
        if (result.ok) { router.replace("/admin/login"); router.refresh(); }
        else setError(result.error.message);
      }).finally(() => { working.current = false; if (active.current) setFinishing(false); });
    }}>Sign out</button>
  </AuthBody></div></AuthFrame>;
}
