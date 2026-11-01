import type { Metadata } from "next";
import "./ar-stories.css";
import { currentMember } from "@/lib/community/http";
import { MeProvider } from "@/lib/ar-stories/useStories";

export const metadata: Metadata = {
  title: "AR & VR stories · MIRAS",
  description: "Share 360° photos, panoramas and videos as 24-hour stories, and view them in 360, VR and AR.",
};

export default async function ArStoriesLayout({ children }: { children: React.ReactNode }) {
  const member = await currentMember();
  return (
    <div className="ar-stories">
      <MeProvider me={member?.id ?? null}>{children}</MeProvider>
    </div>
  );
}
