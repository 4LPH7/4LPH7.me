import type { Metadata } from "next";
import Link from "next/link";
import { type SkillCategory, site } from "@/data/site";

export const metadata: Metadata = {
  description: "Résumé for Arul G / 4LPH7.",
  alternates: { canonical: "/resume/" },
};

const groups: SkillCategory[] = ["Frontend", "Backend", "Tools"];
const github = site.socials.find((s) => s.label === "GitHub")?.href;

export default function ResumePage() {
  return (
    <main id="main" className="site-shell resume-page">
      <Link className="brand" href="/">← <span>4LPH7</span> / HOME</Link>
      <h1>{site.name}</h1>
      <p className="hero-copy">{site.hero.tagline}</p>
      <section className="resume-section"><h2>Profile</h2><p>{site.about.story}</p><p>{site.location} · {site.email}</p></section>
      <section className="resume-section"><h2>Selected projects</h2>
        {site.projects.map((p) => (
          <div key={p.id} style={{ marginBottom: 24 }}>
            <h3>{p.title}</h3>
            <p>{p.summary}</p>
            {p.repoUrl && <p><a className="text-link" href={p.repoUrl} target="_blank" rel="noreferrer">Repository ↗</a></p>}
          </div>
        ))}
      </section>
      <section className="resume-section"><h2>Skills</h2>
        <div className="resume-skills-grid">
          {groups.map((g) => (
            <div key={g}><h3>{g}</h3><p>{site.skills.filter((s) => s.category === g).map((s) => s.name).join(" · ")}</p></div>
          ))}
        </div>
      </section>
      <section className="resume-section"><h2>Education</h2>
        <div className="resume-experience">
          {site.education.map((e) => (
            <div key={e.stage}>
              <p className="resume-experience-year">{e.period}</p>
              <p className="resume-experience-role">{e.title}</p>
              <p className="resume-experience-context">{e.organization} · {e.score}</p>
            </div>
          ))}
        </div>
      </section>
      {github && <section className="resume-section"><h2>Links</h2><p><a className="text-link" href={github} target="_blank" rel="noreferrer">GitHub profile ↗</a></p></section>}
      <Link className="btn btn-outline" href="/">← Back to portfolio</Link>
    </main>
  );
}
