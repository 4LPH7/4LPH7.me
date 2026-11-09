"use client";

import { GraduationCap, MapPin, School } from "lucide-react";
import { useEffect, useRef } from "react";
import { site } from "@/data/site";
import { SectionHeading } from "./SectionHeading";

/**
 * Centre-line timeline. Cards alternate sides with the big completion year opposite; the blue line fills as you scroll
 * and each node lights up once the fill passes it.
 */
export function Education() {
  const line = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = line.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.style.setProperty("--progress", "1"); return; }
    let kill = () => {};
    let cancelled = false;
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([g, s]) => {
      if (cancelled) return;
      g.default.registerPlugin(s.ScrollTrigger);
      const nodes = [...el.querySelectorAll<HTMLElement>(".tl-item")];
      const t = s.ScrollTrigger.create({
        trigger: el, start: "top 60%", end: "bottom 60%", scrub: 0.4,
        onUpdate: ({ progress }) => {
          el.style.setProperty("--progress", progress.toFixed(4));
          const h = el.offsetHeight;
          for (const n of nodes) n.classList.toggle("is-on", (n.offsetTop + 40) / h <= progress + 0.02);
        },
      });
      kill = () => t.kill();
    });
    return () => { cancelled = true; kill(); };
  }, []);

  const labels = site.education.map((e) => e.label).join(" → ");
  return (
    <section id="education" className="edu" aria-labelledby="education-title">
      <SectionHeading num="03" heading={site.headings.education} id="education-title" />
      <p className="lede" data-reveal>Every stage added another piece to the developer I&apos;m becoming.</p>
      <ol ref={line} className="tl">
        {site.education.map((e, n) => {
          const Icon = e.icon === "grad" ? GraduationCap : School;
          return (
            <li key={e.stage} className={`tl-item${n % 2 ? " is-right" : ""}`}>
              <span className="tl-node" aria-hidden="true"><Icon size={15} strokeWidth={1.6} /></span>
              <article className="tl-card card-interactive card" data-reveal>
                <div className="tl-card card-interactive-top">
                  <p className="eyebrow">{e.stage}</p>
                  <p className="tl-label mono">{e.label}</p>
                </div>
                <h3>{e.title}</h3>
                <p className="tl-org">{e.organization}</p>
                <p className="tl-meta"><MapPin size={13} aria-hidden="true" /> {e.location} <span aria-hidden="true">·</span> {e.score}</p>
                <p className="tl-detail">{e.detail}</p>
              </article>
              <div className="tl-year" data-reveal>
                <p className="tl-year-big">{e.year}</p>
                <p className="mono tl-year-sub">{e.period.toUpperCase()}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="tl-foot mono" aria-hidden="true">
        <span>{site.educationSpan}</span>
        <span>{labels}</span>
      </div>
    </section>
  );
}
