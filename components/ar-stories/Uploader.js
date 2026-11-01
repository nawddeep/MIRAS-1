'use client';
/* eslint-disable @next/next/no-img-element -- these show streamed, signed-in-only story media and a blob: preview of the visitor's own file; next/image cannot optimise either */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import StoriesHeader from './StoriesHeader';
import { PLACES } from '@/lib/ar-stories/mock';
import { useMe } from '@/lib/ar-stories/useStories';
import { ImmersiveEngine } from '@/lib/ar-stories/immersive';

const MAX_SECONDS = 60;
const MAX_MB = 150;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Guess the projection from the shape: 2:1 = full 360° sphere, wider = panorama. */
function detect(w, h) {
  const a = w / h;
  if (Math.abs(a - 2) < 0.06) return { projection: 'equirect', panoDeg: 360 };
  if (a >= 2.4) return { projection: 'pano', panoDeg: a >= 4 ? 360 : Math.round(Math.min(360, a * 60) / 10) * 10 };
  return { projection: 'flat', panoDeg: 360 };
}

function Preview360({ el, mediaType, projection, panoDeg, aspect }) {
  const host = useRef(null);
  const eng = useRef(null);
  useEffect(() => {
    eng.current = new ImmersiveEngine(host.current);
    return () => eng.current?.dispose();
  }, []);
  useEffect(() => {
    if (!eng.current || !el) return;
    eng.current.setMedia({ el, mediaType, projection, panoDeg, aspect });
    eng.current.setMode('360');
  }, [el, mediaType, projection, panoDeg, aspect]);
  return <div ref={host} className="preview-360" title="Drag to look around" />;
}

