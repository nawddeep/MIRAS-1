import type { Metadata } from "next";
import { ImmersiveLauncher, type TopTab } from "@/components/immersive/ImmersiveLauncher";

export const metadata: Metadata = {
  title: "360° & VR Studio · MIRAS",
  description:
    "Import or create equirectangular 360° panoramas and preview them in immersive 360° or VR-style headset view.",
};

export default async function Immersive360Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const initialTab: TopTab =
    params?.tab === "import" ? "import" : params?.tab === "history" ? "history" : "create";
  return <ImmersiveLauncher initialTab={initialTab} />;
}
