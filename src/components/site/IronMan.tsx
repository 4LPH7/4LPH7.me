"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { canUse3D } from "@/lib/gpu";
import { CHARGE, dispatchSnap, STONE_VAR, STONES, STORM } from "@/lib/snap";
import type { SnapInput } from "./IronManScene";

const IronManScene = dynamic(() => import("./IronManScene"), { ssr: false });


/**
 * Iron Man (Mark 85) on a burning battlefield, the six stones glowing in the gauntlet. Clicking (or Enter/Space)
 * charges the stones, then snaps: lightning in the stone colours over the suit and, through SnapOverlay, across the
 * whole page. Three.js and the model load only when the card is near the viewport. Devices that can't run 3D (or prefer
 * reduced motion) get a static gauntlet that still snaps the page (gently, for reduced motion).
 */
export function IronMan() {
  const box = useRef<HTMLButtonElement>(null);
  const input = useRef<SnapInput>({ x: 0, y: 0, hover: false, snapAt: 0 });
  const timer = useRef(0);
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
    return () => window.clearTimeout(timer.current);
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

  const snap = () => {
    const now = performance.now() / 1000;
    if (input.current.snapAt > 0 && now - input.current.snapAt < CHARGE + STORM) return; // one snap at a time
    input.current.snapAt = now;
    const fire = () => {
      const r = box.current?.getBoundingClientRect();
      dispatchSnap(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth / 2, y: innerHeight / 2 });
    };
    window.clearTimeout(timer.current);
    if (mode === "3d") timer.current = window.setTimeout(fire, CHARGE * 1000);
    else fire();
  };

  return (
    <>
      <button
        ref={box}
        type="button"
        className={mode === "static" ? "ironman ironman-static" : "ironman"}
        aria-label="Snap the gauntlet: lightning in the six stone colours across the page"
        onPointerEnter={() => { input.current.hover = true; }}
        onPointerLeave={() => { input.current.hover = false; }}
        onClick={snap}
      >
        {mode === "3d" && near ? <IronManScene input={input} active={active} /> : null}
        {mode === "static" ? (
          <span className="gauntlet" aria-hidden="true">
            {STONES.map((s) => <i key={s} style={{ "--stone": `var(${STONE_VAR[s]})` } as React.CSSProperties} />)}
          </span>
        ) : null}
        <span className="eyebrow ironman-hint" aria-hidden="true">
          <span className="hint-fine">CLICK TO SNAP</span>
          <span className="hint-touch">TAP TO SNAP</span>
        </span>
      </button>
      <p className="ironman-credit">
        &ldquo;Iron Man Mark 85&rdquo; model by <a href="https://sketchfab.com/3d-models/iron-man-mark-85-8da781aa74024366844b36444c650d69" target="_blank" rel="noreferrer">LLIypuk</a>
        {" · "}<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>
      </p>
    </>
  );
}
