import { Geometry, SphericalAngle } from '../geometry/SphericalGeometry';
import type { Hotspot } from '../models/CaptureModels';
import { CaptureService } from './CaptureService';
import { PoseFilter } from './PosePipeline';

export class PanoramaViewer {
  public look = new SphericalAngle(0, 0);
  public fieldOfView = 70.0;
  public gyro = false;
  public addHotspotMode = false;

  public onCreateHotspot: ((angle: SphericalAngle) => void) | null = null;
  public onSelectHotspot: ((hotspot: Hotspot) => void) | null = null;
  public onMoveHotspot: ((id: string, angle: SphericalAngle) => void) | null = null;
  public onLookChange: ((look: SphericalAngle, fov: number) => void) | null = null;
  public onError: ((msg: string) => void) | null = null;

  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private isWebGL2 = false;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private vbo: WebGLBuffer | null = null;
  private maxTextureSize = 4096;

  private uSamplerLoc: WebGLUniformLocation | null = null;
  private uYawLoc: WebGLUniformLocation | null = null;
  private uPitchLoc: WebGLUniformLocation | null = null;
  private uTanHalfFOVLoc: WebGLUniformLocation | null = null;
  private uAspectLoc: WebGLUniformLocation | null = null;

  private hotspots: Hotspot[] = [];
  private cachedWidth = 360;
  private cachedHeight = 300;
  private resizeObserver: ResizeObserver | null = null;
  private dirty = true;
  private rafId: number | null = null;
  private destroyed = false;

  // Gesture State Machine (Phase 3.2)
  private activePointers = new Map<number, { x: number; y: number }>();
  private maxPointersInGesture = 0;
  private gestureStartTime = 0;
  private gestureStartPos = { x: 0, y: 0 };
  private maxMoveDistance = 0;
  private prevPointer = { x: 0, y: 0 };
  private draggingHotspotId: string | null = null;
  private tappedHotspot: Hotspot | null = null;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private pinchStartDist = 0;
  private pinchStartFOV = 70;

  // Gyro state (Phase 3.4)
  private poseFilter = new PoseFilter(0.35);
  private motionOrigin: { yaw: number; pitch: number } | null = null;
  private lookOrigin = new SphericalAngle(0, 0);
  private orientationListener: ((e: DeviceOrientationEvent) => void) | null = null;
  private lastSourceImage: HTMLImageElement | HTMLCanvasElement | ImageBitmap | null = null;

  // Bound event references for clean teardown
  private onContextLostBound: (e: Event) => void;
  private onContextRestoredBound: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.cachedWidth = canvas.clientWidth || 360;
    this.cachedHeight = canvas.clientHeight || 300;

    this.onContextLostBound = (e: Event) => {
      e.preventDefault();
    };
    this.onContextRestoredBound = () => {
      this.initWebGL();
      if (this.lastSourceImage) {
        this.loadImage(this.lastSourceImage);
      }
    };

