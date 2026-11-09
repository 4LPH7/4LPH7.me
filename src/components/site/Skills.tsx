"use client";

import { useEffect, useRef, useState } from "react";
import { site } from "@/data/site";
import { step as move } from "@/lib/carousel";
import { TABS, type Tab, filterSkills, tabCounts } from "@/lib/skills";
import { SectionHeading } from "./SectionHeading";
import { createSkillField } from "./skillsField";

const counts = tabCounts(site.skills);

/** Bubble size: a few favourites are bigger, like a real toolbox. */
const BIG = new Set(["React", "Python", "Next.js", "JavaScript", "TypeScript", "Node.js"]);

/**
 * The toolbox: a field of soft foam bubbles, one per skill (canvas logic in skillsField.ts). Tabs filter the set.
 */
export function Skills() {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [tab, setTab] = useState<Tab>("All");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const shown = filterSkills(site.skills, tab);

  const field = useRef<ReturnType<typeof createSkillField> | null>(null);

  useEffect(() => {
    if (!wrap.current || !canvas.current) return;
    const f = createSkillField(wrap.current, canvas.current, site.skills, BIG);
    field.current = f;
    return () => { f.dispose(); field.current = null; };
  }, []);

  // Tabs morph the same bubbles: the rest shrink away, newcomers grow in from the middle.
  useEffect(() => {
    field.current?.show(new Set(filterSkills(site.skills, tab).map((s) => s.name)));
  }, [tab]);

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = move(i, d, TABS.length);
    setTab(TABS[n]);
    tabRefs.current[n]?.focus();
  };

  return (
    <section id="skills" className="skills" aria-labelledby="skills-title">
      <div className="skills-head">
        <SectionHeading num="04" heading={site.headings.skills} id="skills-title" />
        <div className="tabs" role="tablist" aria-label="Skill categories" data-reveal>
          {TABS.map((t, i) => (
            <button
              key={t}
              ref={(el) => { tabRefs.current[i] = el; }}
              type="button"
              role="tab" className="tab"
              id={`skills-tab-${t}`}
              aria-selected={tab === t}
              aria-controls="skills-panel"
              tabIndex={tab === t ? 0 : -1}
              onClick={() => setTab(t)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {t} <sup>{counts[t]}</sup>
            </button>
          ))}
        </div>
      </div>
      <div id="skills-panel" role="tabpanel" aria-labelledby={`skills-tab-${tab}`} className="skills-field card" data-reveal>
        <div ref={wrap} className="field-canvas" aria-hidden="true">
          <canvas ref={canvas} />
        </div>
        <ul className="sr-only">{shown.map((s) => <li key={s.name}>{s.name} ({s.category})</li>)}</ul>
        <p className="eyebrow field-hint"><span className="hint-fine">DRAG · FLICK · HOLD EMPTY SPACE TO PULL · DOUBLE-CLICK TO POP</span><span className="hint-touch">DRAG · HOLD TO PULL · DOUBLE-TAP TO POP</span></p>
      </div>
    </section>
  );
}

