"use client";

import { useRef, useState } from "react";
import { ImageIcon, Orbit360Icon, CheckIcon } from "@/components/icons";
import { Viewer360, type ViewerMode } from "./Viewer360";
import { createThumbnailFromCanvas } from "@/lib/client/pwa-360-engine";
import type { ImmersiveHistoryItem } from "@/lib/client/immersive-store";

export interface ImportPanelProps {
  onSaveItem: (item: ImmersiveHistoryItem) => Promise<void>;
}

interface ImportedPanoState {
  title: string;
  dataUrl: string;
  thumbnailDataUrl: string;
  width: number;
  height: number;
  workflowLabel: string;
}

export function ImportPanel({ onSaveItem }: ImportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imported, setImported] = useState<ImportedPanoState | null>(null);
  const [viewerMode, setViewerMode] = useState<ViewerMode>("360");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const processImageSource = (srcUrl: string, defaultTitle: string, workflowLabel: string) => {
    setLoading(true);
    setError(null);
    setSavedNotice(null);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      if (w < 64 || h < 32) {
        setImported(null);
        setLoading(false);
        setError(`Rejected (${w}×${h}px). Image is too small to be a 360° panorama.`);
        return;
      }

      const ratio = w / h;
      // Strict equirectangular 360° panorama check (~2:1 aspect ratio)
      if (ratio < 1.75 || ratio > 2.25) {
        setImported(null);
        setLoading(false);
        setError(
          `Rejected (${w}×${h}px, aspect ${ratio.toFixed(2)}:1). Only 2:1 equirectangular 360° panoramas are accepted.`
        );
        return;
      }

      const maxW = Math.min(2048, w);
      const scale = maxW / w;
      const outW = Math.max(64, Math.round(w * scale));
      const outH = Math.max(32, Math.round(h * scale));

      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, outW, outH);
      }

      let normalizedDataUrl = srcUrl;
      let thumbUrl = srcUrl;
      try {
        normalizedDataUrl = canvas.toDataURL("image/jpeg", 0.9);
        thumbUrl = createThumbnailFromCanvas(canvas, 360, 180);
      } catch {
        // Fallback if canvas serialization is restricted
      }

      setImported({
        title: defaultTitle,
        dataUrl: normalizedDataUrl,
        thumbnailDataUrl: thumbUrl,
        width: w,
        height: h,
        workflowLabel,
      });
      setViewerMode("360");
      setLoading(false);
    };

    img.onerror = () => {
      setImported(null);
      setLoading(false);
      setError("Rejected: Could not decode image. Select a valid 2:1 .PNG, .JPG, or .WebP panorama.");
    };

    img.src = srcUrl;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
      setImported(null);
      setError("Rejected: Unsupported format. Choose a 2:1 .png, .jpg, or .webp panorama.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setError("Could not read that file from your device.");
        return;
      }
      const cleanName = file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ");
      const isPng = file.type === "image/png" || /\.png$/i.test(file.name);
      processImageSource(
        reader.result,
        cleanName || "Imported 360° Panorama",
        isPng ? "PNG 360° Panorama" : "Equirectangular 360°"
      );
    };
    reader.onerror = () => {
      setError("Could not read the selected image file.");
    };
    reader.readAsDataURL(file);
  };

  const handleSaveToHistory = async () => {
    if (!imported) return;
    const item: ImmersiveHistoryItem = {
      id: `imp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: imported.title.trim() || "Imported 360° Panorama",
      createdAt: new Date().toISOString(),
      sourceType: "imported",
      workflowLabel: imported.workflowLabel,
      imageDataUrl: imported.dataUrl,
      thumbnailDataUrl: imported.thumbnailDataUrl,
      width: imported.width,
      height: imported.height,
    };
    await onSaveItem(item);
    setSavedNotice("Saved to 360 history.");
  };

  return (
    <div className="immersive-panel" data-testid="import-panel">
      <div className="immersive-panel-card">
        <div className="immersive-panel-header">
          <h2>Import 360° Panorama</h2>
          <p>Upload a 2:1 equirectangular or .PNG panorama. Non-panoramic photos are automatically rejected.</p>
        </div>

        <div className="immersive-upload-zone">
          <label htmlFor="immersive-file-upload" className="immersive-upload-label">
            <span className="immersive-upload-icon">
              <ImageIcon size={22} />
            </span>
            <span className="immersive-upload-copy">
              <strong>Select 2:1 Panorama (.PNG / .JPG / .WebP)</strong>
              <small>Verified 2:1 equirectangular projection · On-device only</small>
            </span>
          </label>
          <input
            ref={fileInputRef}
            id="immersive-file-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            onChange={handleFileChange}
            className="sr-only"
            aria-label="Upload 360 panorama image"
          />

          <div className="immersive-sample-row">
            <button
              type="button"
              onClick={() =>
                processImageSource(
                  "/MIRAS_VR_Test_Panorama.png",
                  "Udaipur Heritage 360° (.PNG)",
                  "PNG 360° Panorama"
                )
              }
              className="immersive-secondary-btn"
            >
              Load sample 2:1 .PNG panorama
            </button>
          </div>
        </div>

        {loading && (
          <p role="status" className="immersive-status-banner">
            Validating 360° panorama…
          </p>
        )}

        {error && (
          <div role="alert" className="immersive-error-banner" data-testid="import-error-banner">
            <p>{error}</p>
          </div>
        )}

        {!imported && !loading && (
          <div className="immersive-empty-state" data-testid="import-empty-state">
            <Orbit360Icon size={24} />
            <p>Select a valid 2:1 equirectangular panorama above to preview in 360° or VR.</p>
          </div>
        )}
      </div>

      {imported && (
        <div className="immersive-result-block" data-testid="import-result">
          <div className="immersive-title-bar">
            <label htmlFor="imported-pano-title">
              <span>Title</span>
              <input
                id="imported-pano-title"
                type="text"
                value={imported.title}
                onChange={(e) => setImported({ ...imported, title: e.target.value })}
              />
            </label>
            <span className="immersive-dimension-tag">
              {imported.width} × {imported.height}px · {imported.workflowLabel}
            </span>
          </div>

          <Viewer360
            src={imported.dataUrl}
            title={imported.title}
            mode={viewerMode}
            onModeChange={setViewerMode}
          />

          <div className="immersive-action-bar" role="group" aria-label="Imported panorama actions">
            <button
              type="button"
              aria-pressed={viewerMode === "360"}
              onClick={() => setViewerMode("360")}
              className={viewerMode === "360" ? "feature-primary" : "feature-secondary"}
            >
              View 360
            </button>
            <button
              type="button"
              aria-pressed={viewerMode === "vr"}
              onClick={() => setViewerMode("vr")}
              className={viewerMode === "vr" ? "feature-primary" : "feature-secondary"}
            >
              View in VR
            </button>
            <button
              type="button"
              onClick={handleSaveToHistory}
              className="feature-primary immersive-save-cta"
              data-testid="import-save-history"
            >
              <CheckIcon size={18} />
              <span>Save to history</span>
            </button>
          </div>

          {savedNotice && (
            <p role="status" className="immersive-saved-toast" data-testid="import-saved-status">
              {savedNotice}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
