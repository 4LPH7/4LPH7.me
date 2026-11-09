"use client";

import { useEffect, useRef, useState } from "react";

const CHAR_MS = 38;
const LINE_PAUSE = 420;

/**
 * Terminal window that types its lines one after another once it is 30% in view.
 * Finished lines get a check mark; the last line is the dimmed "done" message.
 * Reduced motion shows every line at once.
 */
export function Terminal({ prompt, lines, delay = 900 }: { prompt: string; lines: string[]; delay?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [line, setLine] = useState(0);
  const [chars, setChars] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLine(lines.length);
      return;
    }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setStarted(true); io.disconnect(); }
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [lines.length]);

  useEffect(() => {
    if (!started || line >= lines.length) return;
    const full = lines[line].length;
    const wait = line === 0 && chars === 0 ? delay : chars >= full ? LINE_PAUSE : CHAR_MS;
    const t = window.setTimeout(() => {
      if (chars >= full) { setLine((n) => n + 1); setChars(0); }
      else setChars((c) => c + 1);
    }, wait);
    return () => window.clearTimeout(t);
  }, [started, line, chars, lines, delay]);

  const done = line >= lines.length;
  return (
    <div ref={box} className="terminal" role="img" aria-label={`Terminal: ${lines.join(". ")}`}>
      <div className="terminal-bar" aria-hidden="true"><i /><i /><i /></div>
      <div className="terminal-body" aria-hidden="true">
        <p>{prompt}</p>
        {lines.map((text, i) => {
          if (i > line) return null;
          const typed = i < line ? text : text.slice(0, chars);
          const last = i === lines.length - 1;
          return (
            <p key={text} className={last ? "terminal-dim" : undefined}>
              {!last && i < line ? <span className="terminal-ok">✓ </span> : !last ? <span className="terminal-ok terminal-wait">› </span> : null}
              {typed}
              {i === line && !done ? <span className="terminal-caret" /> : null}
            </p>
          );
        })}
      </div>
    </div>
  );
}
