import type { Metadata } from "next";
import { OpsHome } from "@/components/admin/ops/OpsHome";
import { LiveDesignedHome } from "@/components/admin/overview/LiveDesignedHome";
import { sampleDataOn } from "@/lib/env/sample-data";

export const metadata: Metadata = { title: "Operations Home" };

export default function OpsHomePage() {
  return sampleDataOn() ? <OpsHome /> : <LiveDesignedHome variant="ops" />;
}
