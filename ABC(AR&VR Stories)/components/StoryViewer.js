'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Avatar from './Avatar';
import { kindLabel, timeAgo, trayFor, useMe, useStories } from '@/lib/useStories';
import { ImmersiveEngine, requestMotionPermission, deviceOrientationSupported } from '@/lib/immersive';

const MAX_SECONDS = 60;
const EMOJI = ['😍', '🔥', '👏', '😮', '😂', '🙏'];
const MODE_LABEL = { flat: 'Flat', '360': '360°', vr: 'VR', ar: 'AR' };

/** Loads a story's media element (image or video). */
function loadMedia(s, muted) {
  return new Promise((resolve, reject) => {
    if (s.mediaType === 'image') {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve({ el: img, aspect: img.naturalWidth / img.naturalHeight });
      img.onerror = () => reject(new Error('Could not load the photo'));
      img.src = s.src;
    } else {
      const v = document.createElement('video');
      v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
      v.muted = muted; v.preload = 'auto'; v.loop = !!s.loop;
      v.onloadedmetadata = () => { if (s.trimStart) v.currentTime = s.trimStart; resolve({ el: v, aspect: v.videoWidth / v.videoHeight }); };
      v.onerror = () => reject(new Error('Could not load the video'));
      v.src = s.src;
    }
  });
}

