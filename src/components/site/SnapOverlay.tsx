"use client";

import { useEffect, useRef, useState } from "react";
import { SNAP_EVENT, type SnapDetail, STONE_VAR, STONES } from "@/lib/snap";
import { cssVar } from "@/lib/theme";

/** Seconds the overlay runs (full effect), and the gentle reduced-motion version. */
const DURATION = 2.6;
const GENTLE = 1.2;
const BOLT_LIFE = 1.4;
const FLASH_LIFE = 0.45;
const EMBERS = 140;

type Pt = { x: number; y: number };
type Ember = { x: number; y: number; vx: number; vy: number; r: number; color: string };

/** Branching lightning from `a` to `b` (midpoint displacement); each point list is drawn as one stroke. */
function bolt(a: Pt, b: Pt, spread: number, depth: number, out: Pt[][]) {
  const pts: Pt[] = [a];
  const go = (p: Pt, q: Pt, s: number, d: number) => {
    if (d === 0) { pts.push(q); return; }
    const m = { x: (p.x + q.x) / 2 + (Math.random() - 0.5) * s, y: (p.y + q.y) / 2 + (Math.random() - 0.5) * s };
    go(p, m, s / 2, d - 1);
    go(m, q, s / 2, d - 1);
  };
  go(a, b, spread, depth);
  out.push(pts);
  // a couple of side branches off the main bolt
  if (depth > 3) for (let i = 0; i < 2; i++) {
    const from = pts[Math.floor(pts.length * (0.25 + Math.random() * 0.5))];
    const ang = Math.atan2(b.y - a.y, b.x - a.x) + (Math.random() - 0.5) * 1.6;
    const len = Math.hypot(b.x - a.x, b.y - a.y) * (0.2 + Math.random() * 0.25);
    bolt(from, { x: from.x + Math.cos(ang) * len, y: from.y + Math.sin(ang) * len }, spread / 3, depth - 3, out);
  }
}

/**
 * The page-wide half of the snap: when IronMan fires SNAP_EVENT, a full-screen canvas (click-through) draws one white
 * flash, lightning in the six stone colours forking from the card to the edges of the screen, a burst of embers and a
 * stone-coloured edge glow, while the page content shakes. Reduced motion: only a soft glow, no flash, bolts or shake.
 */
export function SnapOverlay() {
  const [run, setRun] = useState<(SnapDetail & { id: number }) | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const on = (e: Event) => setRun({ ...(e as CustomEvent<SnapDetail>).detail, id: performance.now() });
    window.addEventListener(SNAP_EVENT, on);
    return () => window.removeEventListener(SNAP_EVENT, on);
  }, []);

  useEffect(() => {
    const el = canvas.current;
    if (!run || !el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    el.width = w * dpr;
    el.height = h * dpr;
    ctx.scale(dpr, dpr);
    const colors = STONES.map((s) => cssVar(STONE_VAR[s]));
    const paper = cssVar("--paper");
    const ember = cssVar("--ember");
    const origin = { x: run.x, y: run.y };
    const reach = Math.hypot(w, h);
    // six main bolts, one per stone, fanned evenly around the snap
    const aims = colors.map((_, i) => (i / colors.length) * Math.PI * 2 + Math.random() * 0.6);
    const embers: Ember[] = Array.from({ length: reduced ? 0 : EMBERS }, () => {
      const a = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * 260;
      return { x: origin.x, y: origin.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, r: 1 + Math.random() * 2.2, color: Math.random() < 0.6 ? ember : colors[Math.floor(Math.random() * colors.length)] };
    });
    const root = document.documentElement;
    if (!reduced) root.classList.add("is-snapping");
    const length = reduced ? GENTLE : DURATION;
    const start = performance.now();
    let last = start;
    let paths: { color: string; pts: Pt[][] }[] = [];
    let frame = 0;
    let raf = 0;

    const draw = (time: number) => {
      const t = (time - start) / 1000;
      const dt = Math.min(0.05, (time - last) / 1000);
      last = time;
      ctx.clearRect(0, 0, w, h);
      const fade = Math.max(0, 1 - t / length);

      // edge glow, cycling through the stone colours
      const glow = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, reach * 0.6);
      glow.addColorStop(0, "transparent");
      glow.addColorStop(1, colors[Math.floor(t * 6) % colors.length]);
      ctx.globalAlpha = (reduced ? 0.22 : 0.3) * fade;
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      if (!reduced) {
        // one flash, from the snap outward
        if (t < FLASH_LIFE) {
          const f = ctx.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, reach);
          f.addColorStop(0, paper);
          f.addColorStop(1, "transparent");
          ctx.globalAlpha = 0.7 * (1 - t / FLASH_LIFE);
          ctx.fillStyle = f;
          ctx.fillRect(0, 0, w, h);
        }
        // lightning: re-forked every few frames so it crackles, fading out over BOLT_LIFE
        if (t < BOLT_LIFE) {
          if (frame % 3 === 0) {
            paths = aims.map((a, i) => {
              const out: Pt[][] = [];
              const len = reach * (0.5 + Math.random() * 0.4);
              bolt(origin, { x: origin.x + Math.cos(a) * len, y: origin.y + Math.sin(a) * len }, len * 0.35, 7, out);
              return { color: colors[i], pts: out };
            });
          }
          const life = 1 - t / BOLT_LIFE;
          ctx.globalCompositeOperation = "lighter";
          for (const p of paths) {
            for (const [lineW, alpha, color, blur] of [[5, 0.55, p.color, 22], [1.4, 0.95, paper, 0]] as const) {
              ctx.globalAlpha = alpha * life * (0.7 + Math.random() * 0.3);
              ctx.strokeStyle = color;
              ctx.lineWidth = lineW;
              ctx.shadowColor = p.color;
              ctx.shadowBlur = blur;
              ctx.beginPath();
              for (const seg of p.pts) {
                ctx.moveTo(seg[0].x, seg[0].y);
                for (const q of seg) ctx.lineTo(q.x, q.y);
              }
              ctx.stroke();
            }
          }
          ctx.shadowBlur = 0;
          ctx.globalCompositeOperation = "source-over";
        }
        // embers fly out and drift up
        for (const e of embers) {
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          e.vx *= 0.985;
          e.vy = e.vy * 0.985 - 30 * dt;
          ctx.globalAlpha = fade;
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      frame++;
      if (t < length) raf = requestAnimationFrame(draw);
      else setRun(null);
    };
    raf = requestAnimationFrame(draw);
    const unshake = window.setTimeout(() => root.classList.remove("is-snapping"), 700);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(unshake);
      root.classList.remove("is-snapping");
    };
  }, [run]);

  if (!run) return null;
  return <canvas key={run.id} ref={canvas} className="snap-overlay" />;
}
