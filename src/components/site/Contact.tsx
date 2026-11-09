"use client";

import { ArrowUpRight, Mail, MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ContactForm } from "@/components/ContactForm";
import { site } from "@/data/site";
import { canUse3D } from "@/lib/gpu";
import { SectionHeading } from "./SectionHeading";

const BlobScene = dynamic(() => import("./BlobScene"), { ssr: false });

/** Contact copy and form beside a glowing orb whose blob reacts to the cursor (static orb when 3D is off). */
export function Contact() {
  const orb = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0, on: false });
  const [three, setThree] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const gl = document.createElement("canvas");
    const ok = canUse3D({
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      webgl: Boolean(gl.getContext("webgl2") ?? gl.getContext("webgl")),
      cores: nav.hardwareConcurrency,
      memory: nav.deviceMemory,
      saveData: false,
    });
    // Build the orb once the page is idle: its dense sphere and shaders otherwise land in the middle of the hero intro.
    const idle = window.setTimeout(() => (window.requestIdleCallback ?? ((f: () => void) => f()))(() => setThree(ok)), 3000);
    const el = orb.current;
    if (!el) return () => window.clearTimeout(idle);
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    const section = el.closest("section");
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.current = {
        x: Math.max(-1.5, Math.min(1.5, ((e.clientX - r.left) / r.width) * 2 - 1)),
        y: Math.max(-1.5, Math.min(1.5, -(((e.clientY - r.top) / r.height) * 2 - 1))),
        on: true,
      };
    };
    const leave = () => { pointer.current.on = false; };
    section?.addEventListener("pointermove", move);
    section?.addEventListener("pointerleave", leave);
    return () => { window.clearTimeout(idle); io.disconnect(); section?.removeEventListener("pointermove", move); section?.removeEventListener("pointerleave", leave); };
  }, []);

  return (
    <section id="contact" className="contact" aria-labelledby="contact-title">
      <div className="contact-copy">
        <SectionHeading num="06" heading={site.headings.contact} id="contact-title" />
        <p className="lede" data-reveal>Have an idea, a role or a problem that needs software? Send a note and I&apos;ll reply within a couple of days.</p>
        <p className="contact-links" data-reveal>
          <a href={`mailto:${site.email}`}><Mail size={16} aria-hidden="true" /> {site.email} <ArrowUpRight size={14} aria-hidden="true" /></a>
          <span><MapPin size={16} aria-hidden="true" /> {site.location.replace("IN", "India")}</span>
        </p>
        <div className="card contact-card" data-reveal><ContactForm email={site.email} /></div>
      </div>
      <div className="orb-wrap" aria-hidden="true">
        <div ref={orb} className="orb">
          {three ? <div className="orb-3d"><BlobScene pointer={pointer} active={active} /></div> : <span className="orb-static" />}
        </div>
        <p className="eyebrow eyebrow-center">MOVE YOUR CURSOR · WATCH IT RESPOND</p>
      </div>
    </section>
  );
}