    this.canvas.addEventListener('webglcontextlost', this.onContextLostBound);
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestoredBound);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          this.cachedWidth = Math.max(1, entry.contentRect.width);
          this.cachedHeight = Math.max(1, entry.contentRect.height);
          this.markDirty();
        }
      });
      this.resizeObserver.observe(this.canvas);
    }

    this.initWebGL();
    this.bindEvents();
    this.startRenderLoop();
  }

  private initWebGL(): void {
    const opts: WebGLContextAttributes = {
      antialias: false,
      preserveDrawingBuffer: false,
      depth: false,
      stencil: false
    };

    let gl: WebGLRenderingContext | WebGL2RenderingContext | null =
      this.canvas.getContext('webgl2', opts) as WebGL2RenderingContext | null;
    if (gl) {
      this.isWebGL2 = true;
    } else {
      gl =
        (this.canvas.getContext('webgl', opts) as WebGLRenderingContext | null) ||
        (this.canvas.getContext('experimental-webgl', opts) as WebGLRenderingContext | null);
      this.isWebGL2 = false;
    }

    if (!gl) return;
    this.gl = gl;
    this.maxTextureSize = (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) || 4096;

    const vsSource = `
      attribute vec2 aPosition;
      varying vec2 vScreen;
      void main() {
        vScreen = aPosition;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision highp float;
      varying vec2 vScreen;
      uniform sampler2D uSampler;
      uniform float uYaw;
      uniform float uPitch;
      uniform float uTanHalfFOV;
      uniform float uAspect;

      const float PI = 3.141592653589793;

      void main() {
        float rx = vScreen.x * uAspect * uTanHalfFOV;
        float ry = vScreen.y * uTanHalfFOV;

        float cy = cos(uYaw), sy = sin(uYaw);
        float cp = cos(uPitch), sp = sin(uPitch);

        vec3 forward = vec3(sy * cp, sp, -cy * cp);
        vec3 right = vec3(cy, 0.0, sy);
        vec3 up = vec3(-sy * sp, cp, cy * sp);

        vec3 d = normalize(forward + rx * right + ry * up);
        float yaw = atan(d.x, -d.z);
        float pitch = asin(clamp(d.y, -1.0, 1.0));

        float u = fract(0.5 + yaw / (2.0 * PI));
        float v = clamp(0.5 - pitch / PI, 0.0, 1.0);

        gl_FragColor = texture2D(uSampler, vec2(u, v));
      }
    `;

    const compile = (type: number, src: string) => {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      return s;
    };

    const vs = compile(gl.VERTEX_SHADER, vsSource);
    const fs = compile(gl.FRAGMENT_SHADER, fsSource);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    this.program = prog;

    // Cache uniform locations once (Phase 3.3)
    this.uSamplerLoc = gl.getUniformLocation(prog, 'uSampler');
    this.uYawLoc = gl.getUniformLocation(prog, 'uYaw');
    this.uPitchLoc = gl.getUniformLocation(prog, 'uPitch');
    this.uTanHalfFOVLoc = gl.getUniformLocation(prog, 'uTanHalfFOV');
    this.uAspectLoc = gl.getUniformLocation(prog, 'uAspect');

    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const buf = gl.createBuffer();
    this.vbo = buf;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(prog, 'aPosition');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
  }

  private static isPowerOfTwo(v: number): boolean {
    return (v & (v - 1)) === 0 && v > 0;
  }

  loadImage(img: HTMLImageElement | HTMLCanvasElement | ImageBitmap): void {
    this.lastSourceImage = img;
    const gl = this.gl;
    if (!gl) return;
    if (this.texture) {
      gl.deleteTexture(this.texture);
      this.texture = null;
    }

    let uploadSource: HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas = img;
    const srcW = 'naturalWidth' in img ? img.naturalWidth || img.width : img.width;
    const srcH = 'naturalHeight' in img ? img.naturalHeight || img.height : img.height;

    // Downscale texture if it exceeds GPU MAX_TEXTURE_SIZE
    if (srcW > this.maxTextureSize || srcH > this.maxTextureSize) {
      const scale = this.maxTextureSize / Math.max(srcW, srcH);
      const dw = Math.max(1, Math.floor(srcW * scale));
      const dh = Math.max(1, Math.floor(srcH * scale));
      const c = document.createElement('canvas');
      c.width = dw;
      c.height = dh;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(img as CanvasImageSource, 0, 0, dw, dh);
        uploadSource = c;
      }
    }

    const finalW = uploadSource.width;
    const finalH = uploadSource.height;
    const isPOT = PanoramaViewer.isPowerOfTwo(finalW) && PanoramaViewer.isPowerOfTwo(finalH);
    const canMipmap = this.isWebGL2 || isPOT;

    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      uploadSource as TexImageSource
    );

    if (canMipmap) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      const ext =
        gl.getExtension('EXT_texture_filter_anisotropic') ||
        gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
      if (ext) {
        const maxAniso = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(16, maxAniso));
      }
    } else {
      // WebGL1 NPOT fallback: CLAMP_TO_EDGE + LINEAR (shader already applies fract(u))
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }

    this.texture = tex;
    this.markDirty();
  }

  updateHotspots(spots: Hotspot[]): void {
    this.hotspots = spots;
    this.markDirty();
  }

  markDirty(): void {
    this.dirty = true;
  }

  private startRenderLoop(): void {
    const step = () => {
      if (this.destroyed) return;
      if (this.dirty) {
        this.dirty = false;
        this.renderNow();
      }
      this.rafId = requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }

  projectHotspotToScreen(
    angle: SphericalAngle,
    width = this.cachedWidth,
    height = this.cachedHeight
  ): { x: number; y: number; visible: boolean } {
    const d = angle.vector;
    const p = (this.look.pitch * Math.PI) / 180;
    const a = (this.look.yaw * Math.PI) / 180;
    const forward = this.look.vector;
    const right = { x: Math.cos(a), y: 0, z: Math.sin(a) };
    const up = {
      x: -Math.sin(a) * Math.sin(p),
      y: Math.cos(p),
      z: Math.cos(a) * Math.sin(p)
    };

    const fDot = d.x * forward.x + d.y * forward.y + d.z * forward.z;
    if (fDot <= 0.05) {
      return { x: -100, y: -100, visible: false };
    }

    const rDot = (d.x * right.x + d.y * right.y + d.z * right.z) / fDot;
    const uDot = (d.x * up.x + d.y * up.y + d.z * up.z) / fDot;
    const scale = Math.tan((this.fieldOfView * Math.PI) / 360);
    const aspect = width / Math.max(1, height);

    const ndcX = rDot / (aspect * scale);
    const ndcY = uDot / scale;
    const x = (ndcX + 1) * 0.5 * width;
    const y = (1 - ndcY) * 0.5 * height;
    const visible = x >= -32 && x <= width + 32 && y >= -32 && y <= height + 32;
    return { x, y, visible };
  }

  getProjectedHotspots(
    width = this.cachedWidth,
    height = this.cachedHeight
  ): Array<{ hotspot: Hotspot; x: number; y: number; visible: boolean }> {
    return this.hotspots.map((hotspot) => {
      const pos = this.projectHotspotToScreen(
        new SphericalAngle(hotspot.yaw, hotspot.pitch),
        width,
        height
      );
      return { hotspot, ...pos };
    });
  }

  render(): void {
    this.markDirty();
  }

  private renderNow(): void {
    this.look.pitch = Math.min(85, Math.max(-85, this.look.pitch));
    this.look.yaw = Geometry.wrap(this.look.yaw);

    const gl = this.gl;
    if (gl && this.program && this.texture) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.max(1, Math.floor(this.cachedWidth * dpr));
      const ch = Math.max(1, Math.floor(this.cachedHeight * dpr));
      if (this.canvas.width !== cw || this.canvas.height !== ch) {
        this.canvas.width = cw;
        this.canvas.height = ch;
      }
      gl.viewport(0, 0, cw, ch);
      gl.useProgram(this.program);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.uniform1i(this.uSamplerLoc, 0);
      gl.uniform1f(this.uYawLoc, (this.look.yaw * Math.PI) / 180);
      gl.uniform1f(this.uPitchLoc, (this.look.pitch * Math.PI) / 180);
      gl.uniform1f(this.uTanHalfFOVLoc, Math.tan((this.fieldOfView * Math.PI) / 360));
      gl.uniform1f(this.uAspectLoc, cw / Math.max(1, ch));

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    this.onLookChange?.(this.look, this.fieldOfView);
  }

  ray(x: number, y: number): SphericalAngle {
    return Geometry.tapRay(
      x,
      y,
      Math.max(1, this.cachedWidth),
      Math.max(1, this.cachedHeight),
      this.fieldOfView,
      this.look
    );
  }

  centerRay(): SphericalAngle {
    return new SphericalAngle(this.look.yaw, this.look.pitch);
  }

  private clearLongPress(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  private bindEvents(): void {
    this.canvas.style.touchAction = 'none';

    this.canvas.addEventListener('pointerdown', (e) => {
      this.canvas.setPointerCapture(e.pointerId);
      const rect = this.canvas.getBoundingClientRect();
      this.cachedWidth = Math.max(1, rect.width);
      this.cachedHeight = Math.max(1, rect.height);
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      this.activePointers.set(e.pointerId, { x, y });
      this.maxPointersInGesture = Math.max(this.maxPointersInGesture, this.activePointers.size);

      if (this.activePointers.size >= 2) {
        this.clearLongPress();
        this.draggingHotspotId = null;
        this.tappedHotspot = null;
        const pts = Array.from(this.activePointers.values());
        this.pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        this.pinchStartFOV = this.fieldOfView;
        return;
      }

      // Single finger start
      this.gestureStartTime = performance.now();
      this.gestureStartPos = { x, y };
      this.prevPointer = { x, y };
      this.maxMoveDistance = 0;

      // Hit-test existing hotspots (>= 44 px hit target -> radius 24 px)
      const projected = this.getProjectedHotspots(this.cachedWidth, this.cachedHeight);
      const hit = projected.find(
        (p) => p.visible && Math.hypot(p.x - x, p.y - y) <= 24
      );
      this.draggingHotspotId = hit ? hit.hotspot.id : null;
      this.tappedHotspot = hit ? hit.hotspot : null;

      // Long-press (500ms) on empty panorama creates a hotspot at that ray
      this.clearLongPress();
      if (!hit) {
        this.longPressTimer = setTimeout(() => {
          if (
            this.activePointers.size === 1 &&
            this.maxPointersInGesture === 1 &&
            this.maxMoveDistance < 8
          ) {
            const angle = this.ray(x, y);
            this.activePointers.clear();
            this.onCreateHotspot?.(angle);
          }
        }, 520);
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.activePointers.has(e.pointerId)) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.activePointers.set(e.pointerId, { x, y });

      if (this.activePointers.size === 2) {
        this.clearLongPress();
        const pts = Array.from(this.activePointers.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (this.pinchStartDist > 10) {
          const scale = dist / this.pinchStartDist;
          this.fieldOfView = Math.min(100, Math.max(40, this.pinchStartFOV / scale));
          this.markDirty();
        }
        return;
      }

      if (this.activePointers.size === 1) {
        const distFromStart = Math.hypot(
          x - this.gestureStartPos.x,
          y - this.gestureStartPos.y
        );
        this.maxMoveDistance = Math.max(this.maxMoveDistance, distFromStart);
        if (this.maxMoveDistance >= 8) {
          this.clearLongPress();
        }

        const dx = x - this.prevPointer.x;
        const dy = y - this.prevPointer.y;
        this.prevPointer = { x, y };

        if (this.draggingHotspotId && this.maxMoveDistance >= 6 && this.maxPointersInGesture === 1) {
          this.onMoveHotspot?.(this.draggingHotspotId, this.ray(x, y));
          this.markDirty();
        } else if (!this.draggingHotspotId && this.maxMoveDistance >= 3) {
          const h = Math.max(1, this.cachedHeight);
          const dYaw = -(dx * this.fieldOfView) / h;
          const dPitch = (dy * this.fieldOfView) / h;
          if (this.gyro) {
            // Drag nudges the gyro view instead of silently switching gyro off
            // (which left the Gyro toggle showing "on" while it no longer worked).
            this.lookOrigin = new SphericalAngle(
              Geometry.wrap(this.lookOrigin.yaw + dYaw),
              Math.min(85, Math.max(-85, this.lookOrigin.pitch + dPitch))
            );
          }
          this.look.yaw += dYaw;
          this.look.pitch += dPitch;
          this.markDirty();
        }
      }
    });

    const endOrCancelPointer = (e: PointerEvent, isCancel: boolean) => {
      this.clearLongPress();
      const wasMultiTouch = this.maxPointersInGesture > 1;
      this.activePointers.delete(e.pointerId);

      // When 2 fingers become 1 finger, reset prevPointer to the remaining finger to prevent jump!
      if (this.activePointers.size === 1) {
        const remaining = Array.from(this.activePointers.values())[0];
        this.prevPointer = { x: remaining.x, y: remaining.y };
        return;
      }

      if (this.activePointers.size === 0) {
        const elapsed = performance.now() - this.gestureStartTime;
        const isCleanTap =
          !isCancel && !wasMultiTouch && this.maxMoveDistance < 8 && elapsed < 300;

        if (isCleanTap) {
          if (this.tappedHotspot) {
            this.onSelectHotspot?.(this.tappedHotspot);
          } else if (this.addHotspotMode) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.onCreateHotspot?.(this.ray(x, y));
          }
        }

        this.maxPointersInGesture = 0;
        this.draggingHotspotId = null;
        this.tappedHotspot = null;
      }
    };

    this.canvas.addEventListener('pointerup', (e) => endOrCancelPointer(e, false));
    this.canvas.addEventListener('pointercancel', (e) => endOrCancelPointer(e, true));

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.fieldOfView = Math.min(100, Math.max(40, this.fieldOfView + e.deltaY * 0.05));
        this.markDirty();
      },
      { passive: false }
    );
  }

  recenterGyro(): void {
    this.motionOrigin = null;
    this.lookOrigin = new SphericalAngle(this.look.yaw, this.look.pitch);
    this.markDirty();
  }

  /**
   * @param permissionGranted pass true when the caller already obtained motion permission
   * from the user's tap. On iOS a second requestPermission() after an await is outside the
   * tap and can be rejected, which made Gyro fail to turn on.
   */
  async setGyro(enabled: boolean, permissionGranted = false): Promise<void> {
    this.stopMotion(); // never stack duplicate listeners
    this.gyro = enabled;
    if (!enabled) return;

    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      this.gyro = false;
      this.onError?.('Gyroscope viewing is unavailable here. Drag the panorama to look around.');
      return;
    }

    const DevOrient = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (!permissionGranted && DevOrient && typeof DevOrient.requestPermission === 'function') {
      try {
        const perm = await DevOrient.requestPermission();
        if (perm !== 'granted') {
          this.gyro = false;
          this.onError?.('Motion permission was denied. Drag the panorama to look around.');
          return;
        }
      } catch {
        this.gyro = false;
        this.onError?.('Gyroscope permission failed. Drag the panorama to look around.');
        return;
      }
    }

    this.poseFilter.reset();
    this.motionOrigin = null;
    this.lookOrigin = new SphericalAngle(this.look.yaw, this.look.pitch);

    this.orientationListener = (e: DeviceOrientationEvent) => {
      if (e.alpha === null || e.beta === null || e.gamma === null) return;
      const screenAngle = CaptureService.getScreenOrientationAngle();
      const sample = this.poseFilter.updateFromEuler(
        e.alpha,
        e.beta,
        e.gamma,
        performance.now() / 1000,
        screenAngle
      );
      if (!this.motionOrigin) {
        this.motionOrigin = { yaw: sample.yaw, pitch: sample.pitch };
      }
      const dyaw =
        ((sample.yaw - this.motionOrigin.yaw + 540) % 360) - 180;
      const dpitch = sample.pitch - this.motionOrigin.pitch;
      this.look.yaw = Geometry.wrap(this.lookOrigin.yaw + dyaw);
      this.look.pitch = Math.min(85, Math.max(-85, this.lookOrigin.pitch + dpitch));
      this.markDirty();
    };
    window.addEventListener('deviceorientation', this.orientationListener, { passive: true });
  }

  stopMotion(): void {
    if (typeof window !== 'undefined' && this.orientationListener) {
      window.removeEventListener('deviceorientation', this.orientationListener);
      this.orientationListener = null;
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.clearLongPress();
    this.stopMotion();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.canvas.removeEventListener('webglcontextlost', this.onContextLostBound);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestoredBound);
    if (this.gl) {
      if (this.texture) {
        this.gl.deleteTexture(this.texture);
        this.texture = null;
      }
      if (this.vbo) {
        this.gl.deleteBuffer(this.vbo);
        this.vbo = null;
      }
      if (this.program) {
        this.gl.deleteProgram(this.program);
        this.program = null;
      }
    }
  }
}
