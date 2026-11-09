import { themeColor } from "@/lib/theme";
"use client";

import { HERO } from "@/app/fonts";
import TechText from "@/components/reactbits/TechText/TechText";

/**
 * The hero wordmark: React Bits TechText in Sanchez.
 */
export function HeroName({ text }: { text: string }) {
  return (
    <span className="hero-wordmark" aria-hidden="true">
      <TechText
        text={text.toUpperCase()}
        fontFamily={HERO}
        fontWeight={400}
        fontSize={110}
        letterSpacing={0.04}
        accentColor={themeColor("--accent")}
        reveal="letter"
        dashLength={4}
        dashGap={2}
        specks={15}
        intro="none"
        introDuration={2}
        clickKick
        guides={false}
        bounds=".hero"
      />
    </span>
  );
}
