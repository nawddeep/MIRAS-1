// Living-sketch hero: draws the inpainted plate plus the cut-out layers in WebGL2.
// All coordinates are pixels in the 3840×2160 source illustration.
// Plate shader: foliage sway (motion map R/G) + lake ripple (motion map B).
// Layer shader: per-layer offset, bob, rotation, leg shear and palm bend.
// Birds are drawn on a 2D canvas on top, in the same ink.

const IMG_W = 3840;
const IMG_H = 2160;
const FRAME = { x0: 19, y0: 23, x1: 3821, y1: 2139 }; // inside the drawn border
const INK = '#1d3a73';

const VS = `#version 300 es
precision highp float;
in vec2 aPos;
uniform vec4 uRect;      // x, y, w, h (image px)
uniform vec2 uOffset;    // animated offset (image px)
uniform vec2 uView;      // canvas size (device px)
uniform vec3 uMap;       // scale, offsetX, offsetY: image px -> device px
uniform float uBend;     // px of sway at the top (palm), base fixed
uniform float uShear;    // px of swing at the bottom (legs), top fixed
uniform float uRot;      // radians, around bottom centre
out vec2 vUv;
void main() {
  vUv = aPos;
  vec2 p = aPos * uRect.zw;
  float top = 1.0 - aPos.y;
  p.x += uBend * top * top;
  p.x += uShear * smoothstep(0.52, 1.0, aPos.y);
  vec2 piv = vec2(uRect.z * 0.5, uRect.w);
  vec2 d = p - piv;
  float c = cos(uRot), s = sin(uRot);
  p = piv + vec2(c * d.x - s * d.y, s * d.x + c * d.y);
  vec2 scr = (uRect.xy + uOffset + p) * uMap.x + uMap.yz;
  vec2 clip = scr / uView * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

const FS_LAYER = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uTex;
out vec4 o;
void main() { o = texture(uTex, vUv); }`;

