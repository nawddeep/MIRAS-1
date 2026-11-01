import { Geometry, ShotPlanner, SphericalAngle } from '../geometry/SphericalGeometry';
import type { ShotTarget } from '../geometry/SphericalGeometry';
import { Reprojection, RasterImage } from '../geometry/Reprojection';
import { SyntheticFixture } from '../geometry/SyntheticFixture';
import {
  captureSlug,
  captureStatus,
  createCaptureDocument,
  frameFileName,
  generateUUID
} from '../models/CaptureModels';
import type { CaptureDocument, FrameRecord, Hotspot } from '../models/CaptureModels';
import { CaptureTrigger, TRIGGER_CONFIG } from '../models/CaptureTrigger';
import { Coverage, type CoverageReport } from '../geometry/Coverage';
import { CapturePlanner, MAX_REFINEMENT_ROUNDS } from '../geometry/CapturePlanner';
import type { PlannerInput } from '../geometry/CapturePlanner';
import { AUTO_RETAKES, acceptedWithWarning, qualityGate } from '../models/QualityPolicy';
import { FrameQuality } from '../geometry/FrameQuality';
import {
  checkCameraCompatibility,
  estimateShift,
  grayFromRGBA,
  syncIsReliable,
  yawOffsetFromShift
} from '../geometry/ResumeSync';
import type { GrayImage } from '../geometry/ResumeSync';
import {
  allowedPanoramaWidths,
  isIOSDevice,
  maxSafePanoramaWidth
} from '../models/DeviceCapabilities';
import { DeviceInfo } from '../models/DeviceInfo';
import {
  CaptureService,
  getCalibratedVerticalFOV,
  HeadingService,
  updateLensCalibration,
  fovFromIntrinsics
} from '../services/CaptureService';
import type { CameraSample } from '../services/CaptureService';
import { CaptureStore } from '../services/CaptureStore';
import {
  DIAGNOSTIC_FILL_FILE,
  DIAGNOSTIC_MASK_FILE,
  DIAGNOSTIC_MATCHES_FILE,
  DIAGNOSTIC_OVERVIEW_FILE,
  ExportService
} from '../services/ExportService';
import { buildStitchReport } from '../models/StitchReportBuilder';
import { ImageCodec } from '../services/ImageCodec';
import { settingsDrift } from '../services/CameraLock';
import { PanoramaViewer } from '../services/PanoramaViewer';
import { StitchService } from '../services/StitchService';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// iOS remembers a refused motion prompt for the site until Safari is fully closed.
// Share of the required sphere (above the optional nadir) that must really be photographed.
const COVERAGE_TARGET = 0.995;
// Rounds of extra gap dots offered before the user may finish anyway (shortfall is reported).

const MOTION_BLOCKED_HELP =
  'Motion access is blocked, so the dots cannot follow your phone. On iPhone: swipe Safari away in the app switcher to close it completely, reopen this link, start a capture and tap Allow when asked about Motion & Orientation. If no prompt appears, go to Settings › Safari › Advanced › Website Data, delete this site, and try again.';

export class AppController {
  private root: HTMLElement;
  private screenRoot: HTMLElement;
  private overlayRoot: HTMLElement;
  private activeScreen: 'library' | 'capture' | 'detail' | null = null;

  private store = CaptureStore.shared;
  private stitcher = new StitchService(this.store);
  private exporter = new ExportService(this.store);

  private captures: CaptureDocument[] = [];
  private libraryWarnings: string[] = [];
  private selected: CaptureDocument | null = null;
  private progress: number | null = null;
  private activity = '';
  private cancelled = false;
  private metrics: string | null = null;
  private alertMessage: string | null = null;
  private alertRetryCallback: (() => void) | null = null;
  private showOnboarding = false;
  private onboardingStep = 0;
  private showDebugSheet = false;
  private deletingCapture: CaptureDocument | null = null;
  private pendingImportFiles: File[] | null = null;

  // Capture session state
  private inCaptureMode = false;
  private captureDoc: CaptureDocument = createCaptureDocument();
  private captureService = new CaptureService();
  private headingService = new HeadingService();
  private trigger = new CaptureTrigger();
  private sample: CameraSample | null = null;
  private currentAngle = new SphericalAngle(0, 0);
  private currentTarget: ShotTarget | null = null;
  private alignment = 0;
  private coaching = 'Follow the dots';
  private busy = false;
  private flash = false;
  private testPanoImg: HTMLImageElement | null = null;
  private includePlaceName = false;
  private motionPermissionDenied = false;
  /** When the camera finished starting; used to detect "no gyro data arrived". */
  private motionPromptShownAt: number | null = null;

  // Capture HUD loop & cached state
  private captureRafId: number | null = null;
  private hudResizeObserver: ResizeObserver | null = null;
  private hudCssWidth = 390;
  private hudCssHeight = 844;
  private hudDpr = 1;
  private hudDirty = true;
  private lastHealthPollMs = 0;
  private lastHealthState = '';
  private minimapDirty = true;
  private lastCounterText = '';
  private lastCoachingText = '';
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private wakeLockSentinel: { release(): Promise<void> } | null = null;

  // Detail / Viewer state
  private viewer: PanoramaViewer | null = null;
  private viewerDocId: string | null = null;
  private hotspotDomElements = new Map<string, HTMLElement>();
  private editingHotspot: Hotspot | null = null;
  private showSettingsModal = false;
  private thumbCache = new Map<string, string>();

  // PWA install & update state
  private deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
  private showIosInstallBanner = false;
  private swUpdateCallback: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.innerHTML = '';

    this.screenRoot = document.createElement('div');
    this.screenRoot.id = 'screen-root';
    this.overlayRoot = document.createElement('div');
    this.overlayRoot.id = 'overlay-root';
    this.root.appendChild(this.screenRoot);
    this.root.appendChild(this.overlayRoot);

    this.showOnboarding = this.safeGetStorage('miras_onboarding_complete') !== 'true';
    this.includePlaceName = this.safeGetStorage('miras_include_place_name') === 'true';

    if (
      isIOSDevice() &&
      typeof window !== 'undefined' &&
      !window.matchMedia?.('(display-mode: standalone)')?.matches &&
      this.safeGetStorage('miras_ios_install_dismissed') !== 'true'
    ) {
      this.showIosInstallBanner = true;
    }

