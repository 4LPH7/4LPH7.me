"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { canUse3D } from "@/lib/gpu";
import type { ReactorInput } from "./ArcReactorScene";

const ArcReactorScene = dynamic(() => import("./ArcReactorScene"), { ssr: false });

/**
 * Tony Stark's arc reactor floating under a warm spot from above, the core glowing blue. It bobs and sways
 * slowly; drag to turn it, click (or Enter/Space) for a power surge. Three.js and the model load only when the card is
 * near the viewport. Devices that can't run 3D (or prefer reduced motion) get a static glowing reactor drawn in CSS.
 */
export function ArcReactor() {
  const box = useRef<HTMLButtonElement>(null);
  const input = useRef<ReactorInput>({ x: 0, y: 0, hover: false, yaw: 0, dragging: false, surgeAt: 0 });
  const drag = useRef<{ sx: number; x: number } | null>(null);
  const dragged = useRef(false); // the last press was a drag, so its click shouldn't surge
  const [mode, setMode] = useState<"pending" | "3d" | "static">("pending");
  const [active, setActive] = useState(false);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const gl = document.createElement("canvas");
    setMode(canUse3D({
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      webgl: Boolean(gl.getContext("webgl2") ?? gl.getContext("webgl")),
      cores: nav.hardwareConcurrency,
      memory: nav.deviceMemory,
      saveData: Boolean(nav.connection?.saveData),
    }) ? "3d" : "static");
  }, []);

  useEffect(() => {
    const el = box.current;
    if (mode !== "3d" || !el) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    const soon = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); soon.disconnect(); } }, { rootMargin: "600px" });
    soon.observe(el);
    // Also mount once the page is idle after load, so the model parse and shader compile don't stall the scroll.
    const idle = window.setTimeout(() => (window.requestIdleCallback ?? ((f: () => void) => f()))(() => setNear(true)), 1500);
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      input.current.x = Math.max(-1.5, Math.min(1.5, ((e.clientX - r.left) / r.width) * 2 - 1));
      input.current.y = Math.max(-1.5, Math.min(1.5, -(((e.clientY - r.top) / r.height) * 2 - 1)));
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => { io.disconnect(); soon.disconnect(); window.clearTimeout(idle); window.removeEventListener("pointermove", move); };
  }, [mode]);

  // Drag to turn: past a few pixels a press becomes a drag (no surge). Letting go leaves it where you turned it.
  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button > 0) return;
    drag.current = { sx: e.clientX, x: e.clientX };
    dragged.current = false;
  };
  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!input.current.dragging) {
      if (Math.abs(e.clientX - d.sx) < 6) return;
      input.current.dragging = true;
      dragged.current = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    }
    input.current.yaw += (e.clientX - d.x) * 0.01;
    d.x = e.clientX;
  };
  const onEnd = () => {
    drag.current = null;
    input.current.dragging = false;
  };

  return (
    <>
      <button
        ref={box}
        type="button"
        className={mode === "static" ? "reactor reactor-static" : "reactor"}
        aria-label="Power surge: Tony Stark's arc reactor, floating under a spotlight (drag to turn it)"
        onPointerEnter={() => { input.current.hover = true; }}
        onPointerLeave={() => { input.current.hover = false; }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onEnd}
        onPointerCancel={onEnd}
        onClick={() => {
          if (dragged.current) { dragged.current = false; return; }
          input.current.surgeAt = performance.now() / 1000;
          box.current?.setAttribute("data-surge", "true");
          window.setTimeout(() => box.current?.removeAttribute("data-surge"), 900);
        }}
      >
        {mode === "3d" && near ? <ArcReactorScene input={input} active={active} /> : null}
        {mode === "static" ? <span className="reactor-css" aria-hidden="true"><i /><i /><i /></span> : null}
        <span className="eyebrow reactor-hint" aria-hidden="true">
          <span className="hint-fine">DRAG TO TURN · CLICK TO POWER UP</span>
          <span className="hint-touch">DRAG TO TURN · TAP TO POWER UP</span>
        </span>
      </button>
      <p className="reactor-credit">
        &ldquo;ARC reactor Ironman&rdquo; model by <a href="https://sketchfab.com/3d-models/arc-reactor-ironman-5d76971f8d02474786239b18e0a40a69" target="_blank" rel="noreferrer">fran.senes</a>
        {" · "}<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>
      </p>
    </>
  );
}
