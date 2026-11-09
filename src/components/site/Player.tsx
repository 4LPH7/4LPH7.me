"use client";

import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { site } from "@/data/site";
import { step } from "@/lib/carousel";
import { formatTime } from "@/lib/time";

const tracks = site.tracks;
const pad = (n: number) => String(n).padStart(2, "0");
const RPM = (33.33 / 60) * Math.PI * 2; // record speed, rad/s
const SEC_PER_TURN = 60 / 33.33; // scrubbing: one full turn by hand moves the track about 1.8 s
const BARS = 48;
// Tonearm angles (deg). It pivots just off the record's top-right; see .deck-arm in site-widgets.css.
const ARM_REST = -100; // needle parked off the record
const ARM_OUTER = -71; // needle on the outer groove (start of the track)
const ARM_INNER = -45; // needle near the label (end of the track)

type Graph = { ctx: AudioContext; an: AnalyserNode; data: Uint8Array<ArrayBuffer> };
type Drag = { a: number; t: number; start: number; moved: number; acc: number; seekAt: number };

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const BLUE = { h: 217, s: 90 };

/** The cover's most vivid colour: a hue histogram weighted by saturation and brightness, so greys and mixed hues don't win. */
function coverTint(img: HTMLImageElement) {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return BLUE;
  g.drawImage(img, 0, 0, 32, 32);
  const d = g.getImageData(0, 0, 32, 32).data;
  const bins = Array.from({ length: 12 }, () => ({ w: 0, x: 0, y: 0, s: 0 }));
  for (let k = 0; k < d.length; k += 4) {
    const [r, gr, b] = [d[k] / 255, d[k + 1] / 255, d[k + 2] / 255];
    const max = Math.max(r, gr, b);
    const min = Math.min(r, gr, b);
    if (max - min < 0.08) continue;
    const delta = max - min;
    const h = (max === r ? ((gr - b) / delta) % 6 : max === gr ? (b - r) / delta + 2 : (r - gr) / delta + 4) * 60;
    const hue = (h + 360) % 360;
    const sat = delta / max;
    const w = sat * sat * max;
    const bin = bins[Math.floor(hue / 30) % 12];
    bin.w += w;
    bin.x += Math.cos((hue * Math.PI) / 180) * w;
    bin.y += Math.sin((hue * Math.PI) / 180) * w;
    bin.s += sat * w;
  }
  const top = bins.reduce((a, b) => (b.w > a.w ? b : a));
  if (!top.w) return BLUE;
  return { h: Math.round(((Math.atan2(top.y, top.x) * 180) / Math.PI + 360) % 360), s: Math.round(Math.max(55, Math.min(95, (top.s / top.w) * 100))) };
}

/**
 * Turntable player. Tap the record to play or pause; drag it round to scrub. It spins up and down with a little
 * inertia, the tonearm swings on and creeps inward as the song plays, and a ring of bars around the record follows
 * the music (Web Audio analyser, started on the first play). Media keys and phone lock screens get controls too.
 * Nothing plays until the visitor asks; failed loads say so.
 */
