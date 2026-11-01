import { OfflineView } from "@/components/OfflineView";
import { getLang } from "@/lib/lang-server";

// This page is pre-cached by the service worker and reads only from IndexedDB, so it works without a connection.
export default async function OfflinePage() {
  const lang = await getLang();
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Offline copies</h1>
      <p className="text-ink-soft">Places, your plan and phrases you saved on this device. These copies do not update until you save again.</p>
      <OfflineView lang={lang} />
    </div>
  );
}
