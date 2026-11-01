'use client';
/**
 * ImmersiveEngine - renders one story in 360, VR or AR with three.js.
 *
 * projection:
 *  - 'equirect' : full 360x180 photo/video on the inside of a sphere
 *  - 'pano'     : a wide panorama wrapped on the inside of a cylinder (panoDeg around)
 *  - 'flat'     : a normal photo/video on a floating screen (VR) or card (AR)
 * mode:
 *  - '360' : magic window - drag or move the phone to look around
 *  - 'vr'  : side-by-side stereo for phone VR viewers (gyro), or a real headset via WebXR
 *  - 'ar'  : transparent canvas over the camera feed: 360 content appears through a floating
 *            portal anchored in the room, flat content as a floating card. Tap the portal to step inside.
 */
import * as THREE from 'three';

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const SCREEN_TO_WORLD = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

export function deviceOrientationSupported() {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
}

/** iOS needs an explicit permission from a tap. Returns true when motion data may flow. */
export async function requestMotionPermission() {
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      return (await DeviceOrientationEvent.requestPermission()) === 'granted';
    }
  } catch { return false; }
  return deviceOrientationSupported();
}

function starfield(n = 900, r = 60) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos.set([r * s * Math.cos(t), r * u, r * s * Math.sin(t)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.7 }));
}

export class ImmersiveEngine {
  constructor(container, { onPortalTap } = {}) {
    this.container = container;
    this.onPortalTap = onPortalTap;
    this.mode = '360';
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, stencil: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.xr.enabled = true;
    this.renderer.domElement.className = 'immersive-canvas';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 200);
    this.stereo = new THREE.StereoCamera();
    this.content = new THREE.Group();
    this.scene.add(this.content);
    this.raycaster = new THREE.Raycaster();

    // look state: yaw/pitch from dragging, or the phone's orientation
    this.yaw = 0; this.pitch = 0; this.fov = 75;
    this.gyro = null; this.useGyro = false; this.gyroYawOffset = null;
    this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._q0 = new THREE.Quaternion(); this._qy = new THREE.Quaternion();
    this.smoothed = new THREE.Quaternion(); this._hasSmooth = false;
    this._onOrient = (e) => { if (e.alpha !== null || e.beta !== null) this.gyro = { a: e.alpha || 0, b: e.beta || 0, g: e.gamma || 0 }; };

