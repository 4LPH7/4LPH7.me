# Status: code sync

Source: refactor/design-system-10 in the 4LPH7.me repo (PR #2).

- tokens.json regenerated from src/app/tokens.css, including terminal-accent. The page rebuilds tokens.css from it.
- components/bundle.css updated: terminal prompt uses terminal-accent; inputs and range tracks use line-strong.
- Supreme dropped. Fonts: Instrument Serif, JetBrains Mono, DM Serif Display, Sanchez.
- Previews use the same class names as the code and were rendered against the regenerated tokens and this stylesheet.
