import { ArrowUpRight, FileText, Github, Linkedin } from "lucide-react";
import { site } from "@/data/site";
import { menuSocials } from "@/lib/menu";
import { BackToTop } from "./BackToTop";

const nav = site.nav.filter((n) => n.id !== "stats").map((n, i) => ({ ...n, number: String(i + 1).padStart(2, "0") }));
const icons = { GitHub: Github, LinkedIn: Linkedin } as Record<string, typeof Github>;

export function SiteFooter() {
  const { footer } = site;
  return (
    <footer className="foot">
      <div className="foot-panel">
        <div className="foot-glow" aria-hidden="true" />
        <div className="foot-top">
          <div className="foot-copy">
            <p className="chip chip-mono"><i aria-hidden="true" />{footer.chip}</p>
            <p className="foot-head">{footer.plain} <em>{footer.italic}</em></p>
            <p className="foot-blurb">{footer.blurb}</p>
            <a className="foot-mail" href={`mailto:${site.email}`}>{site.email} <ArrowUpRight size={14} aria-hidden="true" /></a>
          </div>
          <nav className="foot-nav" aria-label="Footer">
            <h2 className="eyebrow">NAVIGATION</h2>
            <ol>
              {nav.map((n) => (
                <li key={n.href}><a href={n.href}>{n.label}<span className="mono">{n.number}</span></a></li>
              ))}
            </ol>
          </nav>
        </div>
        <div className="foot-bottom">
          <p className="foot-name" aria-hidden="true">{site.handle}</p>
          <BackToTop />
        </div>
      </div>
      <div className="foot-meta">
        <p>© {new Date().getFullYear()} {site.name.toUpperCase()} · {site.handle}</p>
        <ul className="foot-socials">
          {menuSocials(site.socials).map((s) => {
            const Icon = icons[s.label] ?? ArrowUpRight;
            return <li key={s.label}><a href={s.href} target="_blank" rel="noreferrer" aria-label={s.label}><Icon size={22} strokeWidth={1.4} aria-hidden="true" /></a></li>;
          })}
          <li><a href="/resume/" aria-label="Résumé"><FileText size={22} strokeWidth={1.4} aria-hidden="true" /></a></li>
        </ul>
      </div>
    </footer>
  );
}
