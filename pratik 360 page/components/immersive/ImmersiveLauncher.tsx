"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloseIcon, ImageIcon, Orbit360Icon } from "@/components/icons";
import {
  deleteImmersiveHistoryItem,
  listImmersiveHistory,
  saveImmersiveHistoryItem,
  type ImmersiveHistoryItem,
} from "@/lib/client/immersive-store";
import { CreatePanel } from "./CreatePanel";
import { HistoryList } from "./HistoryList";
import { ImportPanel } from "./ImportPanel";
import { Viewer360, type ViewerMode } from "./Viewer360";

export type TopTab = "import" | "create" | "history";

export function ImmersiveLauncher({ initialTab = "create" }: { initialTab?: TopTab }) {
  const [activeTab, setActiveTab] = useState<TopTab>(initialTab);
  const [history, setHistory] = useState<ImmersiveHistoryItem[]>([]);
  const [openedHistoryItem, setOpenedHistoryItem] = useState<ImmersiveHistoryItem | null>(null);
  const [openedViewerMode, setOpenedViewerMode] = useState<ViewerMode>("360");
  const [openedWithGyro, setOpenedWithGyro] = useState(false);
  const activeStageRef = useRef<HTMLDivElement>(null);

  const refreshHistory = useCallback(async () => {
    const items = await listImmersiveHistory();
    setHistory(items);
  }, []);

  useEffect(() => {
    let cancelled = false;
    listImmersiveHistory().then((items) => {
      if (!cancelled) setHistory(items);
    });
    const onMessage = (e: MessageEvent) => {
      if (e.data && typeof e.data === "object" && e.data.type === "MIRAS_PWA_UPDATED") {
        void refreshHistory();
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
    };
  }, [refreshHistory]);

  const switchTab = (next: TopTab) => {
    setActiveTab(next);
    if (next === "history") {
      void refreshHistory();
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", next);
      window.history.replaceState({}, "", url.toString());
    } catch {
      // Ignore URL update errors
    }
  };

  const handleSaveItem = async (item: ImmersiveHistoryItem) => {
    await saveImmersiveHistoryItem(item);
    await refreshHistory();
  };

  const handleDeleteItem = async (id: string) => {
    await deleteImmersiveHistoryItem(id);
    if (openedHistoryItem?.id === id) {
      setOpenedHistoryItem(null);
    }
    await refreshHistory();
  };

  const handleSelectHistoryItem = (
    item: ImmersiveHistoryItem,
    mode: ViewerMode,
    withGyro = false
  ) => {
    setOpenedHistoryItem(item);
    setOpenedViewerMode(mode);
    setOpenedWithGyro(withGyro);
    setTimeout(() => {
      activeStageRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  };

  const handleOpenHistory = async () => {
    await refreshHistory();
    switchTab("history");
  };

  return (
    <div className="immersive-screen" data-testid="immersive-screen">
      {/* Compact MIRAS 360° Studio header with top-right Import Panorama button */}
      <header className="immersive-hero-header">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <div className="immersive-hero-badge" style={{ marginBottom: 0 }}>
            <Orbit360Icon size={18} />
            <span>360° STUDIO</span>
          </div>

          <div
            role="tablist"
            aria-label="360 feature mode"
            data-testid="immersive-top-tabs"
            style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}
          >
            <button
              type="button"
              role="tab"
              id="tab-create"
              aria-selected={activeTab === "create"}
              aria-controls="panel-create"
              onClick={() => switchTab("create")}
              data-testid="tab-create"
              className="immersive-secondary-btn"
              style={{
                background: activeTab === "create" ? "#101718" : "#ffffff",
                color: activeTab === "create" ? "#ffffff" : "#101718",
              }}
            >
              360° Camera
            </button>
            <button
              type="button"
              role="tab"
              id="tab-history"
              aria-selected={activeTab === "history"}
              aria-controls="panel-history"
              onClick={() => void handleOpenHistory()}
              data-testid="tab-history"
              className="immersive-secondary-btn"
              style={{
                background: activeTab === "history" ? "#101718" : "#ffffff",
                color: activeTab === "history" ? "#ffffff" : "#101718",
              }}
            >
              History{history.length > 0 ? ` (${history.length})` : ""}
            </button>
            <button
              type="button"
              role="tab"
              id="tab-import"
              aria-selected={activeTab === "import"}
              aria-controls="panel-import"
              onClick={() => switchTab("import")}
              data-testid="tab-import"
              className="immersive-secondary-btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                background: activeTab === "import" ? "#101718" : "#ffffff",
                color: activeTab === "import" ? "#ffffff" : "#101718",
              }}
            >
              <ImageIcon size={15} />
              <span>Import Panorama</span>
            </button>
          </div>
        </div>

        <p style={{ marginTop: "8px", marginBottom: 0 }}>
          Capture a 360° sphere with your camera or import a verified 2:1 panorama.
        </p>
      </header>

      {/* Active view */}
      {activeTab !== "history" && (
        <div
          id={activeTab === "import" ? "panel-import" : "panel-create"}
          role="tabpanel"
          aria-labelledby={activeTab === "import" ? "tab-import" : "tab-create"}
        >
          {activeTab === "import" ? (
            <ImportPanel onSaveItem={handleSaveItem} />
          ) : (
            <CreatePanel />
          )}
        </div>
      )}

      {/* Opened item from History stage */}
      {openedHistoryItem && (
        <section
          ref={activeStageRef}
          className="immersive-opened-history-stage"
          aria-label={`Viewing saved panorama: ${openedHistoryItem.title}`}
          data-testid="history-opened-viewer"
        >
          <div className="immersive-opened-header">
            <div>
              <h2>{openedHistoryItem.title}</h2>
            </div>
            <button
              type="button"
              onClick={() => setOpenedHistoryItem(null)}
              className="immersive-close-btn"
              aria-label="Close saved viewer"
            >
              <CloseIcon size={18} />
              <span>Close</span>
            </button>
          </div>

          <Viewer360
            key={`${openedHistoryItem.id}-${openedWithGyro ? "gyro" : "std"}`}
            src={openedHistoryItem.imageDataUrl}
            title={openedHistoryItem.title}
            mode={openedViewerMode}
            onModeChange={setOpenedViewerMode}
            initialGyro={openedWithGyro}
            hotspots={openedHistoryItem.hotspots}
          />
        </section>
      )}

      {/* Persistent Device-Local History Section */}
      <div id="panel-history" role={activeTab === "history" ? "tabpanel" : undefined}>
        <HistoryList
          items={history}
          activeId={openedHistoryItem?.id}
          onSelect={handleSelectHistoryItem}
          onDelete={handleDeleteItem}
        />
      </div>
    </div>
  );
}
