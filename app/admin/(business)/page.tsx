import type { Metadata } from "next";
import { OverviewBody } from "@/components/admin/overview/OverviewBody";
import { LiveDesignedHome } from "@/components/admin/overview/LiveDesignedHome";
import { sampleDataOn } from "@/lib/env/sample-data";

export const metadata: Metadata = { title: "Home" };

export default function AdminOverviewPage() {
  return sampleDataOn() ? <OverviewBody /> : <LiveDesignedHome variant="hr" />;
}