export default function StoryViewer({ userId, startId }) {
  const router = useRouter();
  const [me] = useMe();
  const { data, reload } = useStories();
  const rows = useMemo(() => trayFor(data, me), [data, me]);
  const [userIdx, setUserIdx] = useState(-1);
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState(null); // null = default for the story
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [media, setMedia] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [arCam, setArCam] = useState({ state: 'off' }); // off | on | error
  const [xr, setXr] = useState({ vr: false, ar: false });
  const [sheet, setSheet] = useState(false);
  const [reply, setReply] = useState('');
  const [toast, setToast] = useState('');
  const stageRef = useRef(null);
  const engineHost = useRef(null);
  const engineRef = useRef(null);
  const camRef = useRef(null);
  const flatRef = useRef(null);
  const elapsed = useRef(0);

  // ---- which user/story to start with
  useEffect(() => {
    if (!rows.length || userIdx !== -1) return;
    const ui = rows.findIndex((r) => r.user.id === userId);
    if (ui === -1) { router.replace('/'); return; }
    const list = rows[ui].stories;
    let si = startId ? list.findIndex((s) => s.id === startId) : list.findIndex((s) => !s.views.includes(me));
    if (si < 0) si = 0;
    setUserIdx(ui); setIdx(si);
  }, [rows, userId, startId, me, userIdx, router]);

  const row = rows[userIdx];
  const story = row?.stories[idx];
  const isMine = row?.user.id === me;
  const immersiveSrc = story && story.projection !== 'flat';
  const modes = immersiveSrc ? ['360', 'vr', 'ar'] : ['flat', 'vr', 'ar'];
  const activeMode = mode && modes.includes(mode) ? mode : (immersiveSrc ? '360' : 'flat');
  const playSeconds = story ? Math.min(MAX_SECONDS, story.duration || 8) : 8;
  const effPaused = paused || holding || sheet || !!reply || !media;

  const close = useCallback(() => router.push('/'), [router]);
  const flash = (t) => { setToast(t); setTimeout(() => setToast(''), 1800); };

  const go = useCallback((dir) => {
    if (!row) return;
    elapsed.current = 0; setProgress(0);
    if (dir > 0) {
      if (idx < row.stories.length - 1) setIdx(idx + 1);
      else if (userIdx < rows.length - 1) { setUserIdx(userIdx + 1); setIdx(0); }
      else close();
    } else if (idx > 0) setIdx(idx - 1);
    else if (userIdx > 0) { setUserIdx(userIdx - 1); setIdx(rows[userIdx - 1].stories.length - 1); }
    else { elapsed.current = 0; if (media?.el?.tagName === 'VIDEO') media.el.currentTime = story.trimStart || 0; }
  }, [row, idx, userIdx, rows, close, media, story]);

  // ---- load the current story's media
  useEffect(() => {
    if (!story) return;
    let alive = true;
    setMedia(null); setLoadErr(null); elapsed.current = 0; setProgress(0);
    loadMedia(story, muted).then((m) => { if (alive) setMedia({ ...m, story }); }).catch((e) => alive && setLoadErr(e.message));
    if (!isMine) fetch(`/api/stories/${story.id}/view`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ viewer: me }) }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  // pause / play the video with the story
  useEffect(() => {
    const v = media?.el;
    if (!v || v.tagName !== 'VIDEO') return;
    v.muted = muted;
    if (effPaused) v.pause();
    else v.play().catch(() => { v.muted = true; setMuted(true); v.play().catch(() => {}); });
  }, [media, effPaused, muted, activeMode]); // re-assert after moving the element between flat and 3D views
  useEffect(() => () => { const v = media?.el; if (v?.tagName === 'VIDEO') { v.pause(); v.removeAttribute('src'); v.load(); } }, [media]);

  // ---- the 3D engine (360 / VR / AR)
  useEffect(() => {
    if (activeMode === 'flat' || !engineHost.current) return;
    if (!engineRef.current) {
      engineRef.current = new ImmersiveEngine(engineHost.current, { onPortalTap: () => { setMode('360'); flash('You stepped inside 🌐'); } });
      ImmersiveEngine.xrSupport().then(setXr);
    }
    return undefined;
  }, [activeMode]);
  useEffect(() => () => { engineRef.current?.dispose(); engineRef.current = null; }, []);
  useEffect(() => {
    const e = engineRef.current;
    if (!e || activeMode === 'flat' || !media) return;
    e.setMedia({ el: media.el, mediaType: media.story.mediaType, projection: media.story.projection, panoDeg: media.story.panoDeg, aspect: media.aspect });
    e.setMode(activeMode);
    e.setGyro(activeMode !== '360' ? deviceOrientationSupported() : e.useGyro);
  }, [media, activeMode]);

  // ---- flat mode shows the element itself
  useEffect(() => {
    const host = flatRef.current;
    if (!host) return;
    host.innerHTML = '';
    if (activeMode === 'flat' && media) { media.el.className = 'flat-media'; host.appendChild(media.el); }
  }, [activeMode, media]);

  // ---- AR camera feed
  useEffect(() => {
    if (activeMode !== 'ar') return;
    let stream;
    let alive = true;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error(window.isSecureContext ? 'No camera API in this browser' : 'The camera needs HTTPS (npm run dev:https)');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
        camRef.current.srcObject = stream;
        await camRef.current.play().catch(() => {});
        setArCam({ state: 'on' });
      } catch (err) { setArCam({ state: 'error', msg: err.message || 'Camera unavailable' }); }
    })();
    return () => { alive = false; stream?.getTracks().forEach((t) => t.stop()); setArCam({ state: 'off' }); };
  }, [activeMode]);

  // ---- VR: fullscreen + landscape where allowed
  useEffect(() => {
    if (activeMode !== 'vr') return;
    (async () => {
      try { if (!document.fullscreenElement) await stageRef.current?.requestFullscreen?.(); } catch { /* iOS */ }
      try { await screen.orientation?.lock?.('landscape'); } catch { /* not everywhere */ }
    })();
    return () => { try { screen.orientation?.unlock?.(); } catch { /* ignore */ } if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  }, [activeMode]);

  // ---- progress clock (max 60 s per story)
  useEffect(() => {
    let raf, last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.25, Math.max(0, (now - last) / 1000)); last = now; // a stalled tab never skips a story
      if (story && media && !effPaused) {
        const v = media.el.tagName === 'VIDEO' ? media.el : null;
        let p;
        if (v && !story.loop) {
          const dur = Math.min(playSeconds, (v.duration || playSeconds) - (story.trimStart || 0));
          p = (v.currentTime - (story.trimStart || 0)) / Math.max(0.1, dur);
          if (v.ended) p = 1;
        } else {
          elapsed.current += dt;
          p = elapsed.current / playSeconds;
        }
        setProgress(Math.min(1, Math.max(0, p)));
        if (p >= 1) { go(1); }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [story, media, effPaused, playSeconds, go]);

  // keyboard
  useEffect(() => {
    const k = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') close(); else if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [go, close]);

  const pickMode = async (m) => {
    if (m !== '360' && m !== 'flat') await requestMotionPermission(); // this tap lets iOS share the gyroscope
    setMode(m);
    if (m === 'vr') flash('Put your phone in a VR viewer · stories advance on their own');
  };
  const toggleMotion = async () => {
    const e = engineRef.current;
    if (!e) return;
    if (e.useGyro) { e.setGyro(false); flash('Drag to look around'); }
    else if (await requestMotionPermission()) { e.setGyro(true); flash('Move your phone to look around'); }
    else flash('Motion sensors unavailable – drag to look');
    setPaused((p) => p);
  };
  const enterXR = async (kind) => {
    try {
      setPaused(false);
      await engineRef.current.enterXR(kind, stageRef.current, () => setMode(null));
    } catch (err) { flash(`Couldn’t start ${kind.toUpperCase()}: ${err.message}`); }
  };
  const react = async (payload) => {
    const r = await fetch(`/api/stories/${story.id}/react`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ by: me, ...payload }) });
    if (r.ok) { flash(payload.emoji ? `Sent ${payload.emoji}` : 'Reply sent'); reload(); }
  };
  const del = async () => {
    if (!confirm('Delete this story?')) return;
    const r = await fetch(`/api/stories/${story.id}`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: me }) });
    if (r.ok) { flash('Story deleted'); setUserIdx(-1); await reload(); router.push('/'); } else flash('Mock stories can’t be deleted');
  };

  // tap zones: left third = back, right third = next, hold = pause (in 360/AR the middle drags the view)
  const holdTimer = useRef(null);
  const zoneDown = () => { holdTimer.current = setTimeout(() => setHolding(true), 220); };
  const zoneUp = (dir) => { clearTimeout(holdTimer.current); if (holding) setHolding(false); else go(dir); };

  if (!rows.length || !row || !story) {
    return <div className="viewer"><div className="viewer-loading">Loading story…</div></div>;
  }
  const u = row.user;
  const viewers = story.views.filter((v) => v !== u.id).map((id) => data.users.find((x) => x.id === id)).filter(Boolean);

  return (
    <div ref={stageRef} className={`viewer mode-${activeMode}`}>
      {activeMode === 'ar' && <video ref={camRef} className="ar-camera" playsInline muted autoPlay />}
      {activeMode === 'ar' && arCam.state === 'error' && <div className="ar-fallback" />}
      <div ref={engineHost} className="engine-host" hidden={activeMode === 'flat'} />
      <div ref={flatRef} className="flat-host" hidden={activeMode !== 'flat'} />
      {!media && !loadErr && <div className="viewer-loading"><span className="spinner" /> Loading {kindLabel(story)}…</div>}
      {loadErr && <div className="viewer-loading">⚠️ {loadErr}</div>}

      {activeMode === 'vr' && <div className="vr-divider" />}

      {/* tap zones */}
      <button className="zone zone-left" aria-label="Previous story" onPointerDown={zoneDown} onPointerUp={() => zoneUp(-1)} onPointerLeave={() => { clearTimeout(holdTimer.current); setHolding(false); }} />
      <button className="zone zone-right" aria-label="Next story" onPointerDown={zoneDown} onPointerUp={() => zoneUp(1)} onPointerLeave={() => { clearTimeout(holdTimer.current); setHolding(false); }} />
      {activeMode === 'flat' && <button className="zone zone-mid" aria-label="Hold to pause" onPointerDown={zoneDown} onPointerUp={() => { clearTimeout(holdTimer.current); setHolding(false); }} />}

      <div className={`chrome ${holding ? 'hide' : ''}`}>
        <div className="bars">
          {row.stories.map((s, i) => (
            <span key={s.id} className="bar"><i style={{ width: `${i < idx ? 100 : i === idx ? progress * 100 : 0}%` }} /></span>
          ))}
        </div>
        <div className="vhead">
          <Avatar user={u} size={34} />
          <div className="vhead-text">
            <b>{u.handle}{u.local ? ' 🤝' : ''}</b> <span className="muted">{timeAgo(story.createdAt)}</span>
            <span className="vsub">{kindLabel(story)}{story.place ? ` · 📍 ${story.place}` : ''} · {Math.round(playSeconds)}s</span>
          </div>
          <div className="vhead-actions">
            {story.mediaType === 'video' && <button className="icon" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? '🔇' : '🔊'}</button>}
            <button className="icon" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play' : 'Pause'}>{paused ? '▶' : '❚❚'}</button>
            {isMine && !story.mock && <button className="icon" onClick={del} aria-label="Delete story">🗑</button>}
            <button className="icon" onClick={close} aria-label="Close">✕</button>
          </div>
        </div>
        <div className="modes" role="tablist" aria-label="View as">
          {modes.map((m) => <button key={m} role="tab" aria-selected={activeMode === m} className={activeMode === m ? 'on' : ''} onClick={() => pickMode(m)}>{MODE_LABEL[m]}</button>)}
          {activeMode === '360' && deviceOrientationSupported() && <button className="motion" onClick={toggleMotion}>📱 Motion</button>}
          {activeMode === 'vr' && xr.vr && <button className="motion" onClick={() => enterXR('vr')}>🥽 Headset</button>}
          {activeMode === 'ar' && xr.ar && <button className="motion" onClick={() => enterXR('ar')}>✨ WebXR AR</button>}
        </div>
      </div>

      {activeMode === 'ar' && (
        <p className="ar-hint">{arCam.state === 'error' ? `Camera off: ${arCam.msg}. Showing the portal without the camera.` : immersiveSrc ? 'Look around your room – tap the portal to step inside' : 'The story floats in your room – move your phone around it'}</p>
      )}
      {activeMode === '360' && <p className="look-hint">Drag{deviceOrientationSupported() ? ' or move your phone' : ''} to look around · pinch to zoom</p>}

      {story.caption && !holding && activeMode !== 'vr' && <p className="caption">{story.caption}</p>}

      {activeMode !== 'vr' && (
        <div className={`vfoot ${holding ? 'hide' : ''}`}>
          {isMine ? (
            <button className="views-btn" onClick={() => setSheet(true)}>👁 {viewers.length} view{viewers.length === 1 ? '' : 's'} · {story.reactions.length} repl{story.reactions.length === 1 ? 'y' : 'ies'}</button>
          ) : (
            <>
              <form className="reply" onSubmit={(e) => { e.preventDefault(); if (reply.trim()) { react({ text: reply }); setReply(''); } }}>
                <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder={`Reply to ${u.name.split(' ')[0]}…`} maxLength={300} />
                {reply.trim() && <button className="send">Send</button>}
              </form>
              <div className="emoji">{EMOJI.slice(0, 4).map((e) => <button key={e} onClick={() => react({ emoji: e })} aria-label={`React ${e}`}>{e}</button>)}</div>
            </>
          )}
        </div>
      )}

      {sheet && (
        <div className="sheet-bg" onClick={() => setSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Viewers ({viewers.length})</h3>
            {viewers.length === 0 && <p className="muted">No views yet.</p>}
            {viewers.map((v) => {
              const rs = story.reactions.filter((r) => r.by === v.id);
              return <div key={v.id} className="viewer-row"><Avatar user={v} size={32} /><b>{v.handle}</b><span className="muted">{rs.map((r) => r.emoji || `“${r.text}”`).join(' ')}</span></div>;
            })}
            {story.reactions.filter((r) => !story.views.includes(r.by)).map((r, i) => {
              const v = data.users.find((x) => x.id === r.by);
              return <div key={i} className="viewer-row"><Avatar user={v} size={32} /><b>{v?.handle}</b><span className="muted">{r.emoji || `“${r.text}”`}</span></div>;
            })}
            <button className="btn block" onClick={() => setSheet(false)}>Close</button>
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
