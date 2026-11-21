import type { Metadata } from "next";
import { AuthStandalone } from "@/components/public/auth/AuthStandalone";
import { VerifySignIn } from "@/components/admin/setup/VerifySignIn";

export const metadata: Metadata = { title: "Verify sign-in", robots: { index: false, follow: false } };
export default function Page() { return <AuthStandalone><VerifySignIn /></AuthStandalone>; }
