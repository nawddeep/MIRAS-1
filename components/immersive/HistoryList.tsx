"use client";

import type { ImmersiveHistoryItem } from "@/lib/client/immersive-store";
import type { ViewerMode } from "./Viewer360";

export interface HistoryListProps {
  items: ImmersiveHistoryItem[];
  activeId?: string | null;
  onSelect: (item: ImmersiveHistoryItem, mode: ViewerMode, withGyro?: boolean) => void;
  onDelete: (id: string) => void;
}

function formatHistoryDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function HistoryList({ items, activeId, onSelect, onDelete }: HistoryListProps) {
  return (
    <section
      id="immersive-history-section"
      className="immersive-history-section"
      aria-label="Saved 360 history"
      data-testid="immersive-history"
    >
      <div className="discovery-heading">
        <div>
          <h2>Saved 360° History</h2>
        </div>
        <span className="immersive-history-count">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="immersive-history-empty" data-testid="immersive-history-empty">
          <p>No saved 360° panoramas on this device yet.</p>
        </div>
      ) : (
        <ul className="immersive-history-grid">
          {items.map((item) => {
            const sourceLabel = item.sourceType === "imported" ? "Imported" : "Created";
            const isSelected = activeId === item.id;
            return (
              <li
                key={item.id}
                data-testid="immersive-history-card"
                className={`immersive-history-card ${isSelected ? "is-selected" : ""}`}
              >
                <div className="immersive-history-thumb-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.thumbnailDataUrl || item.imageDataUrl}
                    alt={item.title}
                    className="immersive-history-thumb"
                  />
                  <span
                    className={`immersive-source-badge is-${item.sourceType}`}
                    data-testid="history-source-badge"
                  >
                    {sourceLabel}
                  </span>
                </div>

                <div className="immersive-history-body">
                  <div className="immersive-history-meta">
                    <h3>{item.title}</h3>
                    <small>
                      {formatHistoryDate(item.createdAt)} · {item.workflowLabel}
                    </small>
                  </div>

                  <div className="immersive-history-actions" role="group" aria-label={`Actions for ${item.title}`}>
                    <button
                      type="button"
                      onClick={() => onSelect(item, "360", false)}
                      className="immersive-card-btn is-primary"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const DOE =
                          typeof window !== "undefined"
                            ? (window.DeviceOrientationEvent as unknown as {
                                requestPermission?: () => Promise<"granted" | "denied">;
                              })
                            : undefined;
                        if (DOE && typeof DOE.requestPermission === "function") {
                          void DOE.requestPermission().finally(() => onSelect(item, "360", true));
                        } else {
                          onSelect(item, "360", true);
                        }
                      }}
                      className="immersive-card-btn"
                      data-testid="history-gyro-btn"
                    >
                      Gyro
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelect(item, "vr", false)}
                      className="immersive-card-btn"
                    >
                      View in VR
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      className="immersive-card-btn is-danger"
                      aria-label={`Delete ${item.title}`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