const FS_PLATE = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform sampler2D uMotion;
uniform float uTime;
out vec4 o;
void main() {
  vec4 m = texture(uMotion, vUv);
  float ph = m.g * 6.2831853;
  float t = uTime;
  float wind = sin(t * 0.83 + ph) * 0.55 + sin(t * 1.87 + ph * 1.7) * 0.2 + sin(t * 0.31 + ph * 0.5) * 0.45;
  vec2 off = vec2(m.r * wind * 5.0, m.r * sin(t * 1.3 + ph) * 1.0);
  float w = m.b;
  off.x += w * sin(vUv.y * 2160.0 * 0.33 + t * 0.9) * 1.8;
  off.y += w * sin(vUv.x * 3840.0 * 0.011 - t * 1.05 + vUv.y * 60.0) * 1.3;
  o = texture(uTex, vUv - off / vec2(3840.0, 2160.0));
}`;

const rand = (a, b) => a + Math.random() * (b - a);

function compile(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(p, i).name;
    u[name] = gl.getUniformLocation(p, name);
  }
  return { p, u };
}

function texture(gl, img, { premultiply = true, mips = true } = {}) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, premultiply ? gl.BROWSER_DEFAULT_WEBGL : gl.NONE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (mips) {
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }
  return t;
}

function loadImage(src) {
  return new Promise((ok, fail) => {
    const i = new Image();
    i.decoding = 'async';
    i.onload = () => ok(i);
    i.onerror = () => fail(new Error('Failed to load ' + src));
    i.src = src;
  });
}

// ---------- behaviours (all in image px / seconds) ----------
const WALKERS = { walkers_pair: 30, walker_saree: 24, walker_man: 36 };
const PARALLAX = { sky: 70, trees: 0, people: -34, vehicles: -26, boats: -38 };

function makeActor(L, i) {
  const a = { L, ox: 0, oy: 0, rot: 0, shear: 0, bend: 0, seed: rand(0, 100) };
  const id = L.id;
  if (WALKERS[id]) {
    a.speed = WALKERS[id];
    a.step = rand(0, 1);
    a.update = (t, dt, view) => {
      a.ox -= a.speed * dt;
      // walked off the visible left edge: come straight back in from the visible right edge
      if (L.x + a.ox + L.w < view.x0 - 20) a.ox = view.x1 + rand(20, 160) - L.x;
      a.step += dt * (a.speed / 52);
      const s = Math.sin(a.step * Math.PI);
      a.oy = -Math.abs(s) * 4.5;
      a.rot = Math.sin(a.step * Math.PI) * 0.0045;
      a.shear = Math.sin(a.step * Math.PI * 2) * 5.5;
    };
  } else if (id === 'cyclist') {
    a.update = (t, dt, view) => {
      a.ox -= 52 * dt;
      if (L.x + a.ox + L.w < view.x0 - 20) a.ox = view.x1 + rand(60, 400) - L.x;
      a.oy = Math.sin(t * 3.1) * 1.2;
      a.rot = Math.sin(t * 1.55) * 0.003;
    };
  } else if (id === 'rickshaw_near') {
    // idles at its stand and creeps a little: keeps the patch behind it mostly covered
    a.update = (t) => {
      a.ox = Math.sin(t * 0.045 + 0.4) * 46 - 18;
      a.oy = Math.sin(t * 29) * 0.45;
    };
  } else if (id === 'rickshaw_far' || id === 'scooter_far') {
    const k = id === 'scooter_far' ? 1 : 0;
    a.update = (t) => {
      a.ox = Math.sin(t * (0.06 + k * 0.025) + k * 2) * (16 - k * 3);
      a.oy = Math.sin(t * 23 + k) * 0.3;
    };
  } else if (L.group === 'boats') {
    a.speed = rand(7, 15) * (i % 3 === 0 ? -1 : 1);
    a.update = (t, dt, view) => {
      a.ox += a.speed * dt;
      const x = L.x + a.ox;
      const left = Math.max(FRAME.x0, view.x0), right = Math.min(FRAME.x1, view.x1);
      if (a.speed > 0 && x > right + 10) a.ox = left - L.w - 10 - L.x;
      if (a.speed < 0 && x + L.w < left - 10) a.ox = right + 10 - L.x;
      a.oy = Math.sin(t * 0.85 + a.seed) * 2.4;
      a.rot = Math.sin(t * 0.62 + a.seed) * 0.009;
    };
  } else if (id.startsWith('cloud')) {
    a.update = (t) => {
      a.ox = Math.sin(t * 0.011 + a.seed) * 70 + Math.sin(t * 0.027 + a.seed * 2) * 14;
    };
  } else if (id === 'palm') {
    a.update = (t) => {
      a.bend = (Math.sin(t * 0.8) * 0.6 + Math.sin(t * 1.9 + 1) * 0.22 + Math.sin(t * 0.3) * 0.4) * 9;
    };
  } else {
    a.update = () => {};
  }
  return a;
}

// ---------- birds ----------
class Flocks {
  constructor(lite) {
    this.lite = lite;
    this.flocks = [];
    this.next = 2.5;
  }
  spawn(view) {
    const n = Math.round(rand(3, this.lite ? 4 : 6));
    const ltr = Math.random() < 0.55;
    const span = view.x1 - view.x0;
    const y0 = rand(170, 560);
    const birds = [];
    for (let i = 0; i < n; i++) {
      birds.push({
        dx: -i * rand(28, 60) + rand(-10, 10),
        dy: rand(-40, 40) + (i % 2 ? 18 : -10),
        size: rand(13, 20),
        flap: rand(1.6, 2.6),
        ph: rand(0, 6.28),
        glide: rand(0, 6.28),
      });
    }
    this.flocks.push({
      t: 0,
      dur: rand(22, 32) * Math.max(0.6, span / 3840),
      ltr, y0, x0: view.x0 - 120, x1: view.x1 + 260,
      arc: rand(-90, 60), wob: rand(20, 40), birds,
    });
  }
  update(dt, view) {
    this.next -= dt;
    if (this.next <= 0) {
      this.spawn(view);
      this.next = rand(9, 18);
    }
    for (const f of this.flocks) f.t += dt;
    this.flocks = this.flocks.filter((f) => f.t < f.dur + 2);
  }
  draw(ctx, time) {
    for (const f of this.flocks) {
      const p = f.t / f.dur;
      const across = f.x0 + (f.x1 - f.x0) * p;
      for (const b of f.birds) {
        const x = f.ltr ? across + b.dx : f.x1 - (across - f.x0) - b.dx;
        const y = f.y0 + b.dy + Math.sin(p * Math.PI) * f.arc + Math.sin(p * 9 + b.ph) * f.wob * 0.3;
        // flap, with the odd glide
        const gliding = Math.sin(time * 0.35 + b.glide) > 0.72;
        const w = gliding ? 0.25 : Math.sin(time * b.flap * 6.283 + b.ph);
        const s = b.size;
        const lift = s * (0.15 + 0.45 * w);
        ctx.beginPath();
        ctx.moveTo(x - s, y - lift * 0.4);
        ctx.quadraticCurveTo(x - s * 0.45, y - lift, x, y);
        ctx.quadraticCurveTo(x + s * 0.45, y - lift, x + s, y - lift * 0.4);
        ctx.stroke();
      }
    }
  }
}

export async function initHero({ canvas, birdCanvas, lite = false, reduced = false, onReady }) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' });
  if (!gl) return null;

  const res = lite ? '2k' : '4k';
  const meta = await (await fetch('/hero/layers.json')).json();
  const layers = meta.layers.filter((L) => !L.id.startsWith('birds'));
  const [plateImg, mapImg, ...imgs] = await Promise.all([
    loadImage(`/hero/plate@${res}.webp`),
    loadImage('/hero/motion_map.png'),
    ...layers.map((L) => loadImage(`/hero/layers/${L.id}@${res}.webp`)),
  ]);

  const progLayer = compile(gl, VS, FS_LAYER);
  const progPlate = compile(gl, VS, FS_PLATE);

  // subdivided unit quad so the vertex shader can bend it
  const NX = 6, NY = 24;
  const verts = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) verts.push(i / NX, j / NY);
  const idx = [];
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
  const count = idx.length;

  const plateTex = texture(gl, plateImg, { premultiply: false });
  const motionTex = texture(gl, mapImg, { premultiply: false, mips: false });
  const actors = layers.map((L, i) => {
    const a = makeActor(L, i);
    a.tex = texture(gl, imgs[i]);
    a.par = PARALLAX[L.group] ?? 0;
    return a;
  });

  const ctx = birdCanvas.getContext('2d');
  const flocks = new Flocks(lite);

  const state = { w: 0, h: 0, dpr: 1, s: 1, ox: 0, oy: 0, progress: 0, time: 0, running: false, visible: true, raf: 0, last: 0 };

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, lite ? 1.25 : 2);
    state.dpr = dpr;
    state.w = Math.max(1, Math.round(r.width * dpr));
    state.h = Math.max(1, Math.round(r.height * dpr));
    for (const c of [canvas, birdCanvas]) {
      c.width = state.w;
      c.height = state.h;
    }
    // cover-fit, centred horizontally; keep a little more sky than lake when cropping vertically
    const s = Math.max(state.w / IMG_W, state.h / IMG_H);
    state.s = s;
    state.ox = (state.w - IMG_W * s) * 0.5;
    state.oy = (state.h - IMG_H * s) * 0.4;
    if (!state.running) render();
  }

  function visibleRange() {
    return { x0: Math.max(0, -state.ox / state.s), x1: Math.min(IMG_W, (state.w - state.ox) / state.s) };
  }

  function setCommon(prog) {
    gl.useProgram(prog.p);
    gl.uniform2f(prog.u.uView, state.w, state.h);
    gl.uniform3f(prog.u.uMap, state.s, state.ox, state.oy);
  }

  function render() {
    const { s, ox, oy } = state;
    gl.viewport(0, 0, state.w, state.h);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(1, 0.965, 0.918, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindVertexArray(vao);

    // plate
    gl.disable(gl.BLEND);
    setCommon(progPlate);
    const u = progPlate.u;
    gl.uniform4f(u.uRect, 0, 0, IMG_W, IMG_H);
    gl.uniform2f(u.uOffset, 0, 0);
    gl.uniform1f(u.uBend, 0);
    gl.uniform1f(u.uShear, 0);
    gl.uniform1f(u.uRot, 0);
    gl.uniform1f(u.uTime, state.time);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, plateTex);
    gl.uniform1i(u.uTex, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, motionTex);
    gl.uniform1i(u.uMotion, 1);

    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);

    // layers, clipped to the drawn frame
    gl.enable(gl.SCISSOR_TEST);
    const sx = Math.round(FRAME.x0 * s + ox), sy1 = Math.round(FRAME.y0 * s + oy);
    const sw = Math.round((FRAME.x1 - FRAME.x0) * s), sh = Math.round((FRAME.y1 - FRAME.y0) * s);
    gl.scissor(sx, state.h - (sy1 + sh), sw, sh);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    setCommon(progLayer);
    const v = progLayer.u;
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(v.uTex, 0);
    const p = state.progress;
    for (const a of actors) {
      const L = a.L;
      gl.uniform4f(v.uRect, L.x, L.y, L.w, L.h);
      gl.uniform2f(v.uOffset, a.ox, a.oy + a.par * p);
      gl.uniform1f(v.uBend, a.bend);
      gl.uniform1f(v.uShear, a.shear);
      gl.uniform1f(v.uRot, a.rot);
      gl.bindTexture(gl.TEXTURE_2D, a.tex);
      gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
    }

    // birds
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, state.w, state.h);
    ctx.setTransform(s, 0, 0, s, ox, oy + PARALLAX.sky * p * s);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    flocks.draw(ctx, state.time);
  }

  const frameGap = lite ? 1 / 31 : 0;
  function tick(now) {
    state.raf = requestAnimationFrame(tick);
    const t = now / 1000;
    const dt = Math.min(0.1, t - (state.last || t));
    if (dt < frameGap) return;
    state.last = t;
    state.time += dt;
    const view = visibleRange();
    for (const a of actors) a.update(state.time, dt, view);
    flocks.update(dt, view);
    render();
  }

  function start() {
    if (state.running || reduced) return;
    state.running = true;
    state.last = 0;
    state.raf = requestAnimationFrame(tick);
  }
  function stop() {
    state.running = false;
    cancelAnimationFrame(state.raf);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // only animate while the hero is on screen and the tab is visible
  const io = new IntersectionObserver(([e]) => {
    state.visible = e.isIntersecting;
    state.visible && !document.hidden ? start() : stop();
  });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => {
    !document.hidden && state.visible ? start() : stop();
  });

  render();
  onReady?.();
  if (!reduced) start();

  return {
    setProgress(p) {
      state.progress = p;
      if (!state.running) render();
    },
  };
}
