import { refreshSkillTokens } from "./skillsDraw";
import { cssVar } from "@/lib/theme";
import { burst, hit, repel } from "@/lib/bubbles";
import { type Blob, jiggle, makeBlob, shapeFoam, stepFoam } from "@/lib/foam";
import { type Drop, type Ripple, drawBubble, drawChip, drawDrops, drawPull, drawRipples, tintOf } from "./skillsDraw";

type Skill = { name: string; category: string };

const HOLD_MS = 180; // press on empty space longer than this to start pulling
const CHARGE_MS = 1100; // to full pull strength
const DOUBLE_MS = 320; // second press on the same bubble within this pops it
const RESPAWN_MS = 1400;

/**
 * The toolbox bubble field. Soft foam bubbles bloom in when the section first scrolls into view and press together in
 * a cluster. Hover: the cursor parts them, the bubble under it swells and its category lights up while the rest fade
 * back. Drag to move (neighbours get shoved), let go to fling, tap to poke, double-click to pop (it grows back), hold
 * empty space to pull everything into a vortex and let go to blast it apart. `show` morphs to a new tab's set.
 */
export function createSkillField(host: HTMLElement, cv: HTMLCanvasElement, skills: Skill[], big: Set<string>) {
  const ctx = cv.getContext("2d") as CanvasRenderingContext2D;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const names = skills.map((s) => s.name);
  const cats = skills.map((s) => s.category);
  const blobs: Blob[] = skills.map(() => makeBlob(0, 0, 0));
  const fade = skills.map(() => 1); // eased alpha per bubble (focus dims other categories)
  const ripples: Ripple[] = [];
  const drops: Drop[] = [];
  const timers: number[] = [];
  const popped = new Set<number>();
  let shown = new Set(names);
  let started = false;
  let w = 0;
  let h = 0;
  let unit = 1;
  let light = document.documentElement.dataset.theme === "light";
  let visible = false;
  let raf = 0;
  let last = 0;
  let hover = -1;
  let held = -1;
  let chip = 0;
  const ptr = { x: 0, y: 0, in: false, boost: 1, t: 0 };
  const grab = { dx: 0, dy: 0, x: 0, y: 0, t: 0, vx: 0, vy: 0, moved: 0 };
  let press: { x: number; y: number; t: number } | null = null;
  let lastTap = { i: -1, t: 0 };

  const size = () => (names.filter((n) => shown.has(n)).length < 8 ? 1.22 : 1);
  /** Golden-angle spiral slots around the centre, so new bubbles grow in already packed. */
  const slot = (k: number, n: number) => {
    const a = k * 2.399;
    const d = Math.sqrt((k + 0.5) / Math.max(1, n)) * Math.min(w, h) * 0.3;
    return { x: w / 2 + Math.cos(a) * d, y: h / 2 + Math.sin(a) * d };
  };
  const place = (b: Blob, k: number, n: number) => {
    const p = slot(k, n);
    b.x = p.x;
    b.y = p.y;
    b.vx = b.vy = 0;
    b.rim.fill(0);
    b.rimV.fill(0);
  };

  const layout = () => {
    w = host.clientWidth;
    h = host.clientHeight;
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = w * dpr;
    cv.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    unit = Math.min(1.15, Math.max(0.62, Math.min(w, h * 1.4) / 1000));
    blobs.forEach((b, i) => {
      b.base = (big.has(names[i]) ? 60 : 47) * unit;
      b.x = Math.min(w, Math.max(0, b.x));
      b.y = Math.min(h, Math.max(0, b.y));
    });
  };

  /** Set every bubble's target size for the current tab; newcomers grow in from the middle. */
  const apply = (instant: boolean) => {
    const on = blobs.map((_, i) => shown.has(names[i]) && !popped.has(i));
    const n = on.filter(Boolean).length;
    let k = 0;
    blobs.forEach((b, i) => {
      if (on[i] && b.scale === 0) place(b, k++ % Math.max(1, n), n);
      b.target = on[i] ? size() : 0;
      if (instant) { b.scale = b.target; b.sv = 0; }
    });
  };

  /** First reveal: bubbles bloom in one after another from the centre outward. */
  const bloom = () => {
    started = true;
    const ids = blobs.map((_, i) => i).filter((i) => shown.has(names[i]));
    ids.forEach((i, k) => {
      place(blobs[i], k, ids.length);
      timers.push(window.setTimeout(() => { if (shown.has(names[i])) blobs[i].target = size(); }, 150 + k * 60));
    });
  };

  const settleStatic = () => {
    for (let s = 0; s < 500; s++) stepFoam(blobs, 1 / 60, { w, h, held });
    for (let s = 0; s < 300; s++) shapeFoam(blobs, 1 / 60, w, h);
  };

  const ring = (x: number, y: number, from: number, to: number, color = cssVar("--accent-strong"), life = 600) =>
    ripples.push({ x, y, at: performance.now(), from, to, life, color });

  const pop = (i: number) => {
    const b = blobs[i];
    const tint = tintOf(names[i], light);
    for (let k = 0; k < 16; k++) {
      const a = Math.random() * Math.PI * 2;
      const v = 220 + Math.random() * 360;
      drops.push({ x: b.x + Math.cos(a) * b.r * 0.6, y: b.y + Math.sin(a) * b.r * 0.6, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, r: 2 + Math.random() * 3.5, age: 0, life: 0.55 + Math.random() * 0.35, color: tint });
    }
    ring(b.x, b.y, b.r * 0.6, b.r * 2.2, tint, 520);
    burst(blobs, b.x, b.y, 900, b.r * 3.2);
    popped.add(i);
    b.scale = b.sv = b.target = 0;
    b.rim.fill(0);
    timers.push(window.setTimeout(() => {
      popped.delete(i);
      if (!shown.has(names[i])) return;
      const p = slot(Math.floor(Math.random() * 4), 6);
      Object.assign(b, { x: p.x, y: p.y, vx: 0, vy: 0, target: size() });
    }, RESPAWN_MS));
  };

  const draw = (now: number, charge: number, dt: number) => {
    const t = now / 1000;
    ctx.clearRect(0, 0, w, h);
    if (ptr.in) {
      const sp = ctx.createRadialGradient(ptr.x, ptr.y, 0, ptr.x, ptr.y, 240);
      sp.addColorStop(0, light ? "#3b82f61f" : "#3b82f62a");
      sp.addColorStop(1, "#3b82f600");
      ctx.fillStyle = sp;
      ctx.fillRect(0, 0, w, h);
    }
    if (press) drawPull(ctx, press.x, press.y, charge, t);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const focus = held >= 0 ? held : hover;
    const bubble = (i: number) =>
      drawBubble(ctx, blobs[i], { name: names[i], light, lift: blobs[i].swell, alpha: fade[i], related: focus >= 0 && i !== focus && cats[i] === cats[focus], held: i === held, t });
    blobs.forEach((_, i) => { if (i !== focus) bubble(i); });
    if (focus >= 0) bubble(focus);
    drawRipples(ctx, ripples, now);
    drawDrops(ctx, drops, dt);
    if (hover >= 0 && held < 0) drawChip(ctx, blobs[hover], cats[hover].toUpperCase(), chip);
  };

  /** Hover target, swell, focus fade and chip; eased by `k` (1 = jump straight there). */
  const ease = (k: number) => {
    if (ptr.in && held < 0 && !press) hover = hit(blobs, ptr.x, ptr.y);
    else if (!ptr.in && held < 0) hover = -1;
    const focus = held >= 0 ? held : hover;
    blobs.forEach((b, i) => {
      b.swell += ((i === hover && held < 0 ? 1 : i === held ? 0.6 : 0) - b.swell) * k;
      fade[i] += ((focus >= 0 && cats[i] !== cats[focus] ? 0.38 : 1) - fade[i]) * k;
    });
    chip += ((hover >= 0 && held < 0 ? 1 : 0) - chip) * k;
    cv.style.cursor = held >= 0 || press ? "grabbing" : hover >= 0 ? "grab" : "default";
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (!visible) return;
    ease(Math.min(1, dt * 10));
    if (held >= 0) {
      const b = blobs[held];
      b.vx = Math.max(-3000, Math.min(3000, (ptr.x + grab.dx - b.x) * 22));
      b.vy = Math.max(-3000, Math.min(3000, (ptr.y + grab.dy - b.y) * 22));
    }
    if (ptr.in && held < 0 && !press) repel(blobs, ptr.x, ptr.y, dt, ptr.boost, hover, 80, 2600);
    ptr.boost += (1 - ptr.boost) * Math.min(1, dt * 4);
    const charge = press ? Math.min(1, Math.max(0, (now - press.t - HOLD_MS) / CHARGE_MS)) : 0;
    const attract = press && charge > 0 ? { x: press.x, y: press.y, power: 900 + charge * 2600 } : null;
    for (let s = 0; s < 2; s++) {
      stepFoam(blobs, dt / 2, { w, h, held, t: now / 1000, attract });
      shapeFoam(blobs, dt / 2, w, h);
    }
    // At rest only the slow drift (~10 px/s) and film shimmer move, which look the same at half rate; a full redraw of
    // every bubble each frame kept integrated GPUs at 30-40 fps on 1.5-2x screens. Any touch goes back to full rate.
    skip = calm() && !skip;
    if (skip) return;
    draw(now, charge, dt);
  };
  let skip = false;
  /** Nothing touched, growing, flying or popping. */
  const calm = () => !ptr.in && held < 0 && !press && !ripples.length && !drops.length
    && blobs.every((b) => Math.abs(b.sv) < 0.05 && b.vx * b.vx + b.vy * b.vy < 900);

  const capture = (e: PointerEvent) => { try { cv.setPointerCapture(e.pointerId); } catch { /* pointer already released */ } };
  const local = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const redraw = () => { ease(1); draw(performance.now(), 0, 0); };

  const down = (e: PointerEvent) => {
    const p = local(e);
    const now = performance.now();
    Object.assign(ptr, { x: p.x, y: p.y, in: true, t: now });
    const i = hit(blobs, p.x, p.y);
    if (i >= 0) {
      if (!reduced && lastTap.i === i && now - lastTap.t < DOUBLE_MS) { lastTap = { i: -1, t: 0 }; pop(i); return; }
      lastTap = { i, t: now };
      held = i;
      Object.assign(grab, { dx: blobs[i].x - p.x, dy: blobs[i].y - p.y, x: p.x, y: p.y, t: now, vx: 0, vy: 0, moved: 0 });
      capture(e);
      return;
    }
    if (reduced) return;
    press = { x: p.x, y: p.y, t: now };
    capture(e);
  };

  const move = (e: PointerEvent) => {
    const p = local(e);
    const now = performance.now();
    if (ptr.in) ptr.boost = Math.max(ptr.boost, 1 + Math.min(3, (Math.hypot(p.x - ptr.x, p.y - ptr.y) / Math.max(1, now - ptr.t)) * 1.2));
    Object.assign(ptr, { x: p.x, y: p.y, in: true, t: now });
    if (press) { press.x = p.x; press.y = p.y; }
    if (held >= 0) {
      const dt = Math.max(1, now - grab.t) / 1000;
      grab.vx = (p.x - grab.x) / dt;
      grab.vy = (p.y - grab.y) / dt;
      grab.moved += Math.hypot(p.x - grab.x, p.y - grab.y);
      Object.assign(grab, { x: p.x, y: p.y, t: now });
      if (reduced) {
        Object.assign(blobs[held], { x: p.x + grab.dx, y: p.y + grab.dy });
        for (let s = 0; s < 30; s++) stepFoam(blobs, 1 / 60, { w, h, held });
        for (let s = 0; s < 60; s++) shapeFoam(blobs, 1 / 60, w, h);
      }
    }
    if (reduced) redraw();
  };

  const up = () => {
    const now = performance.now();
    if (held >= 0) {
      const b = blobs[held];
      if (grab.moved < 6) {
        if (!reduced) { burst(blobs, b.x, b.y + 1, 650); jiggle(b, 320); ring(b.x, b.y, b.r, b.r * 1.7); }
      } else {
        b.vx = Math.max(-2600, Math.min(2600, grab.vx));
        b.vy = Math.max(-2600, Math.min(2600, grab.vy));
        jiggle(b, 200, Math.atan2(b.vy, b.vx));
      }
      held = -1;
    } else if (press) {
      const dur = now - press.t;
      if (dur < HOLD_MS) {
        burst(blobs, press.x, press.y, 500);
        ring(press.x, press.y, 8, 120);
      } else {
        const charge = Math.min(1, (dur - HOLD_MS) / CHARGE_MS);
        burst(blobs, press.x, press.y, 800 + charge * 2600, 220 + charge * 220);
        for (const b of blobs) if (Math.hypot(b.x - press.x, b.y - press.y) < 260) jiggle(b, 150 + charge * 250);
        ring(press.x, press.y, 20, 180 + charge * 260, cssVar("--accent-strong"), 800);
      }
      press = null;
    }
    if (reduced) redraw();
  };

  const leave = () => { if (held < 0 && !press) { ptr.in = false; if (reduced) redraw(); } };

  cv.addEventListener("pointerdown", down);
  cv.addEventListener("pointermove", move);
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);
  cv.addEventListener("pointerleave", leave);

  layout();
  const ro = new ResizeObserver(() => {
    if (host.clientWidth === w && host.clientHeight === h) return;
    layout();
    if (reduced) { settleStatic(); redraw(); }
  });
  ro.observe(host);
  const mo = new MutationObserver(() => { light = document.documentElement.dataset.theme === "light"; refreshSkillTokens(); if (reduced) redraw(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !started && !reduced) bloom();
  });
  io.observe(host);

  if (reduced) {
    started = true;
    apply(true);
    settleStatic();
    redraw();
  } else {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  return {
    /** Morph to a new set of skills (a tab change). */
    show(next: Set<string>) {
      shown = next;
      if (!started) return;
      apply(reduced);
      if (reduced) { settleStatic(); redraw(); }
    },
    dispose() {
      cancelAnimationFrame(raf);
      timers.forEach(window.clearTimeout);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      cv.removeEventListener("pointerdown", down);
      cv.removeEventListener("pointermove", move);
      cv.removeEventListener("pointerup", up);
      cv.removeEventListener("pointercancel", up);
      cv.removeEventListener("pointerleave", leave);
    },
  };
}
