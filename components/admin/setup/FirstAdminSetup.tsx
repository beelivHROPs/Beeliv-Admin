"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Field = "code" | "password" | "confirmation";
const RED = "#C8102E";
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** Field errors shown under each box, in red. Empty string = no error. */
function check(code: string, password: string, confirmation: string): Record<Field, string> {
  return {
    code: code.trim() ? "" : "Enter the setup code you were given separately.",
    password: password.length >= 12 ? "" : "Use at least 12 characters.",
    confirmation: !confirmation ? "Type the same password again." : confirmation !== password ? "The two passwords don't match." : "",
  };
}

export function FirstAdminSetup() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [linkMissing, setLinkMissing] = useState(false);
  const [tried, setTried] = useState(false);
  const [touched, setTouched] = useState<Record<Field, boolean>>({ code: false, password: false, confirmation: false });
  /** Bumped on every failed submit so the shake replays. */
  const [shake, setShake] = useState(0);

  // Tell the person straight away when the link they opened is incomplete (the secret after "#" is missing).
  useEffect(() => {
    const id = window.setTimeout(() => setLinkMissing(!TOKEN.test(window.location.hash.slice(1))), 0);
    return () => window.clearTimeout(id);
  }, []);

  const errors = check(code, password, confirmation);
  // Live: the mismatch shows as soon as the second box is filled; other errors after leaving a box or pressing Continue.
  const show = (f: Field) => (tried || touched[f] || (f === "confirmation" && confirmation.length > 0)) && errors[f] ? errors[f] : "";
  const fail = (message: string) => { setError(message); setShake((n) => n + 1); };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setTried(true);
    const token = window.location.hash.slice(1);
    if (!TOKEN.test(token)) { setLinkMissing(true); return fail("This page was opened without the full setup link. Open the complete link you were sent (it ends with a long code after #), then try again."); }
    if (errors.code || errors.password || errors.confirmation) return fail("Please fix the highlighted fields.");
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/first-admin", { method: "POST", credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, code: code.trim(), password }), signal: AbortSignal.timeout(45000) });
      const result = await response.json();
      if (!response.ok || result.ok !== true || result.destination !== "/admin/setup") throw new Error("setup_unconfirmed");
      setCode(""); setPassword(""); setConfirmation("");
      window.history.replaceState(null, "", "/admin/first-setup");
      router.replace("/admin/setup");
    } catch { fail("We couldn't confirm setup. Check your link and separate code, then retry with the same password. You can also try signing in if your account was created."); }
    finally { setBusy(false); }
  }

  const input = (f: Field) => `ap-input mt-2 block w-full ${show(f) ? "border-[#C8102E]! ring-1 ring-[#C8102E]/30" : ""}`;
  const note = (f: Field) => show(f) ? <span id={`fa-${f}-err`} className="mt-1.5 block text-[13px] font-semibold" style={{ color: RED }}>{show(f)}</span> : null;
  const leave = (f: Field) => () => setTouched((t) => ({ ...t, [f]: true }));

  return <main className="mx-auto flex min-h-screen max-w-lg items-center px-5 py-12">
    <form key={shake} onSubmit={submit} noValidate className={`w-full space-y-5 rounded-3xl border border-(--ap-line-2) bg-(--ap-surface) p-6 ${shake ? "ap-shake" : ""}`}>
      <h1 className="text-3xl font-bold">Set up your Admin account</h1>
      <p className="text-sm text-(--ap-muted)">Enter the code provided separately from your setup link and choose a password. Next, complete your details, agreements and authenticator setup.</p>
      {linkMissing ? <p role="alert" className="rounded-xl px-3.5 py-3 text-sm font-semibold" style={{ color: RED, background: "#FDECEE" }}>This page was opened without the full setup link. Open the complete link you were sent: it ends with a long code after <b>#</b>.</p> : null}
      <label className="block text-sm font-semibold">Setup code<input autoComplete="off" spellCheck={false} className={input("code")} value={code} maxLength={16} disabled={busy} onBlur={leave("code")} onChange={e => setCode(e.target.value)} aria-invalid={Boolean(show("code"))} aria-describedby={show("code") ? "fa-code-err" : undefined} />{note("code")}</label>
      <label className="block text-sm font-semibold">Password<input type="password" autoComplete="new-password" maxLength={256} className={input("password")} value={password} disabled={busy} onBlur={leave("password")} onChange={e => setPassword(e.target.value)} aria-invalid={Boolean(show("password"))} aria-describedby={show("password") ? "fa-password-err" : undefined} />{note("password")}</label>
      <label className="block text-sm font-semibold">Confirm password<input type="password" autoComplete="new-password" maxLength={256} className={input("confirmation")} value={confirmation} disabled={busy} onBlur={leave("confirmation")} onChange={e => setConfirmation(e.target.value)} aria-invalid={Boolean(show("confirmation"))} aria-describedby={show("confirmation") ? "fa-confirmation-err" : undefined} />{note("confirmation")}</label>
      {error ? <p role="alert" className="text-sm font-semibold" style={{ color: RED }}>{error}</p> : null}
      <button type="submit" disabled={busy} className="ap-btn ap-btn-p w-full">{busy ? "Setting up…" : "Continue setup"}</button>
      <a className="block text-center text-sm underline" href="/admin/login">Already started? Sign in</a>
    </form>
  </main>;
}
