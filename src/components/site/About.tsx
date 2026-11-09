"use client";

import { ArrowUpRight, Brain, Github, Linkedin, Mail, MapPin, Monitor, ShieldCheck, Swords } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { site } from "@/data/site";
import { formatClock } from "@/lib/clock";
import { revealedCount, splitWords } from "@/lib/reveal";
import { Robot } from "./Robot";
import { SectionHeading } from "./SectionHeading";

const words = splitWords(site.about.story).map((text, id) => ({ id, text }));
const offIcons = [Monitor, Swords, Brain, ShieldCheck];
const socialIcon = { GitHub: Github, LinkedIn: Linkedin } as Record<string, typeof Github>;
const [first, ...rest] = site.name.split(" ");

/**
 * Live IST clock, ticking each second; blank until mounted so the export has no stale time. Its own component so the
 * tick re-renders only this, not the whole section and its 3D scene.
 */
function Clock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(formatClock(new Date(), site.timeZone));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  return <time className="mono" suppressHydrationWarning>{time || "--:--:-- --"}</time>;
}

/** Runs `onProgress(0..1)` while `el` scrolls through the viewport, via GSAP ScrollTrigger. */
function useScrub(el: React.RefObject<HTMLElement | null>, onProgress: (p: number) => void, start = "top 80%", end = "bottom 45%") {
  // biome-ignore lint/correctness/useExhaustiveDependencies: set up once; callers pass stable callbacks
  useEffect(() => {
    const node = el.current;
    if (!node || matchMedia("(prefers-reduced-motion: reduce)").matches) { onProgress(1); return; }
    let kill = () => {};
    let cancelled = false;
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([g, s]) => {
      if (cancelled) return;
      g.default.registerPlugin(s.ScrollTrigger);
      const t = s.ScrollTrigger.create({ trigger: node, start, end, scrub: true, onUpdate: ({ progress }) => onProgress(progress) });
      onProgress(t.progress);
      kill = () => t.kill();
    });
    return () => { cancelled = true; kill(); };
  }, []);
}

export function About() {
  const story = useRef<HTMLParagraphElement>(null);
  const timeline = useRef<HTMLOListElement>(null);

  useScrub(story, (p) => {
    const spans = story.current?.querySelectorAll<HTMLElement>(".ab-word");
    if (!spans) return;
    const n = revealedCount(p, spans.length);
    spans.forEach((w, i) => { w.classList.toggle("is-lit", i < n); });
  });
  useScrub(timeline, (p) => timeline.current?.style.setProperty("--progress", String(p)), "top 70%", "bottom 60%");

  return (
    <section id="about" className="about" aria-labelledby="about-title">
      <aside className="about-aside">
        <article className="profile" data-reveal aria-label="Profile">
          <div className="profile-top">
            <p className="profile-name">{first} <span>{rest.join(" ")}</span></p>
            <p className="pill-status"><i aria-hidden="true" />{site.availability}</p>
          </div>
          <p className="profile-meta">
            <MapPin size={14} aria-hidden="true" /> {site.location}
            <span aria-hidden="true">·</span>
            <Clock />
          </p>
          <div className="profile-art"><Robot /></div>
          <div className="profile-foot">
            <ul className="icon-row">
              {site.socials.filter((s) => s.href).map((s) => {
                const Icon = socialIcon[s.label] ?? ArrowUpRight;
                return <li key={s.label}><a className="icon-btn" href={s.href} target="_blank" rel="noreferrer" aria-label={s.label}><Icon size={17} strokeWidth={1.6} aria-hidden="true" /></a></li>;
              })}
            </ul>
            <a className="profile-mail" href={`mailto:${site.email}`}>
              <Mail size={15} aria-hidden="true" /> <span className="profile-mail-full">{site.email}</span><span className="profile-mail-short">Email me</span>
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </div>
        </article>
      </aside>

      <div className="about-main">
        <SectionHeading num="01" heading={site.headings.about} id="about-title" />
        <p ref={story} className="about-story">
          {words.map((w) => <span key={w.id} className="ab-word">{w.text} </span>)}
        </p>

        <ol ref={timeline} className="chapters">
          {site.about.chapters.map((c) => (
            <li key={c.number} className="chapter" data-reveal>
              <span className="chapter-dot" aria-hidden="true" />
              <p className="eyebrow">CHAPTER {c.number}</p>
              <h3>{c.title}</h3>
              <p>{c.detail}</p>
            </li>
          ))}
        </ol>

        <h3 className="eyebrow about-sub" data-reveal>OFF THE KEYBOARD</h3>
        <ul className="off-grid">
          {site.about.offKeyboard.map((c, i) => {
            const Icon = offIcons[i] ?? Monitor;
            return (
              <li key={c.number} className="card off-card" data-reveal>
                <span className="off-icon" aria-hidden="true"><Icon size={16} strokeWidth={1.6} /></span>
                <h4>{c.title}</h4>
                <p>{c.detail}</p>
              </li>
            );
          })}
        </ul>

        <div className="cta card" data-reveal>
          <div>
            <h3>Got a problem worth <em>solving?</em></h3>
            <p>Open to roles, freelance work and collaborations.</p>
          </div>
          <a className="btn btn-inverse" href="#contact"><i aria-hidden="true" />CONNECT WITH ME</a>
        </div>
      </div>
    </section>
  );
}
