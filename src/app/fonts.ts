import {
	DM_Serif_Display,
	Instrument_Serif,
	JetBrains_Mono,
	Sanchez,
} from "next/font/google";

/**
 * Site fonts, downloaded at build time and served from the site (no render-blocking Google CSS, no third-party request
 * at runtime). CSS uses the variables (see tokens.css / site.css); canvases use `.style.fontFamily`, since the
 * generated family names differ from the Google ones.
 */
export const serif = Instrument_Serif({
	weight: "400",
	style: ["normal", "italic"],
	subsets: ["latin"],
	display: "swap",
	variable: "--nf-serif",
});
export const mono = JetBrains_Mono({
	subsets: ["latin"],
	display: "swap",
	variable: "--nf-mono",
});
export const hero = Sanchez({
	weight: "400",
	subsets: ["latin"],
	display: "swap",
	variable: "--nf-hero",
});
// Only used below the fold (profile name, footer), so it isn't preloaded.
export const display = DM_Serif_Display({
	weight: "400",
	subsets: ["latin"],
	display: "swap",
	variable: "--nf-display",
	preload: false,
});

export const fontVariables = [serif, mono, hero, display]
	.map((f) => f.variable)
	.join(" ");

/** Canvas font stacks (canvas can't read CSS variables). */
export const MONO = `${mono.style.fontFamily}, ui-monospace, Consolas, monospace`;
export const HERO = `${hero.style.fontFamily}, Georgia, serif`;