    this.bindPointer();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ------------------------------------------------------------------ input
  bindPointer() {
    const el = this.renderer.domElement;
    const pts = new Map();
    let last = null, moved = 0, pinch0 = 0, fov0 = 75;
    el.addEventListener('pointerdown', (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      last = { x: e.clientX, y: e.clientY }; moved = 0;
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); fov0 = this.fov; }
    });
    el.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        this.fov = THREE.MathUtils.clamp(fov0 * pinch0 / Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), 35, 100);
        return;
      }
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      moved += Math.abs(dx) + Math.abs(dy);
      last = { x: e.clientX, y: e.clientY };
      if (this.useGyro && this.mode !== '360') return;
      const k = (this.fov / 75) * 0.0045;
      this.yaw += dx * k; this.pitch = THREE.MathUtils.clamp(this.pitch + dy * k, -1.45, 1.45);
      this.dragged = true;
    });
    const up = (e) => {
      const wasTap = pts.size === 1 && moved < 8;
      pts.delete(e.pointerId);
      if (wasTap && e.type === 'pointerup') this.handleTap(e);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.fov = THREE.MathUtils.clamp(this.fov + e.deltaY * 0.04, 35, 100); }, { passive: false });
  }

  handleTap(e) {
    if (this.mode !== 'ar' || !this.portal) return;
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    if (this.raycaster.intersectObject(this.portalHit, false).length) this.onPortalTap?.();
  }

  setGyro(on) {
    this.useGyro = on;
    if (on) window.addEventListener('deviceorientation', this._onOrient);
    else window.removeEventListener('deviceorientation', this._onOrient);
    this.gyroYawOffset = null; this._hasSmooth = false;
  }

  // ------------------------------------------------------------------ content
  /** media: { el (HTMLImageElement|HTMLVideoElement), mediaType, projection, panoDeg, aspect } */
  setMedia(media) {
    this.media = media;
    if (this.texture) this.texture.dispose();
    this.texture = media.mediaType === 'video' ? new THREE.VideoTexture(media.el) : new THREE.Texture(media.el);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.needsUpdate = true;
    this.build();
  }

  setMode(mode) {
    if (mode === this.mode && this.content.children.length) return;
    this.mode = mode;
    this.renderer.setScissorTest(false);
    this.resize();
    this.build();
  }

  clearContent() {
    this.content.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map !== this.texture) o.material.dispose?.(); });
    this.content.clear();
    this.portal = null; this.portalHit = null;
  }

  /** The 360 world: a sphere (equirect) or a cylinder (pano), viewed from inside. */
  worldMesh(stencil) {
    const m = this.media;
    const mat = new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false });
    if (stencil) Object.assign(mat, { stencilWrite: true, stencilRef: 1, stencilFunc: THREE.EqualStencilFunc });
    let geo;
    if (m.projection === 'pano') {
      const len = THREE.MathUtils.degToRad(m.panoDeg || 360), r = 10;
      const h = Math.min(r * len / Math.max(1, m.aspect || 4), 14);
      geo = new THREE.CylinderGeometry(r, r, h, 128, 1, true, Math.PI - len / 2, len);
    } else {
      geo = new THREE.SphereGeometry(50, 64, 40);
    }
    geo.scale(-1, 1, 1); // view from the inside, image not mirrored
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 1;
    return mesh;
  }

  build() {
    if (!this.media) return;
    this.clearContent();
    const m = this.media, mode = this.mode;
    const immersiveSrc = m.projection !== 'flat';
    this.scene.background = null;
    // AR: anchor the portal / card where the visitor is looking right now; stepping inside keeps the same anchor
    if (mode === 'ar') this.anchorYaw = -this.yaw;
    this.content.rotation.y = this.anchorYaw || 0;

    if (mode === 'ar') {
      if (immersiveSrc) {
        // portal: a circle that only writes stencil; the 360 world renders where the stencil is set
        const R = this.camera.aspect < 1 ? 0.55 : 0.85, D = 2.2; // a smaller portal on a portrait phone
        const mask = new THREE.Mesh(new THREE.CircleGeometry(R, 72), new THREE.MeshBasicMaterial({
          colorWrite: false, depthWrite: false, stencilWrite: true, stencilRef: 1,
          stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
        }));
        mask.position.set(0, 0, -D); mask.renderOrder = 0;
        const ring = new THREE.Mesh(new THREE.RingGeometry(R, R + 0.05, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
        ring.position.copy(mask.position); ring.renderOrder = 2;
        const glow = new THREE.Mesh(new THREE.RingGeometry(R + 0.05, R + 0.22, 96), new THREE.MeshBasicMaterial({ color: 0xffb36b, transparent: true, opacity: 0.25 }));
        glow.position.copy(mask.position); glow.renderOrder = 2;
        this.content.add(mask, this.worldMesh(true), ring, glow);
        this.portal = ring; this.portalHit = mask;
      } else {
        // floating card in the room
        const w = this.camera.aspect < 1 ? 0.9 : 1.3, h = w / Math.max(0.3, m.aspect || 1.5);
        const card = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false }));
        const frame = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.06, h + 0.06), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        const shadow = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.3, h + 0.3), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
        card.position.set(0, 0, -2); frame.position.set(0, 0, -2.005); shadow.position.set(0.04, -0.06, -2.02);
        this.content.add(shadow, frame, card);
      }
      return;
    }

    if (immersiveSrc) {
      this.content.add(this.worldMesh(false));
      if (m.projection === 'pano') { this.scene.background = new THREE.Color(0x05060c); this.content.add(starfield()); }
    } else {
      // flat media in VR: a big floating screen in a dark, starry space
      this.scene.background = new THREE.Color(0x05060c);
      // fit the screen inside one eye's view (VR) or the window (360), with a margin
      const e = this.eyes || { eyeW: 1, h: 1 };
      const asp = mode === 'vr' ? e.eyeW / e.h : this.camera.aspect;
      const vf = THREE.MathUtils.degToRad(mode === 'vr' ? 85 : 75) / 2;
      const maxW = 2 * 3 * Math.tan(vf) * asp * 0.8, maxH = 2 * 3 * Math.tan(vf) * 0.8;
      const a = Math.max(0.3, m.aspect || 1.5);
      const w = Math.min(maxW, maxH * a), h = w / a;
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false }));
      screen.position.set(0, 0, -3);
      this.content.add(starfield(), screen);
    }
  }

  // ------------------------------------------------------------------ layout & loop
  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // VR: centre each eye's image on its viewer lens (~63 mm apart, ~6 CSS px per mm)
    const sep = Math.min(w / 2, 63 * 6);
    const eyeW = Math.min(sep - 4, w - sep);
    this.eyes = { w, h, eyeW, left: w / 2 - sep / 2 - eyeW / 2, right: w / 2 + sep / 2 - eyeW / 2 };
  }

  updateCamera() {
    const cam = this.camera;
    if (this.useGyro && this.gyro && !this.renderer.xr.isPresenting) {
      const d2r = THREE.MathUtils.degToRad;
      const angle = d2r(screen.orientation?.angle ?? window.orientation ?? 0);
      this._e.set(d2r(this.gyro.b), d2r(this.gyro.a), -d2r(this.gyro.g), 'YXZ');
      this._q.setFromEuler(this._e).multiply(SCREEN_TO_WORLD).multiply(this._q0.setFromAxisAngle(Z_AXIS, -angle));
      if (this.gyroYawOffset === null) {
        // start facing the content
        const f = new THREE.Vector3(0, 0, -1).applyQuaternion(this._q);
        this.gyroYawOffset = this.yaw - Math.atan2(-f.x, -f.z);
      }
      this._qy.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, this.gyroYawOffset + (this.mode === '360' ? 0 : 0));
      this._q.premultiply(this._qy);
      if (!this._hasSmooth) { this.smoothed.copy(this._q); this._hasSmooth = true; } else this.smoothed.slerp(this._q, 0.5);
      cam.quaternion.copy(this.smoothed);
    } else if (!this.renderer.xr.isPresenting) {
      cam.quaternion.setFromEuler(this._e.set(-this.pitch, -this.yaw, 0, 'YXZ'));
    }
    const fov = this.mode === '360' ? this.fov : (this.mode === 'vr' ? 85 : 70);
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
  }

  frame() {
    if (!this.media) return;
    if (!this.useGyro && !this.dragged && this.mode === '360' && !this.renderer.xr.isPresenting) this.yaw += 0.0006; // gentle drift invites looking around
    this.updateCamera();
    if (this.portal) this.portal.parent && (this.portal.material.opacity = 0.7 + 0.2 * Math.sin(performance.now() / 400));
    const r = this.renderer;
    if (this.mode === 'vr' && !r.xr.isPresenting) {
      const { w, h, eyeW, left, right } = this.eyes;
      this.scene.updateMatrixWorld();
      this.camera.updateMatrixWorld();
      this.stereo.eyeSep = this.media.projection === 'flat' ? 0.04 : 0; // a 360 photo has no depth: identical eyes are comfortable
      this.stereo.aspect = eyeW / h / this.camera.aspect;
      this.stereo.update(this.camera);
      r.setScissorTest(true);
      r.setScissor(0, 0, w, h); r.setViewport(0, 0, w, h); r.setClearColor(0x000000, 1); r.clear();
      r.setScissor(left, 0, eyeW, h); r.setViewport(left, 0, eyeW, h); r.render(this.scene, this.stereo.cameraL);
      r.setScissor(right, 0, eyeW, h); r.setViewport(right, 0, eyeW, h); r.render(this.scene, this.stereo.cameraR);
      r.setScissorTest(false);
    } else {
      r.setClearColor(0x000000, this.mode === 'ar' ? 0 : 1);
      r.render(this.scene, this.camera);
    }
  }

  // ------------------------------------------------------------------ WebXR (headsets / ARCore phones)
  static async xrSupport() {
    const xr = typeof navigator !== 'undefined' && navigator.xr;
    if (!xr) return { vr: false, ar: false };
    const [vr, ar] = await Promise.all([xr.isSessionSupported('immersive-vr').catch(() => false), xr.isSessionSupported('immersive-ar').catch(() => false)]);
    return { vr, ar };
  }

  async enterXR(kind, overlayRoot, onEnd) {
    const mode = kind === 'ar' ? 'immersive-ar' : 'immersive-vr';
    const session = await navigator.xr.requestSession(mode, {
      optionalFeatures: ['local-floor', 'dom-overlay'],
      ...(overlayRoot ? { domOverlay: { root: overlayRoot } } : {}),
    });
    this.renderer.xr.setReferenceSpaceType('local');
    await this.renderer.xr.setSession(session);
    this.mode = kind === 'ar' ? 'ar' : '360';
    this.build();
    session.addEventListener('end', () => { this.build(); onEnd?.(); });
    return session;
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.setGyro(false);
    this._ro.disconnect();
    this.clearContent();
    this.texture?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
