export type Theme = "dark" | "light";

/** Same key the existing toggle used, so saved choices carry over. */
export const THEME_KEY = "portfolio-theme";

/** Dark is the default (matches the reference); only an explicit "light" opts out. */
export function resolveTheme(stored: string | null | undefined): Theme {
  return stored === "light" ? "light" : "dark";
}

/** Inline <head> script: applies a saved light theme before first paint (no flash). */
export const themeInitScript = `try{if(localStorage.getItem(${JSON.stringify(THEME_KEY)})==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

type StyleSource = Pick<CSSStyleDeclaration, "getPropertyValue">;

/** Current value of a CSS custom property, e.g. cssVar("--accent"). Canvas and WebGL code reads tokens through this. */
export function cssVar(name: string, style: StyleSource = getComputedStyle(document.documentElement)): string {
  return style.getPropertyValue(name).trim();
}

/** Runs cb whenever the theme attribute changes. Returns a disposer. */
export function onThemeChange(cb: () => void): () => void {
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
