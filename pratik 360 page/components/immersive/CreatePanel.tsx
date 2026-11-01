"use client";

import type { ImmersiveHistoryItem } from "@/lib/client/immersive-store";

export interface CreatePanelProps {
  onSaveItem: (item: ImmersiveHistoryItem) => Promise<void>;
  onOpenHistory?: () => Promise<void>;
}

export function CreatePanel() {
  return (
    <div className="immersive-panel" data-testid="create-panel">
      <div className="immersive-panel-card" data-testid="workflow-pwa-studio">
        <div className="immersive-pwa-container">
          <iframe
            src="/api/pwa-studio/index.html"
            title="MIRAS 360° Camera & Studio"
            allow="camera; microphone; gyroscope; accelerometer; magnetometer; geolocation; fullscreen"
            className="immersive-pwa-iframe"
          />
        </div>
      </div>
    </div>
  );
}
