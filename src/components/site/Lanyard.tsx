"use client";
import { themeColor } from "@/lib/theme";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { site } from "@/data/site";
import { canUse3D } from "@/lib/gpu";

// React Bits Lanyard (plain three.js). Loaded on demand so three stays out of the first bundle.
const ReactBitsLanyard = dynamic(() => import("@/components/reactbits/Lanyard/Lanyard"), { ssr: false });

type Mode = "pending" | "3d" | "static";

function detect(): Mode {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const gl = document.createElement("canvas");
  const webgl = Boolean(gl.getContext("webgl2") ?? gl.getContext("webgl"));
  return canUse3D({
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    webgl,
    cores: nav.hardwareConcurrency,
    memory: nav.deviceMemory,
    saveData: Boolean(nav.connection?.saveData),
  }) ? "3d" : "static";
}

export function Lanyard() {
  const box = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<Mode>("pending");
  const [near, setNear] = useState(false); // load three only once the section scrolls close
  const [narrow, setNarrow] = useState(false); // read once on mount; card size doesn't follow later resizes

  useEffect(() => {
    setMode(detect());
    setNarrow(matchMedia("(max-width: 767px)").matches);
  }, []);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      setNear(true);
      io.disconnect();
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={box} className="lan" aria-label="Draggable ID card">
      {narrow ? null : mode === "3d" && near ? (
        // The component pauses itself off-screen and honours reduced motion; it fills this box.
        <ReactBitsLanyard
          frontImage="/lanyard/card-front.svg"
          backImage="/lanyard/card-back.svg"
          strapImage="/lanyard/band.svg"
          cardColor={themeColor("--scene-card")}
          strapColor={themeColor("--scene-strap")}
          finish="glossy"
          metal="silver"
          // Canvas covers the whole hero, so size is the card's share of hero height.
          anchor="left"
          size={0.43}
          strapLength={0.7}
        />
      ) : mode === "static" ? (
        <div className="lan-static">
          <p className="lan-name">{site.name.toUpperCase()}</p>
          <p className="lan-handle">@{site.handle}</p>
          <p>Full-stack developer · {site.location}</p>
        </div>
      ) : null /* pending or waiting to scroll near: render nothing so the fallback text doesn't flash on reload */}
    </section>
  );
}
