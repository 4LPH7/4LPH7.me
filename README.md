# 4LPH7.me

Modern, interactive portfolio for **Arul G** (@4LPH7). Built with Next.js 16 static export and deployed to GitHub Pages at [4lph7.me](https://4lph7.me).

---

## Features

- **3D Interactive Lanyard:** Three.js physics simulation with draggable ID badge, metal clasp, textured strap, and flip interactions. Positioned on the left edge and optimized for mobile screens.
- **Hero Section:** Centered headline powered by React Bits `<TechText />` with vector outlines, specks, and kick physics rendered in the **Sanchez** slab-serif typeface.
- **Terminal Emulator:** Interactive typewriter CLI terminal showcasing profile status and tech stack.
- **Interactive Skills Field:** 2D canvas physics simulation where skill tags drop, bounce, and collide under gravity.
- **3D Dot Globe:** Canvas-based interactive rotating globe with location pinpoint for Coimbatore, IN.
- **Vinyl Music Player:** Analog-style turntable widget with rotating vinyl record and moving tone-arm.
- **Responsive & Accessible:** Fluid clamp-based responsive typography, light/dark mode support, and full `prefers-reduced-motion` fallbacks across all animations.

---

## Tech Stack

- **Framework:** Next.js 16 (`output: "export"`), React 19, TypeScript 5
- **3D & Graphics:** Three.js, React Three Fiber, Rapier physics, HTML5 Canvas 2D
- **Animation & Motion:** GSAP + ScrollTrigger, Lenis smooth scrolling
- **UI & Typography:** One token set in `src/app/tokens.css` (colours, spacing, radii, z-index, motion, both themes); the site layers its styles on top in `site.css`, `site-sections.css` and `site-widgets.css`. Fonts: Instrument Serif, JetBrains Mono, DM Serif Display and Sanchez (self-hosted through `next/font`); body text uses the system UI font. Design system: see the brand book in the design-system artifact.
- **Icons:** Lucide React
- **Forms:** Web3Forms integration with native mailto fallback
- **Tooling:** Biome (linting & formatting), Node.js native test runner

---

## Project Structure

```
├── public/
│   ├── lanyard/        # SVGs for lanyard card front, back, and strap
│   └── music/          # Audio tracks for the turntable player
├── src/
│   ├── app/            # Next.js App Router pages and global CSS
│   ├── components/     # Site sections and interactive widgets
│   │   ├── reactbits/  # React Bits components (TechText, Lanyard)
│   │   └── site/       # Hero, About, Projects, Skills, Stats, Contact, etc.
│   ├── data/           # Site content and metadata (site.ts)
│   └── lib/            # Utility helpers and test suites
└── components.json     # Shadcn & React Bits Pro registry configuration
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server on `localhost:3000` |
| `npm run build` | Build optimized static export to `out/` |
| `npm run lint` | Run Biome lint checks |
| `npm run typecheck` | Run TypeScript type checking (`tsc --noEmit`) |
| `npm test` | Run unit tests (`node --test`) |
| `npm run verify:export` | Verify static export output |

---

## Configuration & Content

- **Personal Information:** Edit `src/data/site.ts` to update profile bio, project showcases, skills, education, and social links.
- **Contact Form:** Add your Web3Forms access key in `.env` or `.env.local` as `NEXT_PUBLIC_WEB3FORMS_KEY`.
- **Music Tracks:** Place audio files at `public/music/` and configure track details in `src/data/site.ts`.

---

## Deployment

Every push to `main` triggers `.github/workflows/deploy.yml` which runs lint, typecheck, tests, builds the static export, and publishes to GitHub Pages using the custom domain in `CNAME`.