export function Player() {
  const audio = useRef<HTMLAudioElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const disc = useRef<HTMLSpanElement>(null);
  const viz = useRef<HTMLCanvasElement>(null);
  const eq = useRef<HTMLSpanElement>(null);
  const graph = useRef<Graph | null>(null);
  const spin = useRef({ angle: 0, omega: 0 });
  const drag = useRef<Drag | null>(null);
  const live = useRef(false); // playing, for the animation loop
  const [tint, setTint] = useState(BLUE);
  const tintRef = useRef(BLUE);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);
  const resume = useRef(false);
  const track = tracks[i];

  /** Route the audio through an analyser for the visualiser. Optional: if anything fails, audio plays as normal. */
  const connect = (a: HTMLAudioElement) => {
    if (graph.current) return graph.current;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      const ctx = new AC();
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      an.smoothingTimeConstant = 0.8;
      ctx.createMediaElementSource(a).connect(an);
      an.connect(ctx.destination);
      graph.current = { ctx, an, data: new Uint8Array(an.frequencyBinCount) };
    } catch {
      graph.current = null;
    }
    return graph.current;
  };

  const play = () => {
    const a = audio.current;
    if (!a) return;
    a.volume = volume;
    const g = connect(a);
    if (g?.ctx.state === "suspended") void g.ctx.resume();
    a.play().then(() => { setPlaying(true); setFailed(false); }, () => { setFailed(true); setPlaying(false); });
  };
  const pause = () => { audio.current?.pause(); setPlaying(false); };
  const toggle = () => (playing ? pause() : play());
  const go = (d: number) => {
    resume.current = playing;
    setI((n) => step(n, d, tracks.length));
    setFailed(false);
    setTime(0);
    setDuration(0);
  };

  live.current = playing;
  tintRef.current = tint;

  // Colour the deck from the cover art (falls back to the site blue).
  useEffect(() => {
    if (!track.cover) { setTint(BLUE); return; }
    const img = new window.Image();
    img.onload = () => setTint(coverTint(img));
    img.src = track.cover;
  }, [track.cover]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the track changes
  useEffect(() => {
    // Metadata can arrive before React hydrates and attaches onLoadedMetadata, so read it directly too.
    const a = audio.current;
    if (a && a.readyState >= 1 && Number.isFinite(a.duration)) setDuration(a.duration);
    if (resume.current) play();
  }, [i]);

  // Lock screen / media keys.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-bind with the latest handlers whenever state changes
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    ms.metadata = new MediaMetadata({ title: track.title, artist: track.artist, album: "4LPH7.me", artwork: track.cover ? [{ src: track.cover, sizes: "320x320", type: "image/webp" }] : [] });
    ms.playbackState = playing ? "playing" : "paused";
    const actions: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => play()],
      ["pause", () => pause()],
      ["previoustrack", () => go(-1)],
      ["nexttrack", () => go(1)],
      ["seekto", (d) => { if (audio.current && d.seekTime !== undefined) audio.current.currentTime = d.seekTime; }],
    ];
    for (const [a, fn] of actions) { try { ms.setActionHandler(a, fn); } catch { /* unsupported action */ } }
    return () => { for (const [a] of actions) { try { ms.setActionHandler(a, null); } catch { /* unsupported action */ } } };
  }, [i, playing, volume]);

  // Spin, visualiser ring, bass glow and mini EQ: one loop, only while the deck is on screen.
  useEffect(() => {
    const cv = viz.current;
    const g = cv?.getContext("2d");
    const host = stage.current;
    if (!cv || !g || !host) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const levels = new Float32Array(BARS);
    const bars = eq.current ? [...eq.current.children] as HTMLElement[] : [];
    let w = 0;
    let h = 0;
    let ring = 70;
    let visible = false;
    let raf = 0;
    let last = performance.now();
    const fit = () => {
      w = cv.clientWidth;
      h = cv.clientHeight;
      const dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.ceil(w * dpr);
      cv.height = Math.ceil(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      ring = (disc.current?.offsetWidth ?? 140) / 2 + 8;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cv);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(host);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) return;
      const s = spin.current;
      if (!drag.current) {
        const target = live.current ? RPM : 0;
        s.omega += (target - s.omega) * (1 - Math.exp(-dt * (target > s.omega ? 2.4 : 1.2)));
        s.angle += s.omega * dt;
      }
      if (!reduced && disc.current) disc.current.style.transform = `rotate(${s.angle}rad)`;

      const gr = graph.current;
      if (gr && live.current) {
        gr.an.getByteFrequencyData(gr.data);
        for (let k = 0; k < BARS; k++) levels[k] += (gr.data[2 + Math.floor(k * 1.3)] / 255 - levels[k]) * 0.45;
      } else {
        for (let k = 0; k < BARS; k++) levels[k] += (0.05 + 0.03 * Math.sin(now / 700 + k * 0.6) - levels[k]) * 0.06;
      }
      const bass = (levels[0] + levels[1] + levels[2] + levels[3]) / 4;
      bars.forEach((b, k) => { b.style.transform = `scaleY(${(0.15 + levels[[1, 6, 14, 26][k]] * 0.95).toFixed(3)})`; });

      g.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const { h: th, s: ts } = tintRef.current;
      const glow = g.createRadialGradient(cx, cy, ring * 0.6, cx, cy, ring + 40 + bass * 50);
      glow.addColorStop(0, `hsla(${th}, ${ts}%, 55%, ${0.14 + bass * 0.4})`);
      glow.addColorStop(1, `hsla(${th}, ${ts}%, 55%, 0)`);
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);
      g.lineCap = "round";
      g.lineWidth = Math.max(2, ring * 0.035);
      const max = Math.min(cy - ring - 6, 38);
      for (let k = 0; k < BARS; k++) {
        const len = 3 + levels[k] * max;
        const hue = th - (k / BARS) * 16 + bass * 10; // the cover's colour, drifting a little along the ring
        g.strokeStyle = `hsla(${hue}, ${ts}%, ${60 + levels[k] * 20}%, ${0.35 + levels[k] * 0.65})`;
        for (const side of [1, -1]) {
          const a = -Math.PI / 2 + side * (k + 0.5) * (Math.PI / BARS);
          const c = Math.cos(a);
          const sn = Math.sin(a);
          g.beginPath();
          g.moveTo(cx + c * ring, cy + sn * ring);
          g.lineTo(cx + c * (ring + len), cy + sn * (ring + len));
          g.stroke();
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, []);

  useEffect(() => () => { void graph.current?.ctx.close(); }, []);

  // Record: a tap toggles, a drag spins it by hand and scrubs the track.
  const angleOf = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  };
  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button > 0) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    const now = performance.now();
    drag.current = { a: angleOf(e), t: now, start: now, moved: 0, acc: 0, seekAt: 0 };
  };
  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const a = angleOf(e);
    const delta = wrapAngle(a - d.a);
    const now = performance.now();
    d.a = a;
    d.moved += Math.abs(delta);
    spin.current.angle += delta;
    spin.current.omega = delta / Math.max(0.001, (now - d.t) / 1000);
    d.t = now;
    const el = audio.current;
    if (el && duration && d.moved > 0.15) {
      d.acc += delta;
      if (now - d.seekAt > 80) {
        el.currentTime = Math.max(0, Math.min(duration, el.currentTime + (d.acc / (Math.PI * 2)) * SEC_PER_TURN));
        setTime(el.currentTime);
        d.acc = 0;
        d.seekAt = now;
      }
    }
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    const el = audio.current;
    if (d && el && duration && d.acc) el.currentTime = Math.max(0, Math.min(duration, el.currentTime + (d.acc / (Math.PI * 2)) * SEC_PER_TURN));
    if (d && d.moved < 0.15 && performance.now() - d.start < 450) toggle();
  };

  const progress = duration ? time / duration : 0;
  const pct = progress * 100;
  return (
    <div
      className="deck card"
      data-playing={playing}
      style={{ "--deck-tint": `hsl(${tint.h} ${tint.s}% 62%)`, "--deck-cover": track.cover ? `url(${track.cover})` : "none" } as React.CSSProperties}
    >
      <div ref={stage} className="deck-stage">
        <span className="deck-viz" aria-hidden="true"><canvas ref={viz} /></span>
        <div className="deck-platter">
        <button
          type="button"
          className="deck-record"
          aria-label={playing ? "Pause record" : "Play record"}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => { drag.current = null; }}
          onClick={(e) => { if (e.detail === 0) toggle(); }}
        >
          <span ref={disc} className="deck-disc">
            <span className="deck-label" aria-hidden="true" style={track.cover ? { backgroundImage: `url(${track.cover})` } : undefined}>
              {track.cover ? null : pad(i + 1)}
            </span>
          </span>
          <span className="deck-sheen" aria-hidden="true" />
        </button>
        <span
          className="deck-arm"
          aria-hidden="true"
          style={{ "--arm": `${playing ? ARM_OUTER + (ARM_INNER - ARM_OUTER) * progress : ARM_REST}deg` } as React.CSSProperties}
        ><i /></span>
        </div>
        <span className="deck-cue" aria-hidden="true">
          <span className="hint-fine">CLICK TO PLAY · DRAG TO SCRUB</span>
          <span className="hint-touch">TAP TO PLAY · DRAG TO SCRUB</span>
        </span>
      </div>
      <div className="deck-info">
        <div className="deck-meta">
          {track.cover ? <Image className="deck-art" src={track.cover} alt="" width={48} height={48} /> : null}
          <div>
          <p className="eyebrow deck-now">
            <span ref={eq} className="deck-eq" aria-hidden="true"><i /><i /><i /><i /></span>
            NOW PLAYING · {pad(i + 1)} / {pad(tracks.length)}
          </p>
          <p className="deck-title">{track.title}</p>
          <p className="deck-artist">{track.artist}</p>
          </div>
        </div>
        <div className="deck-ctl">
          <button type="button" onClick={() => go(-1)} aria-label="Previous track"><SkipBack size={16} aria-hidden="true" /></button>
          <button type="button" className="deck-play" onClick={toggle} aria-label="Play" aria-pressed={playing}>{playing ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}</button>
          <button type="button" onClick={() => go(1)} aria-label="Next track"><SkipForward size={16} aria-hidden="true" /></button>
          <button type="button" onClick={() => setMuted((m) => !m)} aria-pressed={muted} aria-label="Mute">{muted ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}</button>
          <input
            className="range deck-vol" type="range" aria-label="Volume" aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)}%`} min={0} max={1} step={0.05} value={muted ? 0 : volume}
            style={{ "--fill": `${(muted ? 0 : volume) * 100}%` } as React.CSSProperties}
            onChange={(e) => { const v = Number(e.target.value); setVolume(v); setMuted(v === 0); if (audio.current) audio.current.volume = v; }}
          />
        </div>
      </div>
      <div className="deck-seek mono">
        <span>{formatTime(time)}</span>
        <input
          className="range" type="range" aria-label="Seek" aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`} min={0} max={duration || 0} step={1} value={Math.min(time, duration || 0)} disabled={!duration}
          style={{ "--fill": `${pct}%` } as React.CSSProperties}
          onChange={(e) => { const t = Number(e.target.value); if (audio.current) audio.current.currentTime = t; setTime(t); }}
        />
        <span>{formatTime(duration)}</span>
      </div>
      <p role="status" className="deck-status">{failed ? "This track couldn't load. Try the next one." : ""}</p>
      <audio
        ref={audio} src={track.src} preload="metadata" muted={muted}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => { if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration); }}
        onEnded={() => { resume.current = true; go(1); }}
        onError={() => { setFailed(true); setPlaying(false); }}
      />
    </div>
  );
}
