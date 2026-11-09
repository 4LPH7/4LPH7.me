"use client";

import { useEffect, useRef } from "react";
import { SOUTH_INDIA, WORLD } from "@/data/worldMap";
import { MONO } from "@/app/fonts";
import { HOME, kind, land } from "@/lib/geo";

const LAT_TOP = WORLD.lat0;
const LAT_SPAN = WORLD.rows * WORLD.step;
const LENS = { lon: 78.3, lat: 10.7, span: 12, zoomSpan: 6.5 }; // lens window (degrees) at rest and when hovered
const REVEAL_MS = 1900;

const ease = (u: number) => 1 - (1 - Math.min(1, Math.max(0, u))) ** 3;
const back = (u: number) => { const x = Math.min(1, Math.max(0, u)); const c = 1.7; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
const span = (p: number, a: number, b: number) => (p - a) / (b - a);
/** Scatter cells into three twinkle groups without visible stripes. */
const twinkle = (c: number, r: number) => Math.floor((((Math.sin(c * 12.9898 + r * 78.233) * 43758.5453) % 1) + 1) % 1 * 3);

/**
 * Location card art: a dotted world map with a pin on Coimbatore, and a magnifier lens below (or beside, on wide
 * cards) showing South India with Tamil Nadu lit up. It draws itself in on first view; hover (or tap) zooms the lens
 * closer, and the lens follows the pointer a little. Static under reduced motion.
 */
export function LocationMap() {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = wrap.current;
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!host || !cv || !ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lensCv = document.createElement("canvas");
    const lx = lensCv.getContext("2d") as CanvasRenderingContext2D;
    const worldCv = document.createElement("canvas");
    const wx = worldCv.getContext("2d") as CanvasRenderingContext2D;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let light = false;
    let accent = "#3b82f6";
    let dim = "#a1a1aa";
    const map = { x: 0, y: 0, w: 0, h: 0 };
    const lens = { cx: 0, cy: 0, r: 0 };
    const view = { zoom: 0, zoomTo: 0, ox: 0, oy: 0, oxTo: 0, oyTo: 0 };
    let revealAt = reduced ? -1e9 : 0; // 0 = not revealed yet
    let visible = false;
    let raf = 0;

    const toMap = (lon: number, lat: number) => ({ x: map.x + ((lon + 180) / 360) * map.w, y: map.y + ((LAT_TOP - lat) / LAT_SPAN) * map.h });

    const theme = () => {
      light = document.documentElement.dataset.theme === "light";
      const cs = getComputedStyle(document.documentElement);
      accent = cs.getPropertyValue("--accent").trim() || "#3b82f6";
      dim = cs.getPropertyValue("--ink-dim").trim() || dim;
    };

    /** The world's dots never change for a given size and theme, so they are drawn once into a cache. */
    const paintWorld = () => {
      worldCv.width = Math.ceil(w * dpr);
      worldCv.height = Math.ceil(h * dpr);
      wx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const step = Math.max(1, Math.min(6, Math.round(360 / (map.w / 3.4))));
      const gap = (map.w / 360) * step;
      wx.fillStyle = light ? "#b8c4d6" : "#4b4b55";
      wx.beginPath();
      for (let r = 0; r + step <= WORLD.rows; r += step)
        for (let c = 0; c + step <= WORLD.cols; c += step) {
          if (!land(WORLD, c + (step >> 1), r + (step >> 1))) continue;
          const x = map.x + (c + step / 2) * (map.w / 360);
          const y = map.y + (r + step / 2) * (map.h / LAT_SPAN);
          wx.moveTo(x + gap * 0.34, y);
          wx.arc(x, y, gap * 0.34, 0, Math.PI * 2);
        }
      wx.fill();
    };

    const layout = () => {
      w = host.clientWidth;
      h = host.clientHeight;
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.ceil(w * dpr);
      cv.height = Math.ceil(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const pad = Math.max(16, Math.min(28, w * 0.05));
      const ratio = LAT_SPAN / 360;
      if (w > h * 1.25) {
        // wide card: map on the left, lens on the right
        lens.r = Math.min(h * 0.4, w * 0.19);
        map.w = w - pad * 3 - lens.r * 2;
        map.h = map.w * ratio;
        if (map.h > h - pad * 2) { map.h = h - pad * 2; map.w = map.h / ratio; }
        map.x = pad;
        map.y = (h - map.h) / 2 - 8;
        lens.cx = w - pad - lens.r;
        lens.cy = h / 2 - 12;
      } else {
        map.w = w - pad * 2;
        map.h = map.w * ratio;
        map.x = pad;
        map.y = 6;
        const room = h - (map.y + map.h) - 44;
        lens.r = Math.max(48, Math.min(map.w * 0.4, room / 2 - 8));
        lens.cx = w / 2;
        lens.cy = map.y + map.h + 14 + room / 2;
      }
      lensCv.width = Math.ceil(lens.r * 2 * dpr);
      lensCv.height = Math.ceil(lens.r * 2 * dpr);
      lx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintWorld();
    };

    const pulse = (g: CanvasRenderingContext2D, x: number, y: number, t: number, size: number) => {
      for (let k = 0; k < 2; k++) {
        const u = (t * 0.7 + k * 0.5) % 1;
        g.beginPath();
        g.arc(x, y, size * (1 + u * 3.2), 0, Math.PI * 2);
        g.strokeStyle = `rgba(96,165,250,${(1 - u) * 0.7})`;
        g.lineWidth = 1.5;
        g.stroke();
      }
      const glow = g.createRadialGradient(x, y, 0, x, y, size * 3);
      glow.addColorStop(0, "rgba(59,130,246,0.55)");
      glow.addColorStop(1, "rgba(59,130,246,0)");
      g.fillStyle = glow;
      g.fillRect(x - size * 3, y - size * 3, size * 6, size * 6);
      g.beginPath();
      g.arc(x, y, size, 0, Math.PI * 2);
      g.fillStyle = accent;
      g.fill();
      g.beginPath();
      g.arc(x, y, size * 0.38, 0, Math.PI * 2);
      g.fillStyle = "#fff";
      g.fill();
    };

    /** The lens: South India dots (Tamil Nadu twinkling in blue), a graticule, a slow radar sweep and the pin. */
    const paintLens = (t: number, grow: number) => {
      const r = lens.r;
      lx.clearRect(0, 0, r * 2, r * 2);
      const S = (LENS.span + (LENS.zoomSpan - LENS.span) * view.zoom) * (1 + (1 - grow) * 0.9);
      const lonC = LENS.lon + (HOME.lon - LENS.lon) * view.zoom * 0.7 + view.ox;
      const latC = LENS.lat + (HOME.lat - LENS.lat) * view.zoom * 0.7 + view.oy;
      const k = (r * 2) / S; // px per degree
      const at = (lon: number, lat: number) => ({ x: r + (lon - lonC) * k, y: r - (lat - latC) * k });
      lx.strokeStyle = light ? "rgba(11,18,32,0.07)" : "rgba(255,255,255,0.06)";
      lx.lineWidth = 1;
      for (let g = Math.ceil((lonC - S) / 2) * 2; g <= lonC + S; g += 2) { const p = at(g, 0); lx.beginPath(); lx.moveTo(p.x, 0); lx.lineTo(p.x, r * 2); lx.stroke(); }
      for (let g = Math.ceil((latC - S) / 2) * 2; g <= latC + S; g += 2) { const p = at(0, g); lx.beginPath(); lx.moveTo(0, p.y); lx.lineTo(r * 2, p.y); lx.stroke(); }
      const sp = SOUTH_INDIA.step * k;
      const groups: [number, number][][] = [[], [], []];
      lx.fillStyle = light ? "#a8b6cc" : "#62626e";
      lx.beginPath();
      for (let row = 0; row < SOUTH_INDIA.rows; row++)
        for (let c = 0; c < SOUTH_INDIA.cols; c++) {
          const v = kind(SOUTH_INDIA, c, row);
          if (!v) continue;
          const p = at(SOUTH_INDIA.lon0 + (c + 0.5) * SOUTH_INDIA.step, SOUTH_INDIA.lat0 - (row + 0.5) * SOUTH_INDIA.step);
          if (Math.hypot(p.x - r, p.y - r) > r - 2) continue;
          if (v === 2) { groups[twinkle(c, row)].push([p.x, p.y]); continue; }
          lx.moveTo(p.x + sp * 0.3, p.y);
          lx.arc(p.x, p.y, sp * 0.3, 0, Math.PI * 2);
        }
      lx.fill();
      groups.forEach((list, g) => {
        lx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 2.2 + g * 2.1);
        lx.fillStyle = accent;
        lx.beginPath();
        for (const [x, y] of list) { lx.moveTo(x + sp * 0.36, y); lx.arc(x, y, sp * 0.36, 0, Math.PI * 2); }
        lx.fill();
      });
      lx.globalAlpha = 1;
      const tn = at(79.05, 9.75);
      lx.font = `600 ${Math.max(8, r * 0.07)}px ${MONO}`;
      lx.textAlign = "center";
      lx.fillStyle = light ? "rgba(30,64,175,0.85)" : "rgba(191,219,254,0.85)";
      lx.fillText("TAMIL NADU", tn.x, tn.y);
      if (!reduced && "createConicGradient" in lx) {
        const sweep = lx.createConicGradient(t * 0.9, r, r);
        sweep.addColorStop(0, "rgba(96,165,250,0.22)");
        sweep.addColorStop(0.14, "rgba(96,165,250,0)");
        sweep.addColorStop(1, "rgba(96,165,250,0)");
        lx.fillStyle = sweep;
        lx.fillRect(0, 0, r * 2, r * 2);
      }
      const home = at(HOME.lon, HOME.lat);
      pulse(lx, home.x, home.y, t, Math.max(3.5, r * 0.035));
      // fade the edge to nothing
      lx.globalCompositeOperation = "destination-out";
      const fade = lx.createRadialGradient(r, r, r * 0.72, r, r, r);
      fade.addColorStop(0, "rgba(0,0,0,0)");
      fade.addColorStop(1, "rgba(0,0,0,1)");
      lx.fillStyle = fade;
      lx.fillRect(0, 0, r * 2, r * 2);
      lx.globalCompositeOperation = "source-over";
      return home;
    };

    const draw = (now: number) => {
      const t = now / 1000;
      const p = revealAt ? (now - revealAt) / REVEAL_MS : 0;
      ctx.clearRect(0, 0, w, h);

      // 1. the world, wiping in from the left
      const wipe = ease(span(p, 0, 0.45));
      if (wipe > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, map.x + map.w * wipe + 4, h);
        ctx.clip();
        ctx.drawImage(worldCv, 0, 0, w, h);
        ctx.restore();
      }
      const pin = toMap(HOME.lon, HOME.lat);
      const pop = back(span(p, 0.32, 0.55));
      const grow = back(span(p, 0.58, 1));

      // 2. the magnifier beam from the pin to the lens
      const beam = ease(span(p, 0.45, 0.78));
      if (beam > 0) {
        const dx = pin.x - lens.cx;
        const dy = pin.y - lens.cy;
        const d = Math.hypot(dx, dy);
        const rr = lens.r * Math.max(0.01, grow);
        if (d > rr) {
          const phi = Math.atan2(dy, dx);
          const th = Math.acos(rr / d);
          const ends = [phi - th, phi + th].map((a) => ({ x: lens.cx + Math.cos(a) * rr, y: lens.cy + Math.sin(a) * rr }));
          const lerp = (e: { x: number; y: number }) => ({ x: pin.x + (e.x - pin.x) * beam, y: pin.y + (e.y - pin.y) * beam });
          const [a, b] = ends.map(lerp);
          const g = ctx.createLinearGradient(pin.x, pin.y, lens.cx, lens.cy);
          g.addColorStop(0, "rgba(96,165,250,0.6)");
          g.addColorStop(1, "rgba(96,165,250,0.08)");
          ctx.beginPath();
          ctx.moveTo(pin.x, pin.y);
          ctx.lineTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.closePath();
          ctx.fillStyle = "rgba(59,130,246,0.05)";
          ctx.fill();
          ctx.setLineDash([3, 4]);
          ctx.lineDashOffset = -t * 12;
          ctx.strokeStyle = g;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(pin.x, pin.y);
          ctx.lineTo(a.x, a.y);
          ctx.moveTo(pin.x, pin.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // 3. the pin on the world
      if (pop > 0) {
        ctx.save();
        ctx.translate(pin.x, pin.y);
        ctx.scale(pop, pop);
        pulse(ctx, 0, 0, t, Math.max(2.6, map.w * 0.009));
        ctx.restore();
      }

      // 4. the lens, its ring, the place label and the coordinates
      if (grow > 0.01) {
        const r = lens.r * grow;
        const home = paintLens(t, grow);
        ctx.save();
        ctx.globalAlpha = Math.min(1, grow);
        ctx.drawImage(lensCv, lens.cx - r, lens.cy - r, r * 2, r * 2);
        ctx.beginPath();
        ctx.arc(lens.cx, lens.cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = light ? "rgba(11,18,32,0.14)" : "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(lens.cx, lens.cy, r + 5, -Math.PI * 0.85 + t * 0.15, -Math.PI * 0.35 + t * 0.15);
        ctx.strokeStyle = "rgba(96,165,250,0.45)";
        ctx.lineWidth = 2;
        ctx.stroke();
        // label chip next to the pin
        const hx = lens.cx - r + (home.x / lens.r) * r;
        const hy = lens.cy - r + (home.y / lens.r) * r;
        ctx.font = "600 11px Supreme, system-ui, sans-serif";
        const text = HOME.name;
        const tw = ctx.measureText(text).width + 18;
        const cx = Math.min(lens.cx + r - tw / 2, hx + 16 + tw / 2);
        const cy = hy - 22;
        ctx.strokeStyle = "rgba(96,165,250,0.6)";
        ctx.beginPath();
        ctx.moveTo(hx + 4, hy - 4);
        ctx.lineTo(cx - tw / 2 + 4, cy + 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.roundRect(cx - tw / 2, cy - 10, tw, 20, 10);
        ctx.fillStyle = light ? "#0b1220" : "#f4f4f5";
        ctx.fill();
        ctx.fillStyle = light ? "#f4f4f5" : "#09090b";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, cx, cy + 0.5);
        ctx.font = `500 10px ${MONO}`;
        ctx.fillStyle = dim;
        ctx.fillText(`${HOME.lat.toFixed(4)}° N  ·  ${HOME.lon.toFixed(4)}° E`, lens.cx, lens.cy + r + 22);
        ctx.restore();
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      if (!revealAt) revealAt = now;
      const k = 0.08;
      view.zoom += (view.zoomTo - view.zoom) * k;
      view.ox += (view.oxTo - view.ox) * k;
      view.oy += (view.oyTo - view.oy) * k;
      draw(now);
    };

    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      const x = (e.clientX - r.left - lens.cx) / lens.r;
      const y = (e.clientY - r.top - lens.cy) / lens.r;
      view.oxTo = Math.max(-1, Math.min(1, x)) * 0.7;
      view.oyTo = -Math.max(-1, Math.min(1, y)) * 0.7;
    };
    const onEnter = (e: PointerEvent) => { if (e.pointerType === "mouse") view.zoomTo = 1; };
    const onLeave = (e: PointerEvent) => { if (e.pointerType === "mouse") { view.zoomTo = 0; view.oxTo = view.oyTo = 0; } };
    const onTap = (e: PointerEvent) => { if (e.pointerType !== "mouse") view.zoomTo = view.zoomTo ? 0 : 1; };

    theme();
    layout();
    const ro = new ResizeObserver(() => { if (host.clientWidth !== w || host.clientHeight !== h) { layout(); if (reduced) draw(0); } });
    ro.observe(host);
    const mo = new MutationObserver(() => { theme(); paintWorld(); if (reduced) draw(0); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    io.observe(host);
    if (reduced) draw(0);
    else {
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerenter", onEnter);
      host.addEventListener("pointerleave", onLeave);
      host.addEventListener("pointerup", onTap);
      raf = requestAnimationFrame(frame);
    }
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerenter", onEnter);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointerup", onTap);
    };
  }, []);

  return (
    <div ref={wrap} className="loc-map" aria-hidden="true">
      <canvas ref={canvas} />
    </div>
  );
}
