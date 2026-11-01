import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const MIME_MAP: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const MIRAS_PWA_THEME_OVERRIDE = `
<base href="/api/pwa-studio/" />
<style id="miras-theme-override">
  :root {
    --bg: #e8f2f4 !important;
    --surface: rgba(255, 255, 255, 0.92) !important;
    --surface-elevated: #ffffff !important;
    --border: rgba(16, 23, 24, 0.14) !important;
    --accent: #101718 !important;
    --accent-hover: #243b42 !important;
    --accent-soft: rgba(240, 161, 64, 0.22) !important;
    --text: #101718 !important;
    --text-secondary: #4e6067 !important;
  }
  html, body {
    background: linear-gradient(150deg, #e8f3f5, #f1f3ee) !important;
    color: #101718 !important;
    font-family: Arial, Helvetica, sans-serif !important;
  }
  .topbar, .top-bar, header {
    background: rgba(232, 242, 244, 0.95) !important;
    color: #101718 !important;
    border-bottom: 1px solid rgba(16, 23, 24, 0.12) !important;
  }
  .hero {
    padding: 14px 16px 8px !important;
  }
  .hero-eyebrow {
    display: none !important;
  }
  .hero-title {
    font-size: 1.25rem !important;
    line-height: 1.2 !important;
  }
  .hero-title br {
    display: none !important;
  }
  .hero-subtitle {
    font-size: 0.84rem !important;
    line-height: 1.35 !important;
    display: -webkit-box !important;
    -webkit-line-clamp: 1 !important;
    -webkit-box-orient: vertical !important;
    overflow: hidden !important;
  }
  .btn-primary, button.primary {
    background: #101718 !important;
    color: #ffffff !important;
    border-radius: 999px !important;
  }
  .btn-secondary, .btn-outline {
    background: #ffffff !important;
    color: #101718 !important;
    border: 1px solid rgba(16, 23, 24, 0.18) !important;
    border-radius: 999px !important;
  }
  .capture-card, .card, .panel, .modal-sheet {
    background: rgba(255, 255, 255, 0.92) !important;
    color: #101718 !important;
    border-radius: 22px !important;
    border: 1px solid rgba(16, 23, 24, 0.1) !important;
  }
</style>
<script>
  (function() {
    try {
      localStorage.setItem("miras_onboarding_complete", "true");
      localStorage.setItem("miras_ios_install_dismissed", "true");
      if (navigator.serviceWorker) {
        navigator.serviceWorker.register = function() {
          return Promise.resolve({ installing: null, waiting: null, active: null, update: function() {} });
        };
      }
    } catch {}
    const notifyParent = () => {
      try {
        window.parent?.postMessage({ type: "MIRAS_PWA_UPDATED" }, "*");
      } catch {}
    };
    window.addEventListener("mouseup", () => setTimeout(notifyParent, 600));
    window.addEventListener("touchend", () => setTimeout(notifyParent, 600));
    window.addEventListener("message", (e) => {
      if (e.data && e.data.type === "MIRAS_START_CAPTURE") {
        const btn = document.getElementById("new-capture-btn");
        if (btn) btn.click();
      }
    });
  })();
</script>
`;

export async function GET(
  _req: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await context.params;
  const relPath = segments && segments.length > 0 ? segments.join("/") : "index.html";

  // Prevent directory traversal
  const pwaDistRoot = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "pwa", "dist");
  const resolvedFile = path.resolve(/*turbopackIgnore: true*/ pwaDistRoot, relPath);
  if (!resolvedFile.startsWith(pwaDistRoot)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(resolvedFile) || fs.statSync(resolvedFile).isDirectory()) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const ext = path.extname(resolvedFile).toLowerCase();
  const contentType = MIME_MAP[ext] ?? "application/octet-stream";

  if (ext === ".html") {
    let html = fs.readFileSync(resolvedFile, "utf8");
    // Relax CSP style-src / script-src for our inline MIRAS theme bridge & remove SW registration so it doesn't collide with Next.js root SW
    html = html.replace(/<meta[^>]*http-equiv="Content-Security-Policy"[^>]*>/i, "");
    html = html.replace("</head>", `${MIRAS_PWA_THEME_OVERRIDE}</head>`);
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  }

  const data = fs.readFileSync(resolvedFile);
  return new NextResponse(data, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