    this.setupLifecycleListeners();
  }

  private safeGetStorage(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private safeSetStorage(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore private browsing / storage quota errors
    }
  }

  private isDebugEnabled(): boolean {
    try {
      if (import.meta.env?.DEV) return true;
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('debug') === '1' || params.get('sim') === '1';
    }
    return false;
  }

  private async ensureTestPanoramaLoaded(): Promise<HTMLImageElement | null> {
    if (this.testPanoImg && this.testPanoImg.complete && this.testPanoImg.naturalWidth > 0) {
      return this.testPanoImg;
    }
    if (typeof Image === 'undefined') return null;
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.testPanoImg = img;
        resolve(img);
      };
      img.onerror = () => resolve(null);
      img.src = './MIRAS_VR_Test_Panorama.png';
    });
  }

  public notifyServiceWorkerUpdate(applyUpdate: () => void): void {
    this.swUpdateCallback = applyUpdate;
    if (this.activeScreen === 'library') {
      this.renderLibraryScreen();
    }
  }

  /** True while capturing, stitching or exporting — an auto-reload would lose work. */
  public isBusy(): boolean {
    return this.inCaptureMode || this.progress !== null;
  }

  public notifyFatalError(message: string): void {
    this.alertMessage = message;
    this.renderOverlays();
  }

  private setupLifecycleListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e as BeforeInstallPromptEvent;
      if (this.activeScreen === 'library') {
        this.renderLibraryScreen();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.alertMessage) {
          this.alertMessage = null;
          this.alertRetryCallback = null;
          this.renderOverlays();
        } else if (this.editingHotspot) {
          this.editingHotspot = null;
          this.renderOverlays();
        } else if (this.showSettingsModal) {
          this.showSettingsModal = false;
          this.renderOverlays();
        } else if (this.showDebugSheet) {
          this.showDebugSheet = false;
          this.renderOverlays();
        } else if (this.deletingCapture) {
          this.deletingCapture = null;
          this.renderOverlays();
        } else if (this.pendingImportFiles) {
          this.pendingImportFiles = null;
          this.renderOverlays();
        }
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (this.inCaptureMode) {
          void this.flushPendingCaptureSave();
          this.captureService.stop();
        }
      } else if (document.visibilityState === 'visible') {
        if (this.inCaptureMode) {
          void this.acquireWakeLock();
          const videoEl = document.getElementById('capture-video') as HTMLVideoElement | null;
          if (videoEl) {
            void this.captureService
              .start(videoEl, { deviceId: this.captureService.selectedDeviceId ?? undefined })
              .then(() => this.afterCameraStart(true))
              .catch((err) => {
                this.showBlockingCameraError(err);
              });
          }
        } else if (this.progress !== null) {
          void this.acquireWakeLock();
        }
      }
    });

    window.addEventListener('pagehide', () => {
      if (this.inCaptureMode) {
        void this.flushPendingCaptureSave();
        this.captureService.stop();
      }
    });
  }

  private async acquireWakeLock(): Promise<void> {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> };
      };
      if (nav.wakeLock) {
        this.wakeLockSentinel = await nav.wakeLock.request('screen');
      }
    } catch {
      // Wake lock not permitted or unsupported
    }
  }

  private async releaseWakeLock(): Promise<void> {
    if (this.wakeLockSentinel) {
      try {
        await this.wakeLockSentinel.release();
      } catch {
        // ignore
      }
      this.wakeLockSentinel = null;
    }
  }

  async init(): Promise<void> {
    await this.refreshLibrary();
    this.render();
  }

  async refreshLibrary(): Promise<void> {
    try {
      const lib = await this.store.load();
      this.captures = lib.captures;
      this.libraryWarnings = lib.warnings;
      for (const c of this.captures) {
        if (c.stitched && !this.thumbCache.has(c.id)) {
          void this.loadThumbnail(c.id);
        }
      }
    } catch (err) {
      this.alertMessage = err instanceof Error ? err.message : String(err);
    }
    if (this.activeScreen === 'library') {
      this.renderLibraryScreen();
    }
    this.renderOverlays();
  }

  private revokeThumbnail(id: string): void {
    const existing = this.thumbCache.get(id);
    if (existing) {
      URL.revokeObjectURL(existing);
      this.thumbCache.delete(id);
    }
  }

  private async loadThumbnail(id: string): Promise<void> {
    try {
      const bytes = await this.store.readThumbnail(id);
      const blob = new Blob([bytes as unknown as BlobPart], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      this.revokeThumbnail(id);
      this.thumbCache.set(id, url);
      if (this.activeScreen === 'library') {
        const imgEl = this.screenRoot.querySelector(
          `[data-thumb-id="${id}"]`
        ) as HTMLImageElement | null;
        if (imgEl) {
          imgEl.src = url;
        } else {
          this.renderLibraryScreen();
        }
      }
    } catch {
      // Non-fatal
    }
  }

  // MARK: - Capture Actions

  private async startNewCapture(resumeDoc?: CaptureDocument): Promise<void> {
    // iOS only shows the Motion & Orientation prompt when requestPermission() runs inside
    // the tap itself. It used to run after several awaits (storage check, wake lock,
    // camera start), by which point iOS rejected it silently and the gyro never worked.
    // So it must be the very first call here — before any await.
    const motionPermission = this.headingService.requestMotionPermission();

    // Storage persistence & quota pre-check (Phase 0.4)
    void this.store.requestPersistentStorage();
    const spaceCheck = await this.store.checkStorageAvailable(25 * 1024 * 1024);
    if (spaceCheck.lowSpace && spaceCheck.availableBytes < 8 * 1024 * 1024) {
      this.alertMessage =
        'Device storage is critically low (< 8 MB free). Delete old captures or free space on your phone before starting a new 360° capture.';
      this.renderOverlays();
      return;
    }

    this.inCaptureMode = true;
    this.captureDoc = resumeDoc ? createCaptureDocument(resumeDoc) : createCaptureDocument();
    if (spaceCheck.lowSpace) {
      const lowNote = 'Low available browser storage; consider exporting and deleting older captures.';
      if (!this.captureDoc.warnings.includes(lowNote)) {
        this.captureDoc.warnings.push(lowNote);
      }
    }

    this.trigger.reset();
    this.sample = null;
    this.currentAngle = new SphericalAngle(0, 0);
    this.currentTarget = null;
    this.alignment = 0;
    this.coaching = 'Follow the dots';
    this.busy = false;
    this.flash = false;
    this.motionPermissionDenied = false;
    this.qualityMessage = null;
    this.qualityStrikes.clear();
    this.acceptedBlurRatios = (this.captureDoc.frames ?? [])
      .filter((f) => f.quality && !f.quality.lowTexture && !f.quality.note)
      .map((f) => f.quality!.blurRatio);
    // Planner state is part of the capture: resuming keeps its rounds, additions and limits.
    this.coverageReport = null;
    if (this.captureDoc.frames.length > 0) this.refreshCoverage();
    this.hudDirty = true;
    this.minimapDirty = true;
    this.lastCounterText = '';
    this.lastCoachingText = '';

    this.render();
    await this.acquireWakeLock();

    const videoEl = document.getElementById('capture-video') as HTMLVideoElement | null;
    if (!videoEl) return;

    this.captureService.onTrackEnded = () => {
      this.showBlockingCameraError(
        new Error('Camera stream was interrupted by the operating system. Tap Retry to resume.')
      );
    };

    try {
      // Step 1: Motion permission (its prompt was already opened from the tap above)
      const motionGranted = await motionPermission;
      this.motionPermissionDenied = !motionGranted;

      // Step 2: Camera. A resumed capture first tries to reopen the camera it was made with.
      const savedDeviceId = this.captureDoc.frames.length > 0 ? this.captureDoc.camera?.deviceId ?? undefined : undefined;
      try {
        await this.captureService.start(videoEl, { deviceId: savedDeviceId });
      } catch (err) {
        if (!savedDeviceId) throw err;
        await this.captureService.start(videoEl); // verified against the saved identity below
      }
      this.motionPromptShownAt = performance.now();
      if (!(await this.afterCameraStart(false))) return;

      // Step 3: Request optional one-shot location / compass heading
      void this.headingService.requestLocationOnce(this.includePlaceName);

      this.startCaptureLoop();
    } catch (err) {
      this.showBlockingCameraError(err);
    }
  }

  // ---- Capture-resume integrity -------------------------------------------------------
  /** Current capture session id (new after every resume / sensor restart). */
  private sessionId = generateUUID();
  /** True while new photos are blocked until the yaw reference is re-established. */
  private resyncPending = false;
  private resyncRef: { gray: GrayImage; transform: number[]; fxSmall: number; url: string } | null = null;
  private resyncTimer: ReturnType<typeof setInterval> | null = null;
  private resyncBusy = false;

  /**
   * Runs after every camera start. A capture that already has photos is checked against its
   * saved camera identity and must re-establish its yaw reference before shooting continues.
   * Returns false when the capture cannot continue (capture is stopped with an explanation).
   */
  private async afterCameraStart(isRestart: boolean): Promise<boolean> {
    this.populateCameraSelector();
    const doc = this.captureDoc;
    if (doc.frames.length === 0) return true;
    const current = this.captureService.describeCamera();
    const compat = checkCameraCompatibility(doc.camera, current);
    if (!compat.ok) {
      this.stopCapture();
      this.alertMessage = `This capture cannot continue with the current camera. ${compat.problems.join(' ')} Your earlier photos are kept unchanged; start a new capture, or resume with the original camera.`;
      this.renderOverlays();
      return false;
    }
    // Resumed photos use the focal length the capture was made with, even if calibration changed.
    if (doc.camera) this.captureService.verticalFOV = doc.camera.fov;
    await this.beginResync(isRestart ? 'The camera restarted' : 'Resuming');
    return true;
  }

  /** Blocks capture and shows the last photo over the live view until the yaw is re-synced. */
  private async beginResync(reason: string): Promise<void> {
    this.finishResync();
    this.sessionId = generateUUID();
    this.captureService.worldYawOffsetDeg = 0;
    this.resyncPending = true;
    const ref = this.captureDoc.frames[this.captureDoc.frames.length - 1];
    try {
      const bytes = await this.store.readFrame(this.captureDoc.id, ref.file ?? frameFileName(ref.index));
      const blob = new Blob([bytes as unknown as BlobPart], { type: 'image/jpeg' });
      const bmp = await createImageBitmap(blob);
      const w = 128;
      const h = Math.round((bmp.height / bmp.width) * w);
      const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('no canvas');
      ctx.drawImage(bmp, 0, 0, w, h);
      bmp.close();
      this.resyncRef = {
        gray: grayFromRGBA(ctx.getImageData(0, 0, w, h).data, w, h),
        transform: ref.transform,
        fxSmall: ref.intrinsics[0] * (w / ref.width),
        url: URL.createObjectURL(blob)
      };
    } catch {
      this.resyncRef = null;
    }
    const overlay = document.getElementById('capture-resync-overlay') as HTMLImageElement | null;
    const panel = document.getElementById('capture-resync-panel');
    const text = document.getElementById('capture-resync-text');
    if (overlay && this.resyncRef) {
      overlay.src = this.resyncRef.url;
      overlay.style.display = 'block';
    }
    if (panel) panel.style.display = 'flex';
    if (text) {
      text.textContent = this.resyncRef
        ? `${reason}: line up the faded photo with the live view and hold still.`
        : `${reason}: the last photo could not be loaded for re-sync.`;
    }
    this.coaching = 'Re-syncing orientation';
    this.hudDirty = true;
    this.resyncTimer = setInterval(() => void this.tryResync(), 300);
  }

  /** One re-sync attempt: match the live view against the reference photo. */
  private async tryResync(): Promise<void> {
    const ref = this.resyncRef;
    const video = this.captureService.videoElement;
    if (!this.resyncPending || !ref || !video || video.readyState < 2 || this.resyncBusy) return;
    if (!this.captureService.hasHardwareGyro || this.captureService.currentVelocity > 6) return;
    this.resyncBusy = true;
    try {
      const w = ref.gray.width, h = ref.gray.height;
      const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const live = grayFromRGBA(ctx.getImageData(0, 0, w, h).data, w, h);
      const m = estimateShift(live, ref.gray, Math.round(w * 0.3));
      const off = yawOffsetFromShift(ref.transform, ref.fxSmall, m, this.captureService.currentYaw, this.captureService.currentPitch);
      const text = document.getElementById('capture-resync-text');
      if (syncIsReliable(m, off.pitchDisagreementDeg)) {
        this.captureService.worldYawOffsetDeg = off.offsetDeg;
        this.captureDoc.sessions = [
          ...this.captureDoc.sessions,
          {
            id: this.sessionId,
            startedAt: new Date().toISOString(),
            method: 'image-sync',
            yawOffsetDeg: +off.offsetDeg.toFixed(3),
            syncScore: +m.score.toFixed(3),
            uncertaintyDeg: +((1 / ref.fxSmall) * (180 / Math.PI)).toFixed(3)
          }
        ];
        this.scheduleCaptureSave();
        this.finishResync();
        this.qualityMessage = 'Orientation re-synced — continue';
        this.qualityMessageUntil = performance.now() + 2000;
      } else if (text) {
        text.textContent = `Line up the faded photo with the live view and hold still (match ${Math.round(Math.max(0, m.score) * 100)}%).`;
      }
    } finally {
      this.resyncBusy = false;
    }
  }

  /** User chose to continue without a verified re-sync: recorded, and the stitch warns. */
  private continueUnverified(): void {
    if (!this.resyncPending) return;
    this.captureDoc.sessions = [
      ...this.captureDoc.sessions,
      { id: this.sessionId, startedAt: new Date().toISOString(), method: 'unverified', yawOffsetDeg: 0 }
    ];
    const note = 'Some photos were added after a camera restart without a verified orientation re-sync; their placement relies on image alignment only.';
    if (!this.captureDoc.warnings.includes(note)) this.captureDoc.warnings.push(note);
    this.scheduleCaptureSave();
    this.finishResync();
  }

  private finishResync(): void {
    this.resyncPending = false;
    if (this.resyncTimer !== null) clearInterval(this.resyncTimer);
    this.resyncTimer = null;
    if (this.resyncRef) URL.revokeObjectURL(this.resyncRef.url);
    this.resyncRef = null;
    const overlay = document.getElementById('capture-resync-overlay') as HTMLImageElement | null;
    const panel = document.getElementById('capture-resync-panel');
    if (overlay) {
      overlay.style.display = 'none';
      overlay.removeAttribute('src');
    }
    if (panel) panel.style.display = 'none';
    this.hudDirty = true;
  }

  private showBlockingCameraError(err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    this.alertMessage = message;
    this.alertRetryCallback = () => {
      this.alertMessage = null;
      this.alertRetryCallback = null;
      this.renderOverlays();
      const videoEl = document.getElementById('capture-video') as HTMLVideoElement | null;
      if (videoEl && this.inCaptureMode) {
        void this.captureService
          .start(videoEl, { deviceId: this.captureService.selectedDeviceId ?? undefined })
          .then(async () => {
            if (await this.afterCameraStart(true)) this.startCaptureLoop();
          })
          .catch((retryErr) => this.showBlockingCameraError(retryErr));
      } else {
        void this.startNewCapture(this.captureDoc);
      }
    };
    this.renderOverlays();
  }

  private scheduleCaptureSave(doc: CaptureDocument = this.captureDoc): void {
    if (this.saveDebounceTimer !== null) {
      clearTimeout(this.saveDebounceTimer);
    }
    this.saveDebounceTimer = setTimeout(() => {
      this.saveDebounceTimer = null;
      void this.store.save(doc).catch((err) => {
        this.alertMessage = err instanceof Error ? err.message : String(err);
        this.renderOverlays();
      });
    }, 350);
  }

  private async flushPendingCaptureSave(): Promise<void> {
    if (this.saveDebounceTimer !== null) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
    try {
      if (this.captureDoc.frames.length > 0) {
        await this.store.save(this.captureDoc);
      }
    } catch (err) {
      this.alertMessage = err instanceof Error ? err.message : String(err);
      this.renderOverlays();
    }
  }

  private stopCapture(): void {
    this.inCaptureMode = false;
    this.finishResync();
    if (this.pendingQualityDecision) {
      this.pendingQualityDecision = null;
      this.busy = false;
    }
    this.motionPromptShownAt = null;
    if (this.captureRafId !== null) {
      cancelAnimationFrame(this.captureRafId);
      this.captureRafId = null;
    }
    if (this.hudResizeObserver) {
      this.hudResizeObserver.disconnect();
      this.hudResizeObserver = null;
    }
    void this.flushPendingCaptureSave();
    void this.releaseWakeLock();
    this.trigger.reset();
    this.captureService.onTrackEnded = null;
    this.captureService.stop();
    this.headingService.stop();
    this.render();
  }

  // Cached: this is read several times per animation frame during capture.
  private completedCache: { frames: unknown; count: number; set: Set<number> } | null = null;
  private get completedSet(): Set<number> {
    const frames = this.captureDoc.frames;
    const c = this.completedCache;
    if (c && c.frames === frames && c.count === frames.length) return c.set;
    const set = new Set(frames.map((f) => f.index));
    this.completedCache = { frames, count: frames.length, set };
    return set;
  }

  /**
   * Finish needs every required dot (the zenith is required; only the nadir is optional —
   * the old |pitch| < 89° filter silently made the zenith optional too) AND real measured
   * coverage of the required sphere. Gap dots are added when coverage falls short; after two
   * rounds of gap dots the user may finish, and the stitch report states the shortfall.
   */
  private get canFinishCapture(): boolean {
    const done = this.completedSet;
    if (this.captureDoc.frames.length === 0) return false;
    if (!this.captureDoc.targets.filter((t) => !t.optional).every((t) => done.has(t.id))) {
      return false;
    }
    const cov = this.coverageReport;
    return !cov || cov.fraction >= COVERAGE_TARGET || (this.captureDoc.plan?.rounds ?? 0) >= MAX_REFINEMENT_ROUNDS;
  }

  // Capture-time quality and coverage state
  private qualityMessage: string | null = null;
  private qualityMessageUntil = 0;
  private qualityStrikes = new Map<number, number>();
  private acceptedBlurRatios: number[] = [];
  private coverageReport: CoverageReport | null = null;
  private get gapTargetsAdded(): number {
    return this.captureDoc.plan?.additions.length ?? 0;
  }

  /** Texture seen so far: many low-texture photos ⇒ plain surfaces that need more overlap. */
  private textureHint(): 'unknown' | 'normal' | 'low' {
    const q = this.captureDoc.frames.map((f) => f.quality).filter((x) => x && x.status !== 'unavailable');
    if (q.length < 6) return 'unknown';
    return q.filter((x) => x!.lowTexture).length / q.length >= 0.4 ? 'low' : 'normal';
  }

  private plannerInputFor(s: CameraSample): PlannerInput {
    const w = s.resolution.width || 960, h = s.resolution.height || 1280;
    return {
      longSideFov: this.captureService.verticalFOV,
      aspect: Math.min(w, h) / Math.max(w, h),
      orientation: w <= h ? 'portrait' : 'landscape',
      dark: s.dark,
      sensorNoiseDeg: s.hasGyro ? this.captureService.sensorHealth().noiseDeg : 0,
      texture: this.textureHint()
    };
  }

  /** Capture-plan text for the UI: what the count is made of and why it changed. */
  private planExplanation(): string {
    const plan = this.captureDoc.plan;
    return plan ? CapturePlanner.explain(plan, this.captureDoc.targets.length, this.captureDoc.frames.length) : '';
  }

  /** Re-measures coverage from the recorded poses; adds gap dots once all dots are done. */
  private refreshCoverage(): void {
    const doc = this.captureDoc;
    this.coverageReport = Coverage.measure(doc.frames, doc.referenceWorldYaw);
    const done = this.completedSet;
    const requiredDone = doc.targets.filter((t) => !t.optional).every((t) => done.has(t.id));
    if (!doc.plan) {
      // Captures made before the planner existed: keep their targets; limits start from here.
      const input = this.plannerInputFor(this.sample ?? ({ resolution: { width: 0, height: 0 }, dark: false, hasGyro: false } as unknown as CameraSample));
      doc.plan = CapturePlanner.createState(input, { targets: doc.targets, rings: [], yawOverlap: 0.3, pitchOverlap: 0.2, yawFov: 0, pitchFov: 0, notes: ['captured before adaptive planning'] });
    }
    const extra = CapturePlanner.refine(doc.plan, doc.frames, doc.referenceWorldYaw, this.coverageReport, doc.targets, done, requiredDone, this.textureHint());
    if (extra.length > 0) {
      doc.targets = [...doc.targets, ...extra];
      this.minimapDirty = true;
      this.hudDirty = true;
    }
  }

  private startCaptureLoop(): void {
    if (this.captureRafId !== null) {
      cancelAnimationFrame(this.captureRafId);
    }
    const tick = () => {
      if (!this.inCaptureMode) {
        this.captureRafId = null;
        return;
      }
      // Stale sensors send no events, so health is polled against the clock (4 Hz).
      const nowMs = performance.now();
      if (this.captureService.hasHardwareGyro && nowMs - this.lastHealthPollMs > 250) {
        this.lastHealthPollMs = nowMs;
        const state = this.captureService.sensorHealth().state;
        if (state !== this.lastHealthState) {
          this.lastHealthState = state;
          this.hudDirty = true;
        }
      }
      if (this.captureService.stateDirty || this.hudDirty) {
        this.captureService.stateDirty = false;
        const s = this.captureService.readCurrentSample();
        this.processCameraSample(s);
        this.drawCaptureHUD();
        this.hudDirty = false;
      } else if (!this.captureService.hasHardwareGyro) {
        // No sensor events are driving redraws; still refresh controls (Enable Motion button).
        this.updateCaptureControlsDOM();
      }
      this.captureRafId = requestAnimationFrame(tick);
    };
    this.captureRafId = requestAnimationFrame(tick);
  }

  private processCameraSample(s: CameraSample): void {
    if (!this.inCaptureMode) return;
    this.sample = s;

    if (this.captureDoc.targets.length === 0) {
      // Deterministic plan from the calibrated lens, frame shape and orientation (see CapturePlanner).
      const input = this.plannerInputFor(s);
      const initial = CapturePlanner.initial(input);
      this.captureDoc.targets = initial.targets;
      this.captureDoc.plan = CapturePlanner.createState(input, initial);
      this.captureDoc.referenceWorldYaw = Geometry.northReference(
        s.angle.yaw,
        this.headingService.heading?.degrees,
        this.headingService.heading?.accuracy
      );
      this.minimapDirty = true;
    }

    if (this.captureDoc.frames.length === 0 && !this.busy) {
      this.captureDoc.referenceWorldYaw = Geometry.northReference(
        s.angle.yaw,
        this.headingService.heading?.degrees,
        this.headingService.heading?.accuracy
      );
    }

    this.currentAngle = new SphericalAngle(
      Geometry.wrap(s.angle.yaw - this.captureDoc.referenceWorldYaw),
      s.angle.pitch
    );

    const done = this.completedSet;
    const remaining = this.captureDoc.targets.filter((t) => !done.has(t.id));
    let bestTarget: ShotTarget | null = null;
    let bestDist = Infinity;
    for (const t of remaining) {
      const d = this.currentAngle.distance(t.angle);
      if (d < bestDist) {
        bestDist = d;
        bestTarget = t;
      }
    }
    this.currentTarget = bestTarget;
    const distance = bestTarget ? bestDist : 180;
    this.alignment = Math.max(0, 1 - distance / 12);

    // Orientation source is frozen once photos exist (a different source = different yaw reference).
    const hasPhotos = this.captureDoc.frames.length > 0;
    this.captureService.lockSensorSource(hasPhotos, this.captureDoc.orientationSource ?? undefined);
    if (hasPhotos && !this.captureDoc.orientationSource) {
      const locked = this.captureService.sensorSourceInfo().lockedTo;
      if (locked !== 'none') this.captureDoc.orientationSource = locked;
    }
    const health = s.hasGyro ? this.captureService.sensorHealth() : null;
    const sensorBlocked = health !== null && !health.usable;

    if (sensorBlocked && health) {
      this.coaching = health.message;
    } else if (s.dark) {
      this.coaching = 'Too dark';
    } else if (s.velocity >= TRIGGER_CONFIG.MAX_VELOCITY_DEG_PER_SEC) {
      this.coaching = 'Hold still';
    } else if (s.hasGyro) {
      // Browsers can't detect walking around (iOS uses ARKit for that warning), so give the
      // most important tip up front: turning the body moves the lens and causes ghosting.
      this.coaching =
        this.captureDoc.frames.length === 0
          ? 'Turn the phone, not your body · Follow the dots'
          : 'Follow the dots';
    } else if (this.captureService.simulatedMode) {
      this.coaching = 'Drag screen to aim at the dots';
    } else if (this.motionPermissionDenied) {
      this.coaching = 'Motion blocked — tap Enable Motion';
    } else {
      this.coaching = 'No motion data — tap Enable Motion, or drag to aim';
    }

    const shot = this.trigger.update({
      angle: this.currentAngle,
      targets: this.captureDoc.targets,
      completed: done,
      timestamp: s.timestamp,
      normal: true,
      velocity: s.velocity,
      busy: this.busy,
      // Only real orientation data may place a photo. A finger-dragged aim is not a camera
      // pose, so without motion sensors nothing is captured (simulator mode excepted).
      active:
        this.inCaptureMode &&
        !this.resyncPending &&
        !this.pendingQualityDecision &&
        !sensorBlocked &&
        (s.hasGyro || this.captureService.simulatedMode)
    });

    if (this.trigger.isRetaking) {
      this.coaching = 'Hold for 1 second to retake';
    }
    if (this.resyncPending) {
      this.coaching = 'Re-syncing orientation — line up the faded photo';
    } else     if (this.qualityMessage && performance.now() < this.qualityMessageUntil) {
      this.coaching = this.qualityMessage;
    } else if (this.gapTargetsAdded > 0 && this.captureDoc.frames.length > 0 && !this.canFinishCapture) {
      const remaining = this.captureDoc.targets.filter((t) => !t.optional && !done.has(t.id)).length;
      if (remaining > 0 && remaining <= this.gapTargetsAdded) {
        const last = this.captureDoc.plan?.additions[this.captureDoc.plan.additions.length - 1];
        this.coaching = `${remaining} additional photo${remaining === 1 ? '' : 's'} needed${last ? ` — ${last.detail}` : ''}`;
      }
    }
    if (shot) {
      void this.takeShot(shot, s);
    }
  }

  /** A photo waiting for the user's retake / keep decision (capture is paused meanwhile). */
  private pendingQualityDecision: {
    target: ShotTarget;
    record: FrameRecord;
    data: Uint8Array;
    fallback: boolean;
    reason: string;
  } | null = null;

  private async takeShot(target: ShotTarget, sample: CameraSample): Promise<void> {
    if (!this.inCaptureMode || this.busy || this.pendingQualityDecision || this.resyncPending) return;
    this.busy = true;
    this.updateCaptureControlsDOM();
    try {
      const { record, data, fallback, quality } = await this.captureService.captureFrame(
        target.id,
        target.angle,
        sample,
        this.testPanoImg
      );
      record.session = this.sessionId;

      // One policy for every capture path: automatic retakes, then an explicit decision.
      const action = qualityGate(quality, {
        simulated: this.captureService.simulatedMode,
        failuresSoFar: this.qualityStrikes.get(target.id) ?? 0,
        acceptedRatios: this.acceptedBlurRatios
      });
      if (action.kind === 'retry') {
        this.qualityStrikes.set(target.id, (this.qualityStrikes.get(target.id) ?? 0) + 1);
        this.qualityMessage = action.message;
        this.qualityMessageUntil = performance.now() + 2500;
        this.trigger.rearm(target.id);
        if ('vibrate' in navigator) {
          try {
            navigator.vibrate([15, 60, 15]);
          } catch {
            // ignore
          }
        }
        await new Promise((r) => setTimeout(r, 400));
        this.busy = false;
        this.hudDirty = true;
        this.updateCaptureControlsDOM();
        return;
      }
      if (action.kind === 'ask') {
        // Capture stays paused (busy) until the user decides.
        record.quality = action.record;
        this.pendingQualityDecision = { target, record, data, fallback, reason: action.reason };
        this.renderOverlays();
        return;
      }
      record.quality = action.record;
      if (action.record.status === 'passed' && quality && !quality.lowTexture) {
        this.acceptedBlurRatios.push(quality.blurRatio);
      }
      await this.commitShot(target, record, data, fallback);
    } catch (err) {
      this.alertMessage = err instanceof Error ? err.message : String(err);
      this.renderOverlays();
      this.busy = false;
      this.hudDirty = true;
      this.updateCaptureControlsDOM();
    }
  }

  /** User decision on a photo that failed (3 tries) or could not be quality-checked. */
  private async resolveQualityDecision(keep: boolean): Promise<void> {
    const pending = this.pendingQualityDecision;
    if (!pending) return;
    this.pendingQualityDecision = null;
    this.renderOverlays();
    if (!keep) {
      this.qualityStrikes.delete(pending.target.id);
      this.trigger.rearm(pending.target.id);
      this.qualityMessage = 'Retaking — hold still on the dot';
      this.qualityMessageUntil = performance.now() + 2500;
      this.busy = false;
      this.hudDirty = true;
      this.updateCaptureControlsDOM();
      return;
    }
    if (pending.record.quality) pending.record.quality = acceptedWithWarning(pending.record.quality);
    try {
      await this.commitShot(pending.target, pending.record, pending.data, pending.fallback);
    } catch (err) {
      this.alertMessage = err instanceof Error ? err.message : String(err);
      this.renderOverlays();
      this.busy = false;
      this.updateCaptureControlsDOM();
    }
  }

  /** Stores an accepted photo and updates coverage. Leaves `busy` cleared when done. */
  private async commitShot(target: ShotTarget, record: FrameRecord, data: Uint8Array, fallback: boolean): Promise<void> {
    this.qualityStrikes.delete(target.id);
    this.qualityMessage = null;

    if (this.captureDoc.frames.length === 0) {
      this.captureDoc.cameraKey = this.captureService.cameraKey;
      this.captureDoc.camera = this.captureService.describeCamera();
      this.captureDoc.sessions = [{ id: this.sessionId, startedAt: new Date().toISOString(), method: 'first', yawOffsetDeg: 0 }];
      const t = record.transform;
      const worldYaw = (Math.atan2(-t[8], t[10]) * 180) / Math.PI;
      this.captureDoc.heading = this.headingService.heading;
      this.captureDoc.location = this.headingService.location;
      this.captureDoc.place = this.headingService.place;
      this.captureDoc.referenceWorldYaw = Geometry.northReference(
        worldYaw,
        this.headingService.heading?.degrees,
        this.headingService.heading?.accuracy
      );
      this.captureDoc.yawReference = Geometry.hasReliableHeading(
        this.headingService.heading?.degrees,
        this.headingService.heading?.accuracy
      )
        ? 'trueNorth'
        : 'firstShot';
      const lockStatus = await this.captureService.lockCamera();
      if (lockStatus.detail && lockStatus.reference) this.captureDoc.cameraLock = { detail: lockStatus.detail, reference: lockStatus.reference };
      if (lockStatus.note && !this.captureDoc.warnings.includes(lockStatus.note)) {
        this.captureDoc.warnings.push(lockStatus.note);
      }
    }

    // Record what the camera actually used and flag auto-exposure / white-balance drift.
    const used = this.captureService.readCameraSettings();
    if (used) {
      record.camera = used;
      const reference = this.captureDoc.cameraLock?.reference ?? this.captureDoc.frames.find((f) => f.camera)?.camera;
      if (reference) {
        const drift = settingsDrift(reference, used);
        if (drift.message && !this.captureDoc.warnings.includes(drift.message)) this.captureDoc.warnings.push(drift.message);
      }
    }

    await this.store.writeFrame(data, record, this.captureDoc.id);
    this.captureDoc.frames = this.captureDoc.frames.filter((f) => f.index !== record.index);
    this.captureDoc.frames.push(record);

    const fallbackMsg = 'Background frame encoder unavailable; used slower main-thread capture.';
    if (fallback && !this.captureDoc.warnings.includes(fallbackMsg)) {
      this.captureDoc.warnings.push(fallbackMsg);
    }

    this.refreshCoverage();
    this.scheduleCaptureSave();
    this.minimapDirty = true;
    this.hudDirty = true;

    if (!this.inCaptureMode) {
      this.busy = false;
      return;
    }
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(20);
      } catch {
        // Ignore
      }
    }
    // Same rhythm as the iOS app: 120 ms flash, then a 1 s settle before the next shot.
    this.flash = true;
    this.updateCaptureControlsDOM();
    await new Promise((r) => setTimeout(r, 120));
    this.flash = false;
    this.updateCaptureControlsDOM();
    await new Promise((r) => setTimeout(r, 1000));
    this.busy = false;
    this.hudDirty = true;
    this.updateCaptureControlsDOM();
  }

  private async runStitch(capture: CaptureDocument): Promise<void> {
    if (this.progress !== null) return;

    const spaceCheck = await this.store.checkStorageAvailable(20 * 1024 * 1024);
    if (spaceCheck.lowSpace && spaceCheck.availableBytes < 8 * 1024 * 1024) {
      this.alertMessage =
        'Device storage is critically low (< 8 MB free). Delete old captures or free space on your phone before stitching.';
      this.renderOverlays();
      return;
    }

    this.progress = 0.02;
    this.activity = 'Starting stitch…';
    this.cancelled = false;
    this.renderOverlays();
    await this.acquireWakeLock();

    try {
      const c = createCaptureDocument(capture);
      const maxWidth = maxSafePanoramaWidth();
      let clampedNote: string | null = null;
      if (c.settings.width > maxWidth) {
        clampedNote = `Output width clamped from ${c.settings.width} px to ${maxWidth} px for device memory safety.`;
        c.settings.width = maxWidth;
      }

      const workerOutput = await this.stitcher.stitchInWorker(c, {
        onProgress: (val, stageName) => {
          this.progress = val;
          this.activity = stageName;
          this.updateProgressDOM();
        },
        onPreview: (previewJpeg) => {
          // Progressive 1024-px preview inside the viewer while full stitch continues (Phase 2.4)
          if (this.viewer && typeof createImageBitmap !== 'undefined') {
            const blob = new Blob([previewJpeg as unknown as BlobPart], { type: 'image/jpeg' });
            void createImageBitmap(blob).then((bmp) => {
              if (this.viewer) {
                this.viewer.loadImage(bmp);
              }
            });
          }
        }
      });

      const out = workerOutput.outcome;
      const { report, calibrationConfidence } = buildStitchReport(out, c, clampedNote);
      const f0 = c.frames[0];
      if (f0 && calibrationConfidence > 0) {
        updateLensCalibration(
          c.cameraKey,
          fovFromIntrinsics(f0.intrinsics[0], f0.width, f0.height),
          out.alignment.focalScale,
          calibrationConfidence
        );
      }

      c.stitched = true;
      c.stitchedSettings = { ...c.settings };
      c.coverage = out.photographedCoverage;
      // Keep capture-time warnings (low storage, exposure lock…); replace the previous stitch's.
      const previousStitchWarnings = new Set(c.stitchReport?.warnings ?? []);
      const isOldStitchWarning = (w: string) =>
        previousStitchWarnings.has(w) ||
        w.startsWith('Output width clamped') ||
        w.startsWith('Incomplete coverage') ||
        w.startsWith('Few matching details') ||
        w === 'Stitched with CPU fallback.';
      c.warnings = [...c.warnings.filter((w) => !isOldStitchWarning(w)), ...report.warnings];
      c.stitchReport = report;

      await this.store.writePanorama(c.id, workerOutput.jpegBytes);
      // Diagnostic images live next to the frames (deleted with the capture, exported in the ZIP).
      const pngs: Array<[string, Uint8Array | null]> = [
        [DIAGNOSTIC_OVERVIEW_FILE, workerOutput.pngs.overview],
        [DIAGNOSTIC_MASK_FILE, workerOutput.pngs.coverageMask],
        [DIAGNOSTIC_FILL_FILE, workerOutput.pngs.fillMask],
        [DIAGNOSTIC_MATCHES_FILE, workerOutput.pngs.matches]
      ];
      for (const [file, bytes] of pngs) {
        if (bytes) await this.store.writeRawFrameFile(c.id, file, bytes);
        else await this.store.deleteFrame(c.id, file).catch(() => undefined);
      }
      if (workerOutput.thumbBytes && workerOutput.thumbBytes.byteLength > 0) {
        await this.store.writeThumbnail(c.id, workerOutput.thumbBytes);
      }
      await this.store.save(c);
      this.revokeThumbnail(c.id);
      await this.refreshLibrary();
      this.selected = c;
      this.viewerDocId = null; // Force detail viewer to load newly stitched panorama
    } catch (err) {
      if (!(err instanceof Error && err.message === 'Cancelled')) {
        this.alertMessage = err instanceof Error ? err.message : String(err);
      }
    } finally {
      await this.releaseWakeLock();
      this.progress = null;
      this.render();
    }
  }

  private async runExport(capture: CaptureDocument): Promise<void> {
    if (this.progress !== null) return;

    if (capture.settings.includeFrames && capture.frames.length > 0) {
      const estBytes = await this.exporter.estimateRawFramesBytes(capture);
      if (estBytes > 45 * 1024 * 1024) {
        const mb = (estBytes / (1024 * 1024)).toFixed(0);
        const proceed = window.confirm(
          `Raw frames add ~${mb} MB to the ZIP package. Continue with raw frames included?`
        );
        if (!proceed) return;
      }
    }

    this.progress = 0.2;
    this.activity = 'Preparing MIRAS package…';
    this.cancelled = false;
    this.renderOverlays();

    try {
      await new Promise((r) => setTimeout(r, 20));
      const archive = await this.exporter.export(capture, {
        deviceModel: DeviceInfo.model,
        cancelled: () => this.cancelled
      });
      this.progress = 1;
      this.updateProgressDOM();
      await ExportService.shareOrDownload(
        archive.zipBytes,
        `${archive.slug}.zip`,
        'application/zip'
      );
    } catch (err) {
      if (!(err instanceof Error && err.message === 'Cancelled')) {
        this.alertMessage = err instanceof Error ? err.message : String(err);
      }
    } finally {
      this.progress = null;
      this.renderOverlays();
    }
  }

  private async loadSample(runTest: boolean): Promise<void> {
    if (this.progress !== null) return;
    this.progress = 0.05;
    this.activity = runTest ? 'Running synthetic stitch test…' : 'Creating sample capture…';
    this.cancelled = false;
    this.showDebugSheet = false;
    this.renderOverlays();

    try {
      const testImg = await this.ensureTestPanoramaLoaded();
      const doc = createCaptureDocument({
        name: runTest ? 'Synthetic stitch verification' : 'MIRAS test panorama',
        settings: {
          width: 2048,
          includeFrames: false,
          nadirCap: false,
          refinement: false,
          enhance: true,
          fillGaps: true
        },
        targets: ShotPlanner.plan(77, 63)
      });

      let sourceRaster: RasterImage | null = null;
      if (testImg && testImg.complete && testImg.naturalWidth > 0) {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 2048 / testImg.naturalWidth);
        canvas.width = Math.round(testImg.naturalWidth * scale);
        canvas.height = Math.round(testImg.naturalHeight * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(testImg, 0, 0, canvas.width, canvas.height);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          sourceRaster = new RasterImage(canvas.width, canvas.height, imgData.data);
        }
      }

      if (runTest) {
        const rawFrames = SyntheticFixture.frames({
          width: 960,
          height: 720,
          source: sourceRaster,
          noise: 0.5
        });
        const compFrames = Reprojection.compensate(rawFrames);
        const rawResult = await this.stitcher.render(compFrames, 2048, {
          cpu: true,
          cancelled: () => this.cancelled,
          progress: (val) => {
            this.progress = val;
            this.updateProgressDOM();
          }
        });
        const m = SyntheticFixture.metrics(rawResult.image, sourceRaster);
        const pass =
          m.meanAbsoluteError < 0.06 &&
          Math.abs(m.bestHorizontalShift) <= 2 &&
          m.seamError < 0.02 &&
          m.coverage >= 0.98;
        this.metrics = `${m.description} · ${pass ? 'PASS' : 'FAIL'}`;
        doc.coverage = m.coverage;
        const jpegBytes = await ImageCodec.jpeg(rawResult.image, null);
        await this.store.writePanorama(doc.id, jpegBytes);
        const thumbRaster = ImageCodec.downsampleIfNeeded(rawResult.image, 320);
        const thumbBytes = await ImageCodec.jpeg(thumbRaster, null, 0.72);
        await this.store.writeThumbnail(doc.id, thumbBytes);
      } else {
        const panorama = sourceRaster ?? SyntheticFixture.panorama(2048);
        const jpegBytes = await ImageCodec.jpeg(panorama, null);
        await this.store.writePanorama(doc.id, jpegBytes);
        const thumbRaster = ImageCodec.downsampleIfNeeded(panorama, 320);
        const thumbBytes = await ImageCodec.jpeg(thumbRaster, null, 0.72);
        await this.store.writeThumbnail(doc.id, thumbBytes);
        doc.coverage = 1;
      }

      doc.stitched = true;
      doc.stitchedSettings = { ...doc.settings };
      doc.warnings = ['Synthetic sample; no real camera frames.'];
      await this.store.save(doc);
      await this.refreshLibrary();
      this.selected = doc;
    } catch (err) {
      if (!(err instanceof Error && err.message === 'Cancelled')) {
        this.alertMessage = err instanceof Error ? err.message : String(err);
      }
    } finally {
      this.progress = null;
      this.render();
    }
  }

  private static verticalFOVFrom35mm(focal35mm: number, width: number, height: number): number {
    // 35mm full-frame sensor is 36mm x 24mm (diagonal 43.27mm)
    const sensorVerticalMm = height >= width ? 36 : 24;
    const vfov = (2 * Math.atan(sensorVerticalMm / (2 * focal35mm)) * 180) / Math.PI;
    return Math.min(110, Math.max(25, vfov));
  }

  private async executePhotoImport(
    files: File[],
    layoutMode: 'autoRing' | 'singleRow',
    defaultVfovDeg: number
  ): Promise<void> {
    if (files.length === 0 || this.progress !== null) return;
    this.progress = 0.02;
    this.activity = 'Importing photographs…';
    this.cancelled = false;
    this.pendingImportFiles = null;
    this.renderOverlays();

    try {
      const firstBytes = new Uint8Array(await files[0].arrayBuffer());
      const exifFocal35 = ImageCodec.readExifFocalLength35mm(firstBytes);
      const firstDims = ImageCodec.readImageDimensions(firstBytes) ?? { width: 1280, height: 960 };
      const vfov = exifFocal35
        ? AppController.verticalFOVFrom35mm(exifFocal35, firstDims.width, firstDims.height)
        : defaultVfovDeg;
      const aspect = firstDims.width / Math.max(1, firstDims.height);
      const hfov =
        (2 * Math.atan(aspect * Math.tan((vfov * Math.PI) / 360)) * 180) / Math.PI;

      const targets: ShotTarget[] =
        layoutMode === 'singleRow'
          ? files.map((_, idx) => ({
              id: idx,
              optional: false,
              angle: new SphericalAngle((idx * 360) / Math.max(1, files.length), 0)
            }))
          : ShotPlanner.plan(hfov, vfov);

      const doc = createCaptureDocument({
        name: `Imported Capture (${files.length} shots)`,
        targets
      });

      // Same quality policy as live capture (no automatic retakes are possible for files):
      // measure every photo first; failures need one explicit decision before anything is saved.
      const qualities: Array<FrameRecord['quality']> = [];
      const failed: string[] = [];
      for (let i = 0; i < files.length; i++) {
        if (this.cancelled) throw new Error('Cancelled');
        let metrics = null;
        try {
          const bmp = await createImageBitmap(files[i]);
          const scale = 480 / Math.max(bmp.width, bmp.height);
          const qw = Math.max(32, Math.round(bmp.width * scale));
          const qh = Math.max(32, Math.round(bmp.height * scale));
          const qc = Object.assign(document.createElement('canvas'), { width: qw, height: qh });
          const qctx = qc.getContext('2d', { willReadFrequently: true });
          if (qctx) {
            qctx.imageSmoothingQuality = 'high';
            qctx.drawImage(bmp, 0, 0, qw, qh);
            metrics = FrameQuality.measure(qctx.getImageData(0, 0, qw, qh).data, qw, qh);
          }
          bmp.close();
        } catch {
          metrics = null;
        }
        const action = qualityGate(metrics, { simulated: false, failuresSoFar: AUTO_RETAKES, acceptedRatios: [] });
        if (action.kind === 'accept') {
          qualities.push(action.record);
        } else if (action.kind === 'ask') {
          qualities.push(acceptedWithWarning(action.record));
          failed.push(`${files[i].name}: ${action.reason}`);
        } else {
          qualities.push(undefined);
        }
        this.activity = `Checking photo quality ${i + 1} of ${files.length}…`;
        this.updateProgressDOM();
      }
      if (failed.length > 0) {
        const keep = window.confirm(
          `${failed.length} photo(s) failed the quality check:\n${failed.slice(0, 8).join('\n')}${failed.length > 8 ? '\n…' : ''}\n\nImport them with a recorded quality warning? (Cancel imports nothing.)`
        );
        if (!keep) throw new Error('Cancelled');
      }

      for (let i = 0; i < files.length; i++) {
        if (this.cancelled) throw new Error('Cancelled');
        const file = files[i];
        const buf = i === 0 ? firstBytes : new Uint8Array(await file.arrayBuffer());
        const dims = ImageCodec.readImageDimensions(buf);
        let w = dims?.width ?? 0;
        let h = dims?.height ?? 0;
        if (w <= 0 || h <= 0) {
          const bitmap = await createImageBitmap(file);
          w = bitmap.width;
          h = bitmap.height;
          bitmap.close();
        }

        const fileFocal35 = ImageCodec.readExifFocalLength35mm(buf) ?? exifFocal35;
        const frameVfov = fileFocal35
          ? AppController.verticalFOVFrom35mm(fileFocal35, w, h)
          : vfov;

        const target = targets[i % targets.length];
        const record = {
          index: i,
          target: { yaw: target.angle.yaw, pitch: target.angle.pitch },
          transform: CaptureService.buildTransformFromSpherical(
            target.angle.yaw,
            target.angle.pitch
          ),
          intrinsics: CaptureService.buildIntrinsics(w, h, frameVfov),
          width: w,
          height: h,
          timestamp: i,
          exposure: 0.016,
          file: frameFileName(i),
          quality: qualities[i]
        };
        await this.store.writeFrame(buf, record, doc.id);
        doc.frames.push(record);
        this.progress = ((i + 1) / files.length) * 0.95;
        this.activity = `Importing photo ${i + 1} of ${files.length}…`;
        this.updateProgressDOM();
        await new Promise((r) => setTimeout(r, 0));
      }

      await this.store.save(doc);
      await this.refreshLibrary();
      this.selected = doc;
    } catch (err) {
      if (!(err instanceof Error && err.message === 'Cancelled')) {
        this.alertMessage = err instanceof Error ? err.message : String(err);
      }
    } finally {
      this.progress = null;
      this.render();
    }
  }

  // MARK: - Rendering

  render(): void {
    if (this.inCaptureMode) {
      if (this.activeScreen !== 'capture') {
        this.renderCaptureScreen();
      } else {
        this.updateCaptureControlsDOM();
      }
      this.renderOverlays();
      return;
    }
    if (this.selected) {
      if (this.activeScreen !== 'detail' || this.viewerDocId !== this.selected.id) {
        this.renderDetailScreen(this.selected);
      } else {
        this.updateDetailHeaderAndListDOM(this.selected);
      }
      this.renderOverlays();
      return;
    }
    this.renderLibraryScreen();
    this.renderOverlays();
  }

  private renderLibraryScreen(): void {
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
      this.viewerDocId = null;
      this.hotspotDomElements.clear();
    }
    this.activeScreen = 'library';
    const debugMode = this.isDebugEnabled();

    const swBannerHtml = this.swUpdateCallback
      ? `<div class="install-banner" role="status">
          <span>A new version of MIRAS Capture is ready.</span>
          <button class="btn btn-primary btn-sm" id="sw-update-apply-btn">Update Now</button>
        </div>`
      : '';

    const installBannerHtml = this.deferredInstallPrompt
      ? `<div class="install-banner">
          <span>Install MIRAS Capture on your home screen for full-screen offline use.</span>
          <button class="btn btn-primary btn-sm" id="pwa-install-btn">Install App</button>
        </div>`
      : this.showIosInstallBanner
      ? `<div class="install-banner">
          <span>Install on iPhone: tap <strong>Share</strong> in Safari, then <strong>Add to Home Screen</strong>.</span>
          <button class="btn btn-secondary btn-sm" id="dismiss-ios-install-btn">Dismiss</button>
        </div>`
      : '';

    const warningHtml =
      this.libraryWarnings.length > 0
        ? `<div class="warning-banner" role="alert">
            <span>⚠️ ${this.libraryWarnings.length} capture(s) could not be loaded. Their files are kept for recovery.</span>
          </div>`
        : '';

    const listHtml =
      this.captures.length === 0
        ? `<div class="empty-state">
            <div class="empty-icon" aria-hidden="true">360°</div>
            <h3>Your collection begins here</h3>
            <p>Follow the dots to capture your first 360° heritage place, or import photos from your phone.</p>
          </div>`
        : `<div class="capture-list">
            ${this.captures
              .map((c) => {
                const thumbUrl = this.thumbCache.get(c.id);
                const subtitle =
                  c.place ||
                  new Date(c.date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });
                const isUnfinished = !c.stitched && c.frames.length < (c.targets.length || 38);
                return `
                  <div class="capture-card" data-open-id="${c.id}">
                    <div class="capture-card-main">
                      <div class="capture-thumb">
                        ${
                          thumbUrl
                            ? `<img data-thumb-id="${c.id}" src="${thumbUrl}" alt="${this.escapeHtml(
                                c.name
                              )}" loading="lazy" />`
                            : `<span>360°</span>`
                        }
                      </div>
                      <div class="capture-meta">
                        <div class="capture-name">${this.escapeHtml(c.name)}</div>
                        <div class="capture-sub">${this.escapeHtml(subtitle)} · ${
                  c.frames.length
                } shots</div>
                        <div class="capture-status">${captureStatus(c)}</div>
                      </div>
                    </div>
                    <div class="capture-actions">
                      ${
                        isUnfinished
                          ? `<button class="btn btn-primary btn-sm" data-resume-id="${c.id}">Resume</button>`
                          : ''
                      }
                      <button class="btn btn-secondary btn-sm" data-restitch-id="${c.id}" ${
                  c.frames.length === 0 ? 'disabled' : ''
                }>${c.stitched ? 'Re-stitch' : 'Stitch'}</button>
                      <button class="btn btn-secondary btn-sm" data-export-id="${c.id}" ${
                  !c.stitched ? 'disabled' : ''
                }>Export</button>
                      <button class="btn btn-danger btn-sm" data-delete-id="${
                        c.id
                      }" aria-label="Delete ${this.escapeHtml(c.name)}">✕</button>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>`;

    this.screenRoot.innerHTML = `
      <header class="topbar">
        <div class="topbar-title" id="app-title-btn">
          MIRAS Capture
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          ${
            debugMode
              ? `<button class="btn btn-secondary btn-sm" id="debug-menu-btn">Sample / Test Tools</button>
                 <span class="topbar-badge">DEV / DEBUG</span>`
              : ''
          }
        </div>
      </header>

      <section class="hero">
        <div class="hero-eyebrow">MIRAS</div>
        <h1 class="hero-title">Capture a place.<br/>Keep its story.</h1>
        <p class="hero-subtitle">Guided 360° spherical capture, on-device stitching, and hotspot authoring for phones.</p>
      </section>

      <div class="action-bar">
        <button class="btn btn-primary" id="new-capture-btn" style="flex: 2; min-width: 190px;">
          <span aria-hidden="true">◉</span> New 360° Capture
        </button>
        ${
          debugMode
            ? `<button class="btn btn-secondary" id="load-sample-quick-btn" style="flex: 1; min-width: 150px;">
                 Load Sample Panorama
               </button>`
            : ''
        }
        <label class="btn btn-secondary" style="flex: 1; min-width: 150px;">
          Import Photos
          <input type="file" id="import-files-input" accept="image/*" multiple style="display:none;" />
        </label>
      </div>

      ${swBannerHtml}
      ${installBannerHtml}
      ${warningHtml}
      ${listHtml}
    `;

    this.bindLibraryEvents();
  }

  private bindLibraryEvents(): void {
    document.getElementById('new-capture-btn')?.addEventListener('click', () => {
      void this.startNewCapture();
    });
    document.getElementById('load-sample-quick-btn')?.addEventListener('click', () => {
      void this.loadSample(false);
    });
    document.getElementById('debug-menu-btn')?.addEventListener('click', () => {
      this.showDebugSheet = true;
      this.renderOverlays();
    });

    document.getElementById('sw-update-apply-btn')?.addEventListener('click', () => {
      this.swUpdateCallback?.();
    });

    document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
      if (!this.deferredInstallPrompt) return;
      await this.deferredInstallPrompt.prompt();
      this.deferredInstallPrompt = null;
      this.renderLibraryScreen();
    });

    document.getElementById('dismiss-ios-install-btn')?.addEventListener('click', () => {
      this.showIosInstallBanner = false;
      this.safeSetStorage('miras_ios_install_dismissed', 'true');
      this.renderLibraryScreen();
    });

    const importInput = document.getElementById('import-files-input') as HTMLInputElement | null;
    importInput?.addEventListener('change', () => {
      try {
        if (importInput.files && importInput.files.length > 0 && this.progress === null) {
          this.pendingImportFiles = Array.from(importInput.files);
          this.renderOverlays();
        }
      } finally {
        importInput.value = '';
      }
    });

    this.screenRoot.querySelectorAll('[data-open-id]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button')) return;
        const id = (el as HTMLElement).dataset.openId;
        const found = this.captures.find((c) => c.id === id);
        if (found) {
          this.selected = found;
          this.render();
        }
      });
    });

    this.screenRoot.querySelectorAll('[data-resume-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.resumeId;
        const found = this.captures.find((c) => c.id === id);
        if (found) void this.startNewCapture(found);
      });
    });

    this.screenRoot.querySelectorAll('[data-restitch-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.restitchId;
        const found = this.captures.find((c) => c.id === id);
        if (found) void this.runStitch(found);
      });
    });

    this.screenRoot.querySelectorAll('[data-export-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.exportId;
        const found = this.captures.find((c) => c.id === id);
        if (found) void this.runExport(found);
      });
    });

    this.screenRoot.querySelectorAll('[data-delete-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.deleteId;
        const found = this.captures.find((c) => c.id === id);
        if (found) {
          this.deletingCapture = found;
          this.renderOverlays();
        }
      });
    });
  }

  // MARK: - Capture Screen

  private renderCaptureScreen(): void {
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
      this.viewerDocId = null;
      this.hotspotDomElements.clear();
    }
    this.activeScreen = 'capture';

    this.screenRoot.innerHTML = `
      <div class="capture-fullscreen">
        <video id="capture-video" class="capture-video" playsinline muted></video>
        <canvas id="capture-hud-canvas" class="capture-canvas"></canvas>

        <div class="capture-hud-top">
          <div class="capture-pill-bar">
            <button class="btn btn-secondary btn-sm" id="capture-close-btn">✕ Close</button>
            <span class="capture-counter" id="capture-counter-text">
              ${this.captureDoc.frames.length} / ${this.captureDoc.targets.length}
            </span>
            <button class="btn btn-primary btn-sm" id="capture-finish-btn" ${
              !this.canFinishCapture || this.busy ? 'disabled' : ''
            }>Finish</button>
          </div>
          <div class="coaching-pill" id="capture-coaching-text" aria-live="polite">${this.escapeHtml(
            this.coaching
          )}</div>
          <button class="btn btn-primary" id="capture-enable-motion-btn" style="display:none;">
            Enable Motion
          </button>
          <div id="capture-subbar-slot" style="display:flex; gap:8px; align-items:center;"></div>
          <div class="build-label" aria-hidden="true">build ${__BUILD_ID__}</div>
        </div>

        <div class="capture-hud-bottom">
          <div class="capture-bottom-card">
            <button class="btn btn-secondary btn-sm" id="capture-undo-btn" ${
              this.captureDoc.frames.length === 0 || this.busy ? 'disabled' : ''
            }>↶ Undo</button>
            <button class="btn btn-primary btn-sm" id="capture-snap-next-btn" style="display:none;" title="Simulator only: snap target">
              ◎ Snap Target
            </button>
            <canvas id="sphere-minimap" width="88" height="88" style="width:88px;height:88px;"></canvas>
          </div>
        </div>

        <img id="capture-resync-overlay" class="capture-resync-overlay" alt="" style="display:none;" />
        <div id="capture-resync-panel" class="capture-resync-panel" style="display:none;" role="status" aria-live="polite">
          <div id="capture-resync-text">Line up the faded photo with the live view and hold still.</div>
          <button class="btn btn-secondary btn-sm" id="capture-resync-skip-btn">Continue without sync</button>
        </div>
        <div id="capture-flash-el" class="flash-overlay"></div>
      </div>
    `;

    document.getElementById('capture-close-btn')?.addEventListener('click', () => {
      this.stopCapture();
    });

    document.getElementById('capture-resync-skip-btn')?.addEventListener('click', () => {
      const ok = window.confirm(
        'Continue without re-syncing? New photos may be placed at the wrong angle relative to earlier ones; the stitch will try to correct small errors only. This is recorded in the capture.'
      );
      if (ok) this.continueUnverified();
    });

    // Shown when no gyro data arrives. Tapping it is a fresh user gesture, which is what
    // iOS needs before it will show the Motion & Orientation prompt.
    document.getElementById('capture-enable-motion-btn')?.addEventListener('click', () => {
      const DevOrient = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (typeof DevOrient?.requestPermission !== 'function') {
        this.alertMessage =
          'This browser is not sending motion sensor data. Drag the screen to aim at the dots, or open the link in Safari (iPhone) or Chrome (Android).';
        this.renderOverlays();
        return;
      }
      // Must be called synchronously inside the tap — no await before this line.
      DevOrient.requestPermission()
        .then((state) => {
          if (state === 'granted') {
            this.motionPermissionDenied = false;
            this.headingService.motionPermissionState = 'granted';
            this.headingService.startCompassListener();
            this.motionPromptShownAt = performance.now();
          } else {
            this.motionPermissionDenied = true;
            this.alertMessage = MOTION_BLOCKED_HELP;
            this.renderOverlays();
          }
          this.hudDirty = true;
        })
        .catch(() => {
          this.motionPermissionDenied = true;
          this.alertMessage = MOTION_BLOCKED_HELP;
          this.renderOverlays();
        });
    });

    document.getElementById('capture-finish-btn')?.addEventListener('click', async () => {
      const finishedDoc = this.captureDoc;
      const cov = this.coverageReport;
      if (cov && cov.fraction < COVERAGE_TARGET) {
        // Never describe an incomplete capture as complete: require an explicit acknowledgement.
        const where = cov.gaps.map((g) => `yaw ${Math.round(g.yaw)}°, pitch ${Math.round(g.pitch)}°`).join('; ');
        const ok = window.confirm(
          `Only ${(cov.fraction * 100).toFixed(1)}% of the sphere is photographed. Missing areas: ${where || 'small gaps'}.\n\nFinish as an INCOMPLETE capture? (Missing areas will be marked, or filled only if "Fill gaps" is on.)`
        );
        if (!ok) return;
        finishedDoc.incompleteAcknowledged = {
          coverage: cov.fraction,
          gaps: cov.gaps.map((g) => ({ yaw: +g.yaw.toFixed(1), pitch: +g.pitch.toFixed(1) }))
        };
        const note = `Capture finished INCOMPLETE by user choice (${(cov.fraction * 100).toFixed(1)}% photographed).`;
        finishedDoc.warnings = [...finishedDoc.warnings.filter((w) => !w.startsWith('Capture finished INCOMPLETE')), note];
      } else {
        finishedDoc.incompleteAcknowledged = null;
      }
      this.stopCapture();
      await this.store.save(finishedDoc);
      await this.refreshLibrary();
      this.selected = finishedDoc;
      this.render();
    });

    // Phase 1.11: Undo removes last shot by timestamp, deletes JPEG from IDB, and rearms target
    document.getElementById('capture-undo-btn')?.addEventListener('click', async () => {
      if (this.busy || this.captureDoc.frames.length === 0) return;
      let latestIdx = 0;
      for (let i = 1; i < this.captureDoc.frames.length; i++) {
        if (this.captureDoc.frames[i].timestamp >= this.captureDoc.frames[latestIdx].timestamp) {
          latestIdx = i;
        }
      }
      const [removed] = this.captureDoc.frames.splice(latestIdx, 1);
      if (removed) {
        const fname = removed.file ?? frameFileName(removed.index);
        this.trigger.rearm(removed.index);
        await this.store.deleteFrame(this.captureDoc.id, fname);
        this.refreshCoverage();
        this.scheduleCaptureSave();
        this.minimapDirty = true;
        this.hudDirty = true;
        this.updateCaptureControlsDOM();
      }
    });

    // Phase 0.5: Snap Target is only enabled in simulator mode
    document.getElementById('capture-snap-next-btn')?.addEventListener('click', () => {
      if (!this.captureService.simulatedMode || this.busy || !this.currentTarget || !this.sample) {
        return;
      }
      this.captureService.manualYaw = Geometry.wrap(
        this.currentTarget.angle.yaw + this.captureDoc.referenceWorldYaw
      );
      this.captureService.manualPitch = this.currentTarget.angle.pitch;
      this.captureService.stateDirty = true;
      const synthSample = this.captureService.readCurrentSample();
      void this.takeShot(this.currentTarget, synthSample);
    });

    const hudCanvas = document.getElementById('capture-hud-canvas') as HTMLCanvasElement | null;
    if (hudCanvas) {
      this.hudCssWidth = hudCanvas.clientWidth || window.innerWidth || 390;
      this.hudCssHeight = hudCanvas.clientHeight || window.innerHeight || 844;
      this.hudDpr = Math.min(2, window.devicePixelRatio || 1);
      hudCanvas.width = Math.round(this.hudCssWidth * this.hudDpr);
      hudCanvas.height = Math.round(this.hudCssHeight * this.hudDpr);

      if (typeof ResizeObserver !== 'undefined') {
        this.hudResizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const cr = entry.contentRect;
            if (cr.width > 0 && cr.height > 0) {
              this.hudCssWidth = Math.round(cr.width);
              this.hudCssHeight = Math.round(cr.height);
              this.hudDpr = Math.min(2, window.devicePixelRatio || 1);
              hudCanvas.width = Math.round(this.hudCssWidth * this.hudDpr);
              hudCanvas.height = Math.round(this.hudCssHeight * this.hudDpr);
              this.hudDirty = true;
            }
          }
        });
        this.hudResizeObserver.observe(hudCanvas);
      }

      let dragging = false;
      let prev = { x: 0, y: 0 };
      hudCanvas.addEventListener('pointerdown', (e) => {
        dragging = true;
        prev = { x: e.clientX, y: e.clientY };
      });
      hudCanvas.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        prev = { x: e.clientX, y: e.clientY };
        this.captureService.manualYaw = Geometry.wrap(this.captureService.manualYaw + dx * 0.25);
        this.captureService.manualPitch = Math.min(
          89.5,
          Math.max(-89.5, this.captureService.manualPitch - dy * 0.25)
        );
        this.captureService.stateDirty = true;
      });
      hudCanvas.addEventListener('pointerup', () => {
        dragging = false;
      });
      hudCanvas.addEventListener('pointercancel', () => {
        dragging = false;
      });
    }
  }

  private populateCameraSelector(): void {
    const slot = document.getElementById('capture-subbar-slot');
    const snapBtn = document.getElementById('capture-snap-next-btn');
    if (snapBtn) {
      snapBtn.style.display = this.captureService.simulatedMode ? 'inline-flex' : 'none';
    }
    if (!slot) return;

    let html = '';
    if (this.captureService.simulatedMode) {
      html += `<span class="topbar-badge" style="pointer-events:auto;">SIMULATOR MODE</span>`;
    }
    if (this.captureService.availableDevices.length > 1) {
      html += `
        <select id="capture-camera-select" class="camera-select-pill" aria-label="Select rear camera lens">
          ${this.captureService.availableDevices
            .map(
              (cam) =>
                `<option value="${this.escapeHtml(cam.deviceId)}" ${
                  cam.deviceId === this.captureService.selectedDeviceId ? 'selected' : ''
                }>${this.escapeHtml(cam.label)}</option>`
            )
            .join('')}
        </select>
      `;
    }
    slot.innerHTML = html;

    const selectEl = document.getElementById('capture-camera-select') as HTMLSelectElement | null;
    selectEl?.addEventListener('change', () => {
      // Mixed-lens captures cannot be stitched consistently (different focal length,
      // distortion and optical centre), so the lens is locked once the first photo exists.
      if (this.captureDoc.frames.length > 0) {
        selectEl.value = this.captureService.selectedDeviceId ?? selectEl.value;
        this.alertMessage =
          'The lens cannot change in the middle of a capture — photos from different lenses do not stitch together. Finish or close this capture, then start a new one with the other lens.';
        this.renderOverlays();
        return;
      }
      const videoEl = document.getElementById('capture-video') as HTMLVideoElement | null;
      if (videoEl && selectEl.value) {
        void this.captureService.start(videoEl, { deviceId: selectEl.value }).catch((err) => {
          this.showBlockingCameraError(err);
        });
      }
    });
  }

  private updateCaptureControlsDOM(): void {
    const counterText = `${this.captureDoc.frames.length} / ${this.captureDoc.targets.length}${this.gapTargetsAdded > 0 ? ` (${this.captureDoc.plan?.initialCount} planned + ${this.gapTargetsAdded})` : ''}`;
    if (counterText !== this.lastCounterText) {
      const counterEl = document.getElementById('capture-counter-text');
      if (counterEl) {
        counterEl.textContent = counterText;
        counterEl.title = this.planExplanation();
        this.lastCounterText = counterText;
      }
    }

    if (this.coaching !== this.lastCoachingText) {
      const coachingEl = document.getElementById('capture-coaching-text');
      if (coachingEl) {
        coachingEl.textContent = this.coaching;
        this.lastCoachingText = this.coaching;
      }
    }

    const finishBtn = document.getElementById('capture-finish-btn') as HTMLButtonElement | null;
    if (finishBtn) {
      const shouldDisable = !this.canFinishCapture || this.busy;
      if (finishBtn.disabled !== shouldDisable) {
        finishBtn.disabled = shouldDisable;
      }
    }

    const undoBtn = document.getElementById('capture-undo-btn') as HTMLButtonElement | null;
    if (undoBtn) {
      const shouldDisable = this.captureDoc.frames.length === 0 || this.busy;
      if (undoBtn.disabled !== shouldDisable) {
        undoBtn.disabled = shouldDisable;
      }
    }

    const flashEl = document.getElementById('capture-flash-el');
    if (flashEl) {
      flashEl.classList.toggle('active', this.flash);
    }

    // Offer "Enable Motion" when the camera is running but no gyro data has arrived
    // for 1.5 s (permission refused, or the prompt never appeared).
    const motionBtn = document.getElementById('capture-enable-motion-btn');
    if (motionBtn) {
      const waitingForGyro =
        !this.captureService.simulatedMode &&
        !this.captureService.hasHardwareGyro &&
        this.motionPromptShownAt !== null &&
        performance.now() - this.motionPromptShownAt > 1500;
      const display = waitingForGyro ? 'inline-flex' : 'none';
      if (motionBtn.style.display !== display) motionBtn.style.display = display;
    }
  }

  private drawCaptureHUD(): void {
    this.updateCaptureControlsDOM();
    const canvas = document.getElementById('capture-hud-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    const w = this.hudCssWidth;
    const h = this.hudCssHeight;
    const dpr = this.hudDpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (this.captureService.simulatedMode) {
      const pitchOffset = (this.currentAngle.pitch / 90) * (h * 0.4);
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#141e28');
      grad.addColorStop(Math.min(1, Math.max(0, 0.5 + pitchOffset / h)), '#2d241e');
      grad.addColorStop(1, '#12100e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    const done = this.completedSet;
    const sample = this.sample;
    const basis = sample?.basis;

    // Focal length in CSS px of the on-screen video. The <video> uses object-fit: cover, so
    // the camera image is scaled (and cropped) to fill the screen; dots must use the same
    // scale or they slide against the scene. Same idea as ARKit's projectPoint in iOS.
    const fovTan = Math.tan((this.captureService.verticalFOV * Math.PI) / 360);
    const vw = this.captureService.videoElement?.videoWidth || 0;
    const vh = this.captureService.videoElement?.videoHeight || 0;
    const fpx =
      vw > 0 && vh > 0 && !this.captureService.simulatedMode
        ? (Math.max(vw, vh) / 2 / fovTan) * Math.max(w / vw, h / vh)
        : Math.max(w, h) / 2 / fovTan;

    const refRad = (this.captureDoc.referenceWorldYaw * Math.PI) / 180;
    const cosRef = Math.cos(refRad);
    const sinRef = Math.sin(refRad);
    const pulse = sample ? Math.sin(sample.timestamp * 5) * 2 : 0;
    let arrow: { x: number; y: number; rot: number } | null = null;

    if (basis) {
      const [rX, rY, rZ, uX, uY, uZ, fX, fY, fZ] = basis;
      for (const dot of this.captureDoc.targets) {
        // Target direction in world space = dot yaw + reference yaw (rotate about the Y axis).
        const t = dot.angle.vector;
        const vx = t.x * cosRef - t.z * sinRef;
        const vy = t.y;
        const vz = t.x * sinRef + t.z * cosRef;

        const camX = vx * rX + vy * rY + vz * rZ;
        const camY = vx * uX + vy * uY + vz * uZ;
        const camZ = vx * fX + vy * fY + vz * fZ;
        const isNext = dot.id === this.currentTarget?.id;

        const inFront = camZ > 0.05;
        const sx = inFront ? w / 2 + (fpx * camX) / camZ : NaN;
        const sy = inFront ? h / 2 - (fpx * camY) / camZ : NaN;

        if (isNext) {
          // Edge arrow toward the next dot when it is off-screen or behind (iOS guidance).
          const visible = inFront && sx > 24 && sx < w - 24 && sy > 100 && sy < h - 120;
          if (!visible) {
            let dx = camX;
            let dy = -camY;
            if (Math.abs(dx) + Math.abs(dy) < 1e-4) dy = 1;
            const s = Math.min(
              (w / 2 - 28) / Math.max(0.01, Math.abs(dx)),
              (h / 2 - 120) / Math.max(0.01, Math.abs(dy))
            );
            arrow = { x: w / 2 + dx * s, y: h / 2 + dy * s, rot: Math.atan2(dx, -dy) };
          }
        }

        if (!inFront || sx < -24 || sx > w + 24 || sy < -24 || sy > h + 24) continue;
        const isDone = done.has(dot.id);
        const radius = isDone ? 5 : isNext ? 13 + pulse : 8;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = isDone ? '#22c55e' : '#ffffff';
        ctx.fill();
        if (isNext) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.stroke();
        }
      }

      // Measured uncovered areas (from real frame footprints) as red rings, so the user sees
      // exactly what is still missing — including after the gap-dot rounds are used up.
      const cov = this.coverageReport;
      if (cov && cov.fraction < COVERAGE_TARGET && this.captureDoc.frames.length > 0) {
        for (const g of cov.gaps) {
          const t = g.vector;
          const vx = t.x * cosRef - t.z * sinRef, vy = t.y, vz = t.x * sinRef + t.z * cosRef;
          const camZ = vx * fX + vy * fY + vz * fZ;
          if (camZ <= 0.05) continue;
          const gx = w / 2 + (fpx * (vx * rX + vy * rY + vz * rZ)) / camZ;
          const gy = h / 2 - (fpx * (vx * uX + vy * uY + vz * uZ)) / camZ;
          if (gx < -40 || gx > w + 40 || gy < -40 || gy > h + 40) continue;
          ctx.beginPath();
          ctx.arc(gx, gy, 22, 0, Math.PI * 2);
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
          ctx.stroke();
        }
      }
    }

    if (arrow) {
      ctx.save();
      ctx.translate(arrow.x, arrow.y);
      ctx.rotate(arrow.rot);
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(13, 4);
      ctx.lineTo(4, 4);
      ctx.lineTo(4, 16);
      ctx.lineTo(-4, 16);
      ctx.lineTo(-4, 4);
      ctx.lineTo(-13, 4);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.restore();
    }

    const cx = w * 0.5;
    const cy = h * 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = 1.75;
    ctx.stroke();

    if (this.alignment > 0) {
      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        28,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * Math.min(1, this.alignment)
      );
      ctx.strokeStyle = '#e0893a';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();

    if (this.minimapDirty) {
      this.minimapDirty = false;
      const mini = document.getElementById('sphere-minimap') as HTMLCanvasElement | null;
      if (mini) {
        const mctx = mini.getContext('2d');
        if (mctx) {
          mctx.clearRect(0, 0, 88, 88);
          mctx.beginPath();
          mctx.arc(44, 44, 42, 0, Math.PI * 2);
          mctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          mctx.lineWidth = 1;
          mctx.stroke();

          for (const dot of this.captureDoc.targets) {
            const v = dot.angle.vector;
            const x = 44 + v.x * 88 * 0.43;
            const y = 44 - v.y * 88 * 0.43;
            mctx.beginPath();
            mctx.arc(x, y, 2.2, 0, Math.PI * 2);
            mctx.fillStyle = done.has(dot.id)
              ? '#22c55e'
              : v.z < 0
              ? 'rgba(255,255,255,0.9)'
              : 'rgba(255,255,255,0.3)';
            mctx.fill();
          }
        }
      }
    }
  }

  // MARK: - Detail & Panorama Screen (Persistent Viewer)

  private renderDetailScreen(doc: CaptureDocument): void {
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
      this.hotspotDomElements.clear();
    }
    this.activeScreen = 'detail';
    this.viewerDocId = doc.id;

    const isUnfinished = !doc.stitched && doc.frames.length < (doc.targets.length || 38);

    this.screenRoot.innerHTML = `
      <header class="topbar">
        <button class="btn btn-secondary btn-sm" id="detail-done-btn">← Done</button>
        <div class="topbar-title" id="detail-title-text">${this.escapeHtml(doc.name)}</div>
        <button class="btn btn-secondary btn-sm" id="detail-settings-btn" aria-label="Capture settings">⚙ Settings</button>
      </header>

      <div class="detail-container">
        ${
          doc.stitched
            ? `
          <div class="viewer-stage">
            <canvas id="panorama-webgl-canvas" class="viewer-canvas" aria-label="360 degree panorama. Drag to look around. Pinch to zoom."></canvas>
            <div id="viewer-crosshair-el" class="viewer-crosshair"></div>
            <div id="hotspot-dom-layer" class="hotspot-layer"></div>
          </div>
          <div class="viewer-toolbar">
            <span class="coords-readout" id="viewer-coords-text">Yaw 0.0° · Pitch 0.0°</span>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <button class="btn btn-secondary btn-sm" id="viewer-add-hotspot-mode-btn">+ Add Hotspot</button>
              <button class="btn btn-primary btn-sm" id="viewer-place-crosshair-btn" style="display:none;">Place Here</button>
              <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;min-height:44px;padding:0 6px;">
                <input type="checkbox" id="viewer-gyro-toggle" style="accent-color:var(--accent);width:20px;height:20px;" />
                <span>Gyro</span>
              </label>
              <button class="btn btn-secondary btn-sm" id="viewer-recenter-btn" style="display:none;">Recenter</button>
            </div>
          </div>
          <div id="detail-metrics-slot"></div>
          <div class="section-hint">Tap "+ Add Hotspot" or long-press the panorama to place a hotspot · Tap a dot to edit · Drag to move</div>
          <div class="hotspot-list" id="hotspot-list-container"></div>
        `
            : `
          <div class="empty-state">
            <div class="empty-icon">360°</div>
            <h3>Ready to stitch</h3>
            <p>${doc.frames.length} photographs are stored in this browser.</p>
          </div>
        `
        }

        <div class="action-bar" style="margin-top:auto;">
          ${
            isUnfinished
              ? `<button class="btn btn-secondary" id="detail-resume-btn" style="flex:1;">
                   Resume Capture
                 </button>`
              : ''
          }
          <button class="btn btn-primary" id="detail-stitch-btn" style="flex:1;" ${
            doc.frames.length === 0 ? 'disabled' : ''
          }>
            ${doc.stitched ? 'Re-stitch' : 'Stitch Panorama'}
          </button>
          <button class="btn btn-secondary" id="detail-download-jpg-btn" style="flex:1;" ${
            !doc.stitched ? 'disabled' : ''
          }>
            Save 360° JPEG
          </button>
          <button class="btn btn-primary" id="detail-export-btn" style="flex:1;" ${
            !doc.stitched ? 'disabled' : ''
          }>
            Export MIRAS ZIP
          </button>
        </div>
      </div>
    `;

    document.getElementById('detail-done-btn')?.addEventListener('click', async () => {
      if (this.viewer) {
        this.viewer.destroy();
        this.viewer = null;
        this.viewerDocId = null;
        this.hotspotDomElements.clear();
      }
      if (this.selected) {
        await this.store.save(this.selected);
      }
      this.selected = null;
      this.metrics = null;
      await this.refreshLibrary();
      this.render();
    });

    document.getElementById('detail-settings-btn')?.addEventListener('click', () => {
      this.showSettingsModal = true;
      this.renderOverlays();
    });

    document.getElementById('detail-resume-btn')?.addEventListener('click', () => {
      if (this.selected) void this.startNewCapture(this.selected);
    });

    document.getElementById('detail-stitch-btn')?.addEventListener('click', () => {
      if (this.selected) void this.runStitch(this.selected);
    });

    document.getElementById('detail-download-jpg-btn')?.addEventListener('click', () => {
      if (this.selected) void this.exporter.downloadPanoramaJPEG(this.selected);
    });

    document.getElementById('detail-export-btn')?.addEventListener('click', () => {
      if (this.selected) void this.runExport(this.selected);
    });

    this.updateDetailHeaderAndListDOM(doc);

    if (doc.stitched) {
      void this.setupPanoramaViewer(doc);
    }
  }

  private updateDetailHeaderAndListDOM(doc: CaptureDocument): void {
    const titleEl = document.getElementById('detail-title-text');
    if (titleEl) {
      titleEl.textContent = doc.name;
    }

    const metricsSlot = document.getElementById('detail-metrics-slot');
    if (metricsSlot) {
      const r = doc.stitchReport;
      // Reports from before v1.4 have a different shape: show only their warnings.
      const current = r && typeof r.matches === 'object' && r.matches !== null && typeof r.seams === 'object';
      const line = current
        ? `Photographed ${(r.photographedCoverage * 100).toFixed(1)}% · synthetic fill ${(r.filledFraction * 100).toFixed(1)}% · ` +
          `${r.matches.verified} verified / ${r.matches.raw} candidate points (${r.matches.ambiguous} ambiguous, ${r.matches.rejected} rejected, ${r.matches.insufficient} unverifiable) over ${r.matches.verifiedPairs}/${r.matches.pairs} pairs · ` +
          `error ${r.alignment.rmsBeforePx.toFixed(2)} → ${r.alignment.rmsAfterPx.toFixed(2)} px (same matches, 512 px scale)${r.alignment.reverted ? ' · REVERTED to sensor poses' : ''} · focal ×${r.alignment.focalScale.toFixed(3)} · ` +
          `${r.alignment.components} photo group(s), ${r.alignment.unconstrainedFrames.length} unverified photo(s) · ` +
          `disagreement areas: ${r.seams.regionsDetected} found, ${r.seams.regionsAssigned} resolved, ${r.seams.regionsSkippedTooLarge + r.seams.regionsSkippedNoCoveringPhoto + r.seams.regionsSkippedLowConfidence} unresolved · ` +
          `lens falloff ${Math.round(r.vignetting.cornerLoss * 100)}% ${r.vignetting.applied ? 'corrected' : 'not applied'} · ` +
          `${r.renderer.toUpperCase()} · ${r.outputWidth} px from ${r.decodeSize} px frames · ${(r.millis / 1000).toFixed(1)} s · ~${r.peakMBEstimate} MB (estimate)`
        : 'Stitched with an earlier version — re-stitch for the full report.';
      const verdictHtml =
        current && r.verdict
          ? `<div class="warning-banner" style="margin:6px 0 0;font-weight:600;">Stitch verdict: ${r.verdict === 'good' ? 'GOOD — every photo verified against neighbours' : r.verdict === 'review' ? 'REVIEW — usable, check the notes below' : 'RETAKE — not reliable for documentation'}</div>` +
            (r.retake ?? [])
              .slice(0, 12)
              .map((t: { frame: number; yaw: number; pitch: number; reasons: string[] }) => `<div class="warning-banner" style="margin:4px 0 0;">Retake photo #${t.frame + 1} (aim yaw ${t.yaw}°, pitch ${t.pitch > 0 ? '+' : ''}${t.pitch}°): ${this.escapeHtml(t.reasons.join('; '))}</div>`)
              .join('')
          : '';
      const reportHtml = r
        ? verdictHtml + `<div class="metrics-readout">${this.escapeHtml(line)}</div>${(r.warnings ?? [])
            .map((w: string) => `<div class="warning-banner" style="margin:6px 0 0;">${this.escapeHtml(w)}</div>`)
            .join('')}`
        : '';
      metricsSlot.innerHTML =
        reportHtml +
        (this.metrics ? `<div class="metrics-readout">${this.escapeHtml(this.metrics)}</div>` : '');
    }

    const listContainer = document.getElementById('hotspot-list-container');
    if (!listContainer) return;

    if (doc.hotspots.length === 0) {
      listContainer.innerHTML = `<div style="text-align:center;color:var(--text-secondary);padding:14px;font-size:0.85rem;">No hotspots tagged yet. Tap "+ Add Hotspot" or long-press on the 360° panorama above.</div>`;
    } else {
      listContainer.innerHTML = doc.hotspots
        .map(
          (h) => `
          <div class="hotspot-row" data-edit-hotspot="${h.id}">
            <div style="min-width:0;flex:1;">
              <div style="font-weight:600;margin-bottom:2px;">${this.escapeHtml(h.title)}</div>
              <div style="font-size:0.8rem;color:var(--text-secondary);">${this.escapeHtml(
                h.caption
              )}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
              <span class="coords-readout" style="font-size:0.75rem;">${h.yaw.toFixed(
                1
              )}°, ${h.pitch.toFixed(1)}°</span>
              <button class="btn btn-danger btn-sm" data-delete-hotspot="${h.id}">Delete</button>
            </div>
          </div>
        `
        )
        .join('');

      listContainer.querySelectorAll('[data-edit-hotspot]').forEach((row) => {
        row.addEventListener('click', (e) => {
          if ((e.target as HTMLElement).closest('[data-delete-hotspot]')) return;
          const id = (row as HTMLElement).dataset.editHotspot;
          const spot = doc.hotspots.find((h) => h.id === id);
          if (spot) {
            this.editingHotspot = { ...spot, sources: [...spot.sources] };
            this.renderOverlays();
          }
        });
      });

      listContainer.querySelectorAll('[data-delete-hotspot]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = (btn as HTMLElement).dataset.deleteHotspot;
          doc.hotspots = doc.hotspots.filter((h) => h.id !== id);
          await this.store.save(doc);
          if (this.viewer) {
            this.viewer.updateHotspots(doc.hotspots);
            this.syncHotspotDOMElements();
          }
          this.updateDetailHeaderAndListDOM(doc);
        });
      });
    }
  }

  private syncHotspotDOMElements(): void {
    const layer = document.getElementById('hotspot-dom-layer');
    if (!layer || !this.viewer) return;

    const projected = this.viewer.getProjectedHotspots();
    const activeIds = new Set<string>();

    for (const p of projected) {
      activeIds.add(p.hotspot.id);
      let dotEl = this.hotspotDomElements.get(p.hotspot.id);
      if (!dotEl) {
        dotEl = document.createElement('div');
        dotEl.className = 'hotspot-dot';
        const labelEl = document.createElement('span');
        labelEl.className = 'hotspot-label';
        dotEl.appendChild(labelEl);
        layer.appendChild(dotEl);
        this.hotspotDomElements.set(p.hotspot.id, dotEl);
      }

      if (!p.visible) {
        dotEl.style.display = 'none';
      } else {
        dotEl.style.display = 'flex';
        dotEl.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
        const labelEl = dotEl.firstElementChild as HTMLElement | null;
        if (labelEl) {
          if (p.hotspot.title) {
            labelEl.style.display = 'block';
            if (labelEl.textContent !== p.hotspot.title) {
              labelEl.textContent = p.hotspot.title;
            }
          } else {
            labelEl.style.display = 'none';
          }
        }
      }
    }

    for (const [id, el] of this.hotspotDomElements.entries()) {
      if (!activeIds.has(id)) {
        el.remove();
        this.hotspotDomElements.delete(id);
      }
    }
  }

  private async setupPanoramaViewer(doc: CaptureDocument): Promise<void> {
    const canvas = document.getElementById('panorama-webgl-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    const viewer = new PanoramaViewer(canvas);
    this.viewer = viewer;
    this.hotspotDomElements.clear();
    viewer.updateHotspots(doc.hotspots);

    viewer.onLookChange = (look) => {
      const el = document.getElementById('viewer-coords-text');
      if (el) {
        el.textContent = `Yaw ${Geometry.wrap(look.yaw).toFixed(1)}° · Pitch ${look.pitch.toFixed(
          1
        )}°`;
      }
      this.syncHotspotDOMElements();
    };

    const openNewHotspotEditor = (angle: SphericalAngle) => {
      if (!this.selected) return;
      this.editingHotspot = {
        id: generateUUID(),
        view: captureSlug(this.selected),
        title: '',
        yaw: Geometry.wrap(angle.yaw),
        pitch: angle.pitch,
        caption: '',
        sources: []
      };
      this.renderOverlays();
    };

    viewer.onCreateHotspot = (angle) => {
      openNewHotspotEditor(angle);
    };

    viewer.onSelectHotspot = (hotspot) => {
      if (!this.selected) return;
      const existing = this.selected.hotspots.find((h) => h.id === hotspot.id);
      if (existing) {
        this.editingHotspot = { ...existing, sources: [...existing.sources] };
        this.renderOverlays();
      }
    };

    viewer.onMoveHotspot = (id, angle) => {
      if (!this.selected) return;
      const target = this.selected.hotspots.find((h) => h.id === id);
      if (target) {
        target.yaw = Geometry.wrap(angle.yaw);
        target.pitch = angle.pitch;
        this.syncHotspotDOMElements();
        this.updateDetailHeaderAndListDOM(this.selected);
        this.scheduleCaptureSave(this.selected);
      }
    };

    viewer.onError = (msg) => {
      this.alertMessage = msg;
      this.renderOverlays();
    };

    const addModeBtn = document.getElementById('viewer-add-hotspot-mode-btn');
    const placeCrosshairBtn = document.getElementById('viewer-place-crosshair-btn');
    const crosshairEl = document.getElementById('viewer-crosshair-el');

    addModeBtn?.addEventListener('click', () => {
      viewer.addHotspotMode = !viewer.addHotspotMode;
      addModeBtn.classList.toggle('active-toggle', viewer.addHotspotMode);
      crosshairEl?.classList.toggle('visible', viewer.addHotspotMode);
      if (placeCrosshairBtn) {
        placeCrosshairBtn.style.display = viewer.addHotspotMode ? 'inline-flex' : 'none';
      }
    });

    placeCrosshairBtn?.addEventListener('click', () => {
      openNewHotspotEditor(new SphericalAngle(viewer.look.yaw, viewer.look.pitch));
    });

    const gyroToggle = document.getElementById('viewer-gyro-toggle') as HTMLInputElement | null;
    const recenterBtn = document.getElementById('viewer-recenter-btn');

    gyroToggle?.addEventListener('change', async () => {
      if (gyroToggle.checked) {
        const granted = await this.headingService.requestMotionPermission();
        if (!granted) {
          gyroToggle.checked = false;
          this.alertMessage = 'Motion sensor permission was denied by the browser.';
          this.renderOverlays();
          return;
        }
      }
      void viewer.setGyro(gyroToggle.checked, true);
      if (recenterBtn) {
        recenterBtn.style.display = gyroToggle.checked ? 'inline-flex' : 'none';
      }
    });

    recenterBtn?.addEventListener('click', () => {
      viewer.recenterGyro();
    });

    try {
      const bytes = await this.store.readPanorama(doc.id);
      const blob = new Blob([bytes as unknown as BlobPart], { type: 'image/jpeg' });
      const bitmap = await createImageBitmap(blob);
      viewer.loadImage(bitmap);
      this.syncHotspotDOMElements();
    } catch (err) {
      this.alertMessage = err instanceof Error ? err.message : String(err);
      this.renderOverlays();
    }
  }

  // MARK: - Modals & Overlays (Rendered exclusively into #overlay-root)

  private renderOverlays(): void {
    let html = '';

    // Onboarding Modal
    if (this.showOnboarding) {
      const titles = [
        'Stand in one spot.',
        'Turn around your phone, not your body.',
        'Follow the dots.'
      ];
      const descriptions = [
        'Keep the camera lens over the same physical point as you turn. Nearby objects and moving people can create seams.',
        'Rotate around the camera rather than stepping in a circle so overlapping shots align cleanly without parallax.',
        'Camera access captures the scene. Motion sensors track your aim. Optional location access aligns your panorama to true north.'
      ];
      const icons = ['🧍', '📱', '🟢'];

      html += `
        <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
          <div class="modal-card" style="text-align:center; padding: 32px 24px;">
            <div style="font-size: 3.2rem; margin-bottom: 16px;" aria-hidden="true">${icons[this.onboardingStep]}</div>
            <h2 id="onboarding-title" style="font-size: 1.5rem; margin-bottom: 10px;">${titles[this.onboardingStep]}</h2>
            <p style="color: var(--text-secondary); line-height: 1.5; margin-bottom: 24px;">
              ${descriptions[this.onboardingStep]}
            </p>
            <button class="btn btn-primary btn-full" id="onboarding-next-btn">
              ${this.onboardingStep === 2 ? 'Get started' : 'Continue'}
            </button>
            <div style="margin-top: 12px; font-size: 0.8rem; color: var(--text-secondary);">
              ${this.onboardingStep + 1} of 3
            </div>
          </div>
        </div>
      `;
    }

    // Debug / Sample Modal
    if (this.showDebugSheet) {
      html += `
        <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="debug-modal-title">
          <div class="modal-card">
            <div class="modal-header">
              <span class="modal-title" id="debug-modal-title">Debug & Sample Tools</span>
              <button class="btn btn-secondary btn-sm" id="close-debug-btn" aria-label="Close debug tools">✕</button>
            </div>
            <div style="display:flex; flex-direction:column; gap:12px;">
              <button class="btn btn-primary btn-full" id="run-synth-test-btn">
                Run Synthetic Stitch Self-Test
              </button>
              <button class="btn btn-secondary btn-full" id="load-sample-capture-btn">
                Load Sample Capture
              </button>
            </div>
          </div>
        </div>
      `;
    }

    // Import Photos Layout Confirmation Modal (Phase 2.6)
    if (this.pendingImportFiles && this.pendingImportFiles.length > 0) {
      const calVfov = getCalibratedVerticalFOV();
      html += `
        <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="import-modal-title">
          <div class="modal-card">
            <div class="modal-header">
              <span class="modal-title" id="import-modal-title">Import ${this.pendingImportFiles.length} Photos</span>
              <button class="btn btn-secondary btn-sm" id="cancel-import-btn">Cancel</button>
            </div>
            <div class="form-group">
              <label class="form-label" for="import-layout-select">Capture Ring Layout</label>
              <select id="import-layout-select" class="form-select">
                <option value="autoRing">Multi-ring spherical (Horizon + ±32° + ±62°)</option>
                <option value="singleRow">Single-row 360° horizon ring (0° pitch)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="import-vfov-select">Fallback Camera Vertical FOV (if EXIF absent)</label>
              <select id="import-vfov-select" class="form-select">
                <option value="${calVfov.toFixed(1)}">Calibrated / Default (${calVfov.toFixed(0)}°)</option>
                <option value="63">Standard 26mm Wide (63°)</option>
                <option value="72">24mm Wide (72°)</option>
                <option value="90">14mm Ultra-Wide (90°)</option>
              </select>
            </div>
            <button class="btn btn-primary btn-full" id="confirm-import-btn">Import Photographs</button>
          </div>
        </div>
      `;
    }

    // Delete Confirmation Modal
    if (this.deletingCapture) {
      html += `
        <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
          <div class="modal-card">
            <div class="modal-header">
              <span class="modal-title" id="delete-modal-title">Delete Capture?</span>
            </div>
            <p style="color:var(--text-secondary); margin-bottom:20px;">
              Delete "${this.escapeHtml(
                this.deletingCapture.name
              )}" and all its original frames? This cannot be undone.
            </p>
            <div style="display:flex; gap:12px;">
              <button class="btn btn-secondary" style="flex:1;" id="cancel-delete-btn">Cancel</button>
              <button class="btn btn-danger" style="flex:1;" id="confirm-delete-btn">Delete Capture</button>
            </div>
          </div>
        </div>
      `;
    }

    // Hotspot Editor Modal (Phase 3.5: preserves typed values on validation error)
    if (this.editingHotspot && this.selected) {
      const dot = this.editingHotspot;
      const near = this.selected.hotspots.some(
        (other) =>
          other.id !== dot.id &&
          new SphericalAngle(other.yaw, other.pitch).distance(
            new SphericalAngle(dot.yaw, dot.pitch)
          ) < 12
      );
      html += `
        <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="hotspot-modal-title">
          <div class="modal-card">
            <div class="modal-header">
              <span class="modal-title" id="hotspot-modal-title">Edit Hotspot</span>
              <button class="btn btn-secondary btn-sm" id="hotspot-cancel-btn">Cancel</button>
            </div>
            <div id="hotspot-inline-error" class="error-banner-inline" style="display:none;" role="alert"></div>
            <div class="form-group">
              <label class="form-label" for="hotspot-title-input">Title (required)</label>
              <input type="text" id="hotspot-title-input" class="form-input" value="${this.escapeHtml(
                dot.title
              )}" placeholder="e.g. Carved Stone Gateway" />
            </div>
            <div class="form-group">
              <label class="form-label" for="hotspot-caption-input">Caption (required, up to 300 characters)</label>
              <textarea id="hotspot-caption-input" class="form-textarea" rows="4" placeholder="Describe the heritage significance...">${this.escapeHtml(
                dot.caption
              )}</textarea>
              <div id="hotspot-char-count" style="font-size:0.78rem; margin-top:4px; color:var(--text-secondary);">
                ${dot.caption.length} / 300
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="hotspot-sources-input">Sources: one HTTP/HTTPS URL per line</label>
              <textarea id="hotspot-sources-input" class="form-textarea" rows="3" placeholder="https://example.org/archive">${this.escapeHtml(
                dot.sources.join('\n')
              )}</textarea>
            </div>
            <div style="font-family:var(--mono); font-size:0.82rem; color:var(--text-secondary); margin-bottom:12px;">
              Yaw ${dot.yaw.toFixed(1)}° · Pitch ${dot.pitch.toFixed(1)}°
            </div>
            ${
              near
                ? `<div class="warning-banner" style="margin:0 0 14px;">⚠️ Another hotspot is less than 12° away.</div>`
                : ''
            }
            <button class="btn btn-primary btn-full" id="hotspot-save-btn">Save Hotspot</button>
          </div>
        </div>
      `;
    }

    // Settings Modal (Phase 0.3: only allowed safe widths)
    if (this.showSettingsModal && this.selected) {
      const doc = this.selected;
      const safeWidths = allowedPanoramaWidths();
      html += `
        <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
          <div class="modal-card">
            <div class="modal-header">
              <span class="modal-title" id="settings-modal-title">Capture Settings</span>
              <button class="btn btn-primary btn-sm" id="settings-done-btn">Done</button>
            </div>
            <div class="form-group">
              <label class="form-label" for="settings-name-input">Capture Name</label>
              <input type="text" id="settings-name-input" class="form-input" value="${this.escapeHtml(
                doc.name
              )}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="settings-width-select">Panorama Width (Device Safe Limits)</label>
              <select id="settings-width-select" class="form-select">
                ${safeWidths
                  .map(
                    (w) =>
                      `<option value="${w}" ${
                        Math.min(doc.settings.width, safeWidths[safeWidths.length - 1]) === w
                          ? 'selected'
                          : ''
                      }>${w} px</option>`
                  )
                  .join('')}
              </select>
            </div>
            <div class="form-toggle">
              <label for="settings-include-frames">Include raw frames in export</label>
              <input type="checkbox" id="settings-include-frames" ${
                doc.settings.includeFrames ? 'checked' : ''
              } />
            </div>
            <div class="form-toggle">
              <label for="settings-nadir-cap">MIRAS nadir cap</label>
              <input type="checkbox" id="settings-nadir-cap" ${
                doc.settings.nadirCap ? 'checked' : ''
              } />
            </div>
            <div class="form-toggle">
              <label for="settings-fill-gaps">Fill unphotographed gaps with a blur (off = leave black)</label>
              <input type="checkbox" id="settings-fill-gaps" ${
                doc.settings.fillGaps ? 'checked' : ''
              } />
            </div>
            <div class="form-toggle">
              <label for="settings-enhance">Enhance colour and detail (CLAHE dehaze)</label>
              <input type="checkbox" id="settings-enhance" ${
                doc.settings.enhance ? 'checked' : ''
              } />
            </div>
            <div class="form-toggle">
              <label for="settings-refinement">Wide alignment search (slower)</label>
              <input type="checkbox" id="settings-refinement" ${
                doc.settings.refinement ? 'checked' : ''
              } />
            </div>
            <div class="form-toggle">
              <label for="settings-place-name">Look up city/country name for new captures</label>
              <input type="checkbox" id="settings-place-name" ${
                this.includePlaceName ? 'checked' : ''
              } />
            </div>
            <p style="font-size:0.78rem; color:var(--text-secondary); margin: 12px 0;">
              Size, cap, enhancement and alignment apply on the next stitch.
            </p>
            <div style="font-size:0.85rem; font-family:var(--mono); margin-bottom:12px;">
              Coverage ${(doc.coverage * 100).toFixed(1)}% · ${doc.yawReference}
            </div>
            ${
              doc.warnings.length > 0
                ? `<div style="margin-top:12px;">
                    <div class="form-label">Capture Notes</div>
                    <ul style="padding-left:18px; font-size:0.82rem; color:var(--text-secondary);">
                      ${doc.warnings.map((w) => `<li>${this.escapeHtml(w)}</li>`).join('')}
                    </ul>
                  </div>`
                : ''
            }
          </div>
        </div>
      `;
    }

    // Progress Modal
    if (this.progress !== null) {
      const pct = Math.round(Math.min(1, Math.max(0, this.progress)) * 100);
      html += `
        <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="progress-activity-el">
          <div class="modal-card progress-card">
            <div id="progress-activity-el" style="font-weight:600; font-size:1.02rem;" aria-live="polite">${this.escapeHtml(
              this.activity
            )}</div>
            <div class="progress-bar-track">
              <div class="progress-bar-fill" id="progress-bar-fill-el" style="width:${pct}%"></div>
            </div>
            <div id="progress-pct-text" style="font-family:var(--mono); font-size:0.85rem; color:var(--text-secondary); margin-bottom:16px;">
              ${pct}%
            </div>
            <button class="btn btn-secondary btn-sm" id="cancel-work-btn">Cancel</button>
          </div>
        </div>
      `;
    }

    // Explicit decision for a photo that failed the quality check 3 times, or could not be checked
    if (this.pendingQualityDecision) {
      html += `
        <div class="modal-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="quality-modal-title">
          <div class="modal-card">
            <div class="modal-header">
              <span class="modal-title" id="quality-modal-title">Photo quality problem</span>
            </div>
            <p style="color:var(--text-secondary); margin-bottom:20px; line-height:1.45;">${this.escapeHtml(
              this.pendingQualityDecision.reason
            )}. Retake it, or keep it with a quality warning recorded in the capture.</p>
            <div style="display:flex; gap:10px;">
              <button class="btn btn-primary" style="flex:1;" id="quality-retake-btn">Retake</button>
              <button class="btn btn-secondary" style="flex:1;" id="quality-keep-btn">Keep with warning</button>
            </div>
          </div>
        </div>
      `;
    }

    // Alert Modal (with optional Retry button for camera errors)
    if (this.alertMessage) {
      html += `
        <div class="modal-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="alert-modal-title">
          <div class="modal-card">
            <div class="modal-header">
              <span class="modal-title" id="alert-modal-title">Action Needed</span>
            </div>
            <p style="color:var(--text-secondary); margin-bottom:20px; line-height:1.45;">${this.escapeHtml(
              this.alertMessage
            )}</p>
            <div style="display:flex; gap:10px;">
              ${
                this.alertRetryCallback
                  ? `<button class="btn btn-secondary" style="flex:1;" id="alert-ok-btn">Close</button>
                     <button class="btn btn-primary" style="flex:1;" id="alert-retry-btn">Retry</button>`
                  : `<button class="btn btn-primary btn-full" id="alert-ok-btn">OK</button>`
              }
            </div>
          </div>
        </div>
      `;
    }

    this.overlayRoot.innerHTML = html;
    this.bindOverlayEvents();
  }

  private updateProgressDOM(): void {
    if (this.progress === null) return;
    const pct = Math.round(Math.min(1, Math.max(0, this.progress)) * 100);
    const act = document.getElementById('progress-activity-el');
    if (act && act.textContent !== this.activity) {
      act.textContent = this.activity;
    }
    const fill = document.getElementById('progress-bar-fill-el');
    if (fill) fill.style.width = `${pct}%`;
    const txt = document.getElementById('progress-pct-text');
    if (txt) txt.textContent = `${pct}%`;
  }

  private bindOverlayEvents(): void {
    document.getElementById('onboarding-next-btn')?.addEventListener('click', () => {
      if (this.onboardingStep < 2) {
        this.onboardingStep++;
      } else {
        this.showOnboarding = false;
        this.safeSetStorage('miras_onboarding_complete', 'true');
      }
      this.renderOverlays();
    });

    document.getElementById('close-debug-btn')?.addEventListener('click', () => {
      this.showDebugSheet = false;
      this.renderOverlays();
    });
    document.getElementById('run-synth-test-btn')?.addEventListener('click', () => {
      void this.loadSample(true);
    });
    document.getElementById('load-sample-capture-btn')?.addEventListener('click', () => {
      void this.loadSample(false);
    });

    document.getElementById('cancel-import-btn')?.addEventListener('click', () => {
      this.pendingImportFiles = null;
      this.renderOverlays();
    });
    document.getElementById('confirm-import-btn')?.addEventListener('click', () => {
      if (!this.pendingImportFiles) return;
      const layoutSel = document.getElementById('import-layout-select') as HTMLSelectElement | null;
      const vfovSel = document.getElementById('import-vfov-select') as HTMLSelectElement | null;
      const layout = layoutSel?.value === 'singleRow' ? 'singleRow' : 'autoRing';
      const vfov = parseFloat(vfovSel?.value ?? '63') || 63;
      void this.executePhotoImport(this.pendingImportFiles, layout, vfov);
    });

    document.getElementById('cancel-delete-btn')?.addEventListener('click', () => {
      this.deletingCapture = null;
      this.renderOverlays();
    });
    document.getElementById('confirm-delete-btn')?.addEventListener('click', async () => {
      if (this.deletingCapture) {
        const delId = this.deletingCapture.id;
        this.deletingCapture = null;
        this.revokeThumbnail(delId);
        await this.store.delete(delId);
        await this.refreshLibrary();
      }
    });

    document.getElementById('cancel-work-btn')?.addEventListener('click', () => {
      this.cancelled = true;
      this.stitcher.cancelActiveWorker();
      this.progress = null;
      this.renderOverlays();
    });

    document.getElementById('quality-retake-btn')?.addEventListener('click', () => void this.resolveQualityDecision(false));
    document.getElementById('quality-keep-btn')?.addEventListener('click', () => void this.resolveQualityDecision(true));

    document.getElementById('alert-ok-btn')?.addEventListener('click', () => {
      const hadRetry = Boolean(this.alertRetryCallback);
      this.alertMessage = null;
      this.alertRetryCallback = null;
      if (hadRetry && this.inCaptureMode) {
        this.stopCapture();
      } else {
        this.renderOverlays();
      }
    });

    document.getElementById('alert-retry-btn')?.addEventListener('click', () => {
      const retry = this.alertRetryCallback;
      if (retry) retry();
    });

    // Hotspot Modal Events (Phase 3.5: inline validation, no wiping inputs)
    if (this.editingHotspot && this.selected) {
      const titleIn = document.getElementById('hotspot-title-input') as HTMLInputElement | null;
      const capIn = document.getElementById('hotspot-caption-input') as HTMLTextAreaElement | null;
      const srcIn = document.getElementById('hotspot-sources-input') as HTMLTextAreaElement | null;
      const countEl = document.getElementById('hotspot-char-count');
      const errorEl = document.getElementById('hotspot-inline-error');

      capIn?.addEventListener('input', () => {
        if (countEl) {
          countEl.textContent = `${capIn.value.length} / 300`;
          countEl.style.color = capIn.value.length > 300 ? '#ef4444' : 'var(--text-secondary)';
        }
      });

      document.getElementById('hotspot-cancel-btn')?.addEventListener('click', () => {
        this.editingHotspot = null;
        this.renderOverlays();
      });

      document.getElementById('hotspot-save-btn')?.addEventListener('click', async () => {
        if (!this.editingHotspot || !this.selected) return;
        const rawTitle = titleIn?.value ?? '';
        const rawCaption = capIn?.value ?? '';
        const rawSources = srcIn?.value ?? '';

        const title = rawTitle.trim();
        const caption = rawCaption.trim();
        const sources = rawSources
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        const titleValid = title.length > 0;
        const captionValid = caption.length > 0 && caption.length <= 300;
        const sourcesValid = sources.every((s) => ExportService.isValidSourceURL(s));

        titleIn?.classList.toggle('input-invalid', !titleValid);
        capIn?.classList.toggle('input-invalid', !captionValid);
        srcIn?.classList.toggle('input-invalid', !sourcesValid);

        if (!titleValid || !captionValid || !sourcesValid) {
          // Keep user's typed values in this.editingHotspot and show inline error without rebuilding DOM
          this.editingHotspot.title = rawTitle;
          this.editingHotspot.caption = rawCaption;
          this.editingHotspot.sources = sources;
          if (errorEl) {
            const reasons: string[] = [];
            if (!titleValid) reasons.push('Enter a title.');
            if (!captionValid) reasons.push('Enter a caption up to 300 characters.');
            if (!sourcesValid) reasons.push('Each source URL must start with http:// or https://.');
            errorEl.textContent = reasons.join(' ');
            errorEl.style.display = 'block';
          }
          return;
        }

        const edited: Hotspot = {
          ...this.editingHotspot,
          title,
          caption,
          sources
        };
        this.selected.hotspots = this.selected.hotspots.filter((h) => h.id !== edited.id);
        this.selected.hotspots.push(edited);
        this.editingHotspot = null;
        await this.store.save(this.selected);

        if (this.viewer) {
          this.viewer.updateHotspots(this.selected.hotspots);
          this.syncHotspotDOMElements();
        }
        this.updateDetailHeaderAndListDOM(this.selected);
        this.renderOverlays();
      });
    }

    // Settings Modal Events
    if (this.showSettingsModal && this.selected) {
      document.getElementById('settings-done-btn')?.addEventListener('click', async () => {
        if (!this.selected) return;
        const nameIn = document.getElementById('settings-name-input') as HTMLInputElement | null;
        const widthSel = document.getElementById('settings-width-select') as HTMLSelectElement | null;
        const incFrames = document.getElementById('settings-include-frames') as HTMLInputElement | null;
        const nadirCap = document.getElementById('settings-nadir-cap') as HTMLInputElement | null;
        const enhance = document.getElementById('settings-enhance') as HTMLInputElement | null;
        const refinement = document.getElementById('settings-refinement') as HTMLInputElement | null;
        const placeNameToggle = document.getElementById('settings-place-name') as HTMLInputElement | null;

        if (nameIn && nameIn.value.trim()) {
          this.selected.name = nameIn.value.trim();
        }
        if (widthSel) {
          this.selected.settings.width = parseInt(widthSel.value, 10);
        }
        if (incFrames) this.selected.settings.includeFrames = incFrames.checked;
        if (nadirCap) this.selected.settings.nadirCap = nadirCap.checked;
        if (enhance) this.selected.settings.enhance = enhance.checked;
        const fillGaps = document.getElementById('settings-fill-gaps') as HTMLInputElement | null;
        if (fillGaps) this.selected.settings.fillGaps = fillGaps.checked;
        if (refinement) this.selected.settings.refinement = refinement.checked;
        if (placeNameToggle) {
          this.includePlaceName = placeNameToggle.checked;
          this.safeSetStorage('miras_include_place_name', String(this.includePlaceName));
        }

        this.showSettingsModal = false;
        await this.store.save(this.selected);
        this.updateDetailHeaderAndListDOM(this.selected);
        this.renderOverlays();
      });
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
