"use client";

import { Github, RotateCw } from "lucide-react";
import { useState } from "react";
import { site } from "@/data/site";
import { LocationMap } from "./LocationMap";
import { Player } from "./Player";
import { SectionHeading } from "./SectionHeading";

const { stats } = site;
const card = (id: string) => stats.cards.find((c) => c.id === id) ?? stats.cards[0];
const runtime = card("runtime");
const hardware = card("hardware");
const location = card("location");

/** Two-sided card. The whole-card button flips it (mouse, touch and keyboard); its label names the face it will show. */
function FlipCard() {
  const [flipped, setFlipped] = useState(false);
  // Each face carries its own tip, so the tip turns with the card.
  const face = (c: typeof runtime, other: typeof runtime) => (
    <>
      <h3 className="st-title">{c.title}</h3>
      <dl className="st-rows">
        {c.rows.map(([k, v]) => <div key={k}><dt>{k}:</dt> <dd>{v}</dd></div>)}
      </dl>
      <p className="flip-tip" aria-hidden="true">
        <RotateCw size={12} />
        <span className="hint-fine">CLICK TO SEE {other.title.toUpperCase()}</span>
        <span className="hint-touch">TAP TO SEE {other.title.toUpperCase()}</span>
      </p>
    </>
  );
  return (
    <article className="flip" data-flipped={flipped} data-reveal>
      <div className="flip-inner">
        <div className="flip-face card" aria-hidden={flipped}>{face(runtime, hardware)}</div>
        <div className="flip-face flip-back card" aria-hidden={!flipped}>{face(hardware, runtime)}</div>
      </div>
      {/* The whole card is the toggle. */}
      <button type="button" className="flip-btn" onClick={() => setFlipped((f) => !f)}>
        <span className="sr-only">{flipped ? "Show run time" : "Show hardware"}</span>
      </button>
    </article>
  );
}

export function Stats() {
  return (
    <section id="stats" className="stats" aria-labelledby="stats-title">
      <SectionHeading num="05" heading={site.headings.stats} id="stats-title" />
      <p className="lede" data-reveal>{stats.intro}</p>
      <div className="bento">
        <article className="card b-hire" data-reveal>
          <h3 className="st-title">Hireable</h3>
          <p className="b-yes"><i aria-hidden="true" />{stats.hireable}</p>
          <p className="b-note">{stats.hireableNote}</p>
        </article>
        <article className="card b-repos" data-reveal>
          <p className="eyebrow">OPEN SOURCE</p>
          <p className="b-big">{stats.repos}</p>
          <p className="b-strong">Public repositories</p>
          <p className="b-note">and counting</p>
        </article>
        <article className="card b-gh" data-reveal>
          <h3 className="st-title"><Github size={22} strokeWidth={1.5} aria-hidden="true" /> GitHub</h3>
          <p className="eyebrow">LATEST PUSH</p>
          <p className="b-push">{stats.latestPush}</p>
          <p className="b-repo mono">REPO: <a href={`https://github.com/4LPH7/${stats.latestRepo}`} target="_blank" rel="noreferrer">{stats.latestRepo}</a></p>
        </article>
        <article className="card b-loc" data-reveal>
          <h3 className="st-title">{location.title}</h3>
          <p className="b-note">{location.rows.map(([, v]) => v).slice(0, 2).join(", ")}</p>
          <LocationMap />
        </article>
        <div className="b-player" data-reveal><Player /></div>
        <div className="b-flip"><FlipCard /></div>
      </div>
    </section>
  );
}