export default function Uploader() {
  const router = useRouter();
  const [me] = useMe();
  const [file, setFile] = useState(null);
  const [info, setInfo] = useState(null); // { el, url, mediaType, w, h, aspect, length }
  const elRef = useRef(null); // the same element, for the code that has to change it (play position)
  const [projection, setProjection] = useState('flat');
  const [panoDeg, setPanoDeg] = useState(360);
  const [photoSecs, setPhotoSecs] = useState(8);
  const [trimStart, setTrimStart] = useState(0);
  const [caption, setCaption] = useState('');
  const [place, setPlace] = useState(PLACES[0]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(0); // upload % (0 = idle)
  const [drag, setDrag] = useState(false);

  useEffect(() => () => { if (info?.url) URL.revokeObjectURL(info.url); }, [info]);

  const pick = (f) => {
    setErr('');
    if (!f) return;
    if (!/^(image\/(jpeg|png|webp)|video\/(mp4|webm|quicktime))$/.test(f.type)) { setErr('Use a JPG, PNG or WEBP photo, or an MP4, WEBM or MOV video.'); return; }
    if (f.size > MAX_MB * 1024 * 1024) { setErr(`That file is ${(f.size / 1048576).toFixed(0)} MB – the limit is ${MAX_MB} MB.`); return; }
    const url = URL.createObjectURL(f);
    const done = (el, w, h, length) => {
      const d = detect(w, h);
      elRef.current = el;
      setFile(f); setInfo({ el, url, mediaType: f.type.startsWith('video') ? 'video' : 'image', w, h, aspect: w / h, length });
      setProjection(d.projection); setPanoDeg(d.panoDeg); setTrimStart(0);
      setPhotoSecs(d.projection === 'flat' ? 6 : 10);
    };
    if (f.type.startsWith('image')) {
      const img = new Image();
      img.onload = () => done(img, img.naturalWidth, img.naturalHeight, 0);
      img.onerror = () => setErr('Could not read that photo.');
      img.src = url;
    } else {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.loop = true; v.preload = 'auto';
      v.onloadedmetadata = () => { done(v, v.videoWidth, v.videoHeight, v.duration); v.play().catch(() => {}); };
      v.onerror = () => setErr('Could not read that video (try MP4 / H.264).');
      v.src = url;
    }
  };

  // keep the preview video looping inside the chosen 60 s window
  useEffect(() => {
    const v = info?.mediaType === 'video' ? elRef.current : null;
    if (!v) return;
    const end = trimStart + Math.min(MAX_SECONDS, info.length - trimStart);
    v.currentTime = trimStart;
    const onTime = () => { if (v.currentTime >= end || v.currentTime < trimStart - 0.5) v.currentTime = trimStart; };
    v.addEventListener('timeupdate', onTime);
    return () => v.removeEventListener('timeupdate', onTime);
  }, [info, trimStart]);

  const isVideo = info?.mediaType === 'video';
  const tooLong = isVideo && info.length > MAX_SECONDS;
  const clipLen = isVideo ? Math.min(MAX_SECONDS, info.length - trimStart) : photoSecs;

  const submit = (e) => {
    e.preventDefault();
    if (!file || busy) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('projection', projection);
    fd.append('panoDeg', String(panoDeg));
    fd.append('caption', caption);
    fd.append('place', place);
    fd.append('duration', String(isVideo ? clipLen : photoSecs));
    if (isVideo) { fd.append('videoLength', String(info.length)); fd.append('trimStart', String(trimStart)); }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/ar-stories');
    xhr.upload.onprogress = (ev) => ev.lengthComputable && setBusy(Math.max(1, Math.round((ev.loaded / ev.total) * 100)));
    xhr.onload = () => {
      setBusy(0);
      if (xhr.status === 201) { const { story } = JSON.parse(xhr.responseText); router.push(`/ar-stories/story/${me}?s=${story.id}`); }
      else { try { setErr(JSON.parse(xhr.responseText).error); } catch { setErr(`Upload failed (${xhr.status})`); } }
    };
    xhr.onerror = () => { setBusy(0); setErr('Network error – try again.'); };
    setBusy(1);
    xhr.send(fd);
  };

  if (!me) {
    return (
      <main className="home">
        <StoriesHeader />
        <div className="pad">
          <h2>Sign in to share a story</h2>
          <p className="muted">Stories are shared by MIRAS members. <Link href="/account" className="link">Sign in or create an account</Link>, then come back.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="home">
      <StoriesHeader />
      <form className="create pad" onSubmit={submit}>
        <div className="section-head">
          <h2>New story</h2>
          <p className="muted small">Shown to signed-in MIRAS members for 24 hours. Please don’t share photos or video of people without their consent.</p>
          <p className="muted">Share a 360° photo or video, a panorama, or a normal photo/video. Everyone can open it in <b>360</b>, <b>VR</b> and <b>AR</b>. Stories last 24 hours · max {MAX_SECONDS} seconds.</p>
        </div>

        {!info ? (
          <label className={`drop ${drag ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}>
            <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" onChange={(e) => pick(e.target.files[0])} />
            <span className="drop-icon">🌐</span>
            <b>Choose a photo or video</b>
            <span className="muted">360° photos & videos (2:1), panoramas, or normal media · up to {MAX_MB} MB</span>
          </label>
        ) : (
          <div className="create-grid">
            <div className="preview">
              {projection === 'flat'
                ? (isVideo ? <video src={info.url} muted playsInline autoPlay loop className="preview-flat" /> : <img src={info.url} alt="" className="preview-flat" />)
                : <Preview360 el={info.el} mediaType={info.mediaType} projection={projection} panoDeg={panoDeg} aspect={info.aspect} />}
              <p className="muted small">{info.w}×{info.h} · {isVideo ? fmt(info.length) : 'photo'} · {(file.size / 1048576).toFixed(1)} MB {projection !== 'flat' && '· drag the preview to look around'}</p>
              <button type="button" className="link" onClick={() => { setInfo(null); setFile(null); }}>Choose another file</button>
            </div>

            <div className="fields">
              <div>
                <span className="label">What kind of media is this?</span>
                <div className="seg">
                  {[['equirect', '360° (full sphere)'], ['pano', 'Panorama'], ['flat', 'Normal']].map(([k, l]) => (
                    <button type="button" key={k} className={projection === k ? 'on' : ''} onClick={() => setProjection(k)}>{l}</button>
                  ))}
                </div>
                <p className="muted small">
                  {projection === 'equirect' && 'Full 360×180° – from a 360 camera or a phone “photo sphere” (2:1 image).'}
                  {projection === 'pano' && 'A wide panorama shot by turning your phone – it wraps around the viewer.'}
                  {projection === 'flat' && 'A normal photo or video – shown on a big screen in VR and floating in AR.'}
                  {info.aspect && ` Detected shape ${info.aspect.toFixed(2)}:1.`}
                </p>
              </div>
              {projection === 'pano' && (
                <label>How far around does it go? <b>{panoDeg}°</b>
                  <input type="range" min="90" max="360" step="10" value={panoDeg} onChange={(e) => setPanoDeg(+e.target.value)} />
                </label>
              )}

              {isVideo ? (
                tooLong ? (
                  <label className="trim">
                    <span>Your video is <b>{fmt(info.length)}</b> – stories are max {MAX_SECONDS} s. Pick the part to share:</span>
                    <input type="range" min="0" max={Math.max(0, info.length - MAX_SECONDS)} step="0.5" value={trimStart} onChange={(e) => setTrimStart(+e.target.value)} />
                    <span className="muted small">Clip {fmt(trimStart)} – {fmt(trimStart + clipLen)} ({Math.round(clipLen)} s)</span>
                  </label>
                ) : <p className="ok small">✓ {Math.round(info.length)} s – within the {MAX_SECONDS} s limit</p>
              ) : (
                <label>Show for <b>{photoSecs} s</b> <span className="muted">(max {MAX_SECONDS})</span>
                  <input type="range" min="3" max={MAX_SECONDS} value={photoSecs} onChange={(e) => setPhotoSecs(+e.target.value)} />
                </label>
              )}

              <label>Caption<input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={160} placeholder="What’s happening here?" /></label>
              <label>Location
                <select value={place} onChange={(e) => setPlace(e.target.value)}>{PLACES.map((p) => <option key={p}>{p}</option>)}</select>
              </label>

              {err && <p className="err">{err}</p>}
              <button className="btn primary block" disabled={!!busy}>{busy ? `Uploading… ${busy}%` : 'Share to your story'}</button>
              {busy > 0 && <div className="upbar"><i style={{ width: `${busy}%` }} /></div>}
            </div>
          </div>
        )}
        {!info && err && <p className="err">{err}</p>}
        <p className="muted small center"><Link href="/ar-stories" className="link">← Back to stories</Link></p>
      </form>
    </main>
  );
}
