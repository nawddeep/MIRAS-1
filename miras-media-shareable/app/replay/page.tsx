import { ReplayViewer } from "@/components/ReplayViewer";
import { Label } from "@/components/ui";
import { getLang } from "@/lib/lang-server";

export default async function ReplayPage() {
  const lang = await getLang();
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">360 replay</h1>
      <p className="text-ink-soft">Open a 360 photo you took on your trip and look around it again. Drag to look around; use the full-screen button for a bigger view.</p>
      <ReplayViewer lang={lang} />
      <p className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
        <Label tone="neutral">Not built yet</Label> Headset (stereo) and phone-tilt modes need an extra viewer plugin and have not been added or tested.
        Reconstructed scenes, when added, will be labelled Illustrative.
      </p>
    </div>
  );
}
