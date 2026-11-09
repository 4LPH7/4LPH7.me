"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { THEME_KEY, resolveTheme, type Theme } from "@/lib/theme";

type Transition = { ready: Promise<void>; finished: Promise<void> };
type VTDocument = Document & { startViewTransition?: (cb: () => void) => Transition };

/**
 * Round moon/sun button. Switching theme spreads the new theme out from the button in a circle (and draws it back
 * in when going dark), using the View Transitions API; browsers without it get a quick colour fade, and reduced
 * motion switches instantly. Persists the choice; storage failures are ignored.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    let saved: string | null = null;
    try { saved = window.localStorage.getItem(THEME_KEY); } catch {}
    const initial = resolveTheme(saved);
    document.documentElement.dataset.theme = initial;
    setTheme(initial);
  }, []);

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    // flushSync so the new snapshot already shows the new icon
    const apply = () => {
      flushSync(() => setTheme(next));
      root.dataset.theme = next;
    };
    try { window.localStorage.setItem(THEME_KEY, next); } catch {}

    const doc = document as VTDocument;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return apply();
    if (!doc.startViewTransition) {
      root.classList.add("theme-fade");
      apply();
      window.setTimeout(() => root.classList.remove("theme-fade"), 450);
      return;
    }

    // Percentages of the viewport (not px) keep the circle on the button even when the page is zoomed.
    const r = e.currentTarget.getBoundingClientRect();
    const x = (((r.left + r.width / 2) / innerWidth) * 100).toFixed(2);
    const y = (((r.top + r.height / 2) / innerHeight) * 100).toFixed(2);
    const toDark = next === "dark";
    root.classList.add("theme-switching");
    root.classList.toggle("to-dark", toDark);
    const t = doc.startViewTransition(apply);
    t.ready.then(() => {
      // 150% of the reference radius is longer than the viewport's diagonal, so it covers everything from any corner.
      const circles = [`circle(0% at ${x}% ${y}%)`, `circle(150% at ${x}% ${y}%)`];
      root.animate(
        { clipPath: toDark ? circles.reverse() : circles },
        { duration: 700, easing: "cubic-bezier(0.65, 0, 0.35, 1)", fill: "forwards", pseudoElement: toDark ? "::view-transition-old(root)" : "::view-transition-new(root)" },
      );
    }).catch(() => {});
    t.finished.finally(() => root.classList.remove("theme-switching", "to-dark"));
  }

  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  return (
    <button className="icon-btn icon-btn-glass" type="button" onClick={toggle} aria-label={label} title={label}>
      {/* keyed so the icon spins in each time it changes */}
      <span key={theme} className="tt-icon">
        {theme === "dark" ? <Moon size={18} strokeWidth={1.75} aria-hidden="true" /> : <Sun size={18} strokeWidth={1.75} aria-hidden="true" />}
      </span>
    </button>
  );
}
