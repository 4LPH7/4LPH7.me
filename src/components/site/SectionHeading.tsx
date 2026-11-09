import type { Heading } from "@/data/site";

/** "01 —— ABOUT" eyebrow plus a serif heading whose second half is muted italic. */
export function SectionHeading({ num, heading, id, className = "" }: { num: string; heading: Heading; id: string; className?: string }) {
  return (
    <header className={`section-heading ${className}`}>
      <p className="section-heading-eyebrow" data-reveal>
        <span className="section-heading-num">{num}</span>
        <span className="section-heading-rule" aria-hidden="true" />
        <span>{heading.label}</span>
      </p>
      <h2 id={id} className="section-heading-title" data-reveal>
        {heading.plain} <em>{heading.italic}</em>
      </h2>
    </header>
  );
}
