"use client";

import { useEffect, useState } from "react";
import type { ImmersiveHistoryItem } from "@/lib/client/immersive-store";
import { repairPwaCaptureDb } from "@/lib/client/immersive-store";

export interface CreatePanelProps {
  onSaveItem: (item: ImmersiveHistoryItem) => Promise<void>;
  onOpenHistory?: () => Promise<void>;
}

export function CreatePanel() {
  // The camera must not start until a broken camera database (if any) has been cleared.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void repairPwaCaptureDb().finally(() => setReady(true));
  }, []);

  return (
    <div className="immersive-panel" data-testid="create-panel">
      <div className="immersive-panel-card" data-testid="workflow-pwa-studio">
        <div className="immersive-pwa-container">
          {ready ? (
            <iframe
              src="/api/pwa-studio/index.html"
              title="MIRAS 360° Camera & Studio"
              allow="camera; microphone; gyroscope; accelerometer; magnetometer; geolocation; fullscreen"
              className="immersive-pwa-iframe"
            />
          ) : (
            <p role="status">Starting the camera…</p>
          )}
        </div>
      </div>
    </div>
  );
}
