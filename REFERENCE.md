# Reference inventory

**Reference:** https://achint.vercel.app/  
**Inspected:** 2026-10-20  
**Method:** Chrome DevTools MCP 1.11.0 with an isolated Chrome profile. Used accessibility/DOM snapshots and read-only computed-style inspection at 375×812, 768×1024, and 1440×900. Snapshots were preferred over screenshots. The 375px menu and theme, plus the project carousel, were exercised.

This is a structure and interaction reference only. Do not reuse the reference author's copy, identity details, logo, images, or project content.

## Sections, in scroll order

1. **Navigation and hero:** A fixed, expandable navigation overlay with section anchors and social links, plus a dark/light theme toggle. The full-viewport hero combines a large personal-name treatment, a short tagline, terminal-style status/typing lines, availability/location metadata, social/contact links, and a scroll-to-about control.
2. **About:** A long-form introduction with three numbered chapter cards, a compact personal-facts area, and a contact CTA.
3. **Selected projects:** A full-screen desktop carousel with 11 selectable project entries. The active project view shows a project visual, summary, technology tags, and an external repository link; previous/next controls and keyboard/swipe guidance are present. Selecting Next changed the active item.
4. **Education and growth:** Three dated milestone cards, each with a stage label, institution/location metadata, and a short description.
5. **Skills:** An interactive field of 17 technology items, filterable through All, Frontend, Backend, and Tools tabs. Touch guidance changes to a tap instruction on narrow viewports.
6. **Stats and personal widgets:** Availability/open-source summary cards, a GitHub activity panel, a four-track vinyl-style music player with playback/track/volume/seek controls, and runtime, hardware, and location cards.
7. **Contact:** A contact summary and form with required name, email, and message fields, a submit button, and a polite live-status region. A cursor-oriented visual cue is present. The form was not submitted, so its delivery endpoint is unverified.
8. **Footer:** Short author blurb, section navigation, social links, a back-to-top control, and copyright line.

## Visual system and layout

- **Palette:** Dark mode is the default, with a black `#000` page background and white text. Blue accents include `#3b82f6` and deeper `#1d4ed8`; zinc-like grays provide secondary text. The page defines subtle white grid dots/lines (`#ffffff17` / `#ffffff0d`) and translucent dark/white treatments for interactive bubbles and controls. The theme toggle was verified to switch the page to a light surface (`rgb(244, 247, 252)`) and back.
- **Typography:** The body uses the system UI sans-serif (Supreme was listed but never loaded, so it was dropped); prominent section headings use Instrument serif; a decorative Aftersick face is used for the personal-name treatment. Other component-level faces include Oleana, Avocado, Quilon, Roboto, and monospace. Large desktop section headings measure about 60–72px.
- **Spacing:** Utility-class layout uses roughly 20px horizontal padding on narrow screens, 32px at the `sm` breakpoint, and 48px at `lg`; long sections use generous vertical padding (about 80–128px). Several showcase sections are viewport-height compositions.
- **Motion and effects:** Runtime DOM confirms Lenis smooth-scroll classes. The hero has terminal-style status/typing content; projects and skills are interactive; the contact area cues a cursor effect. A separate preloader, page transitions, parallax, and specific scroll-reveal sequences were not confirmed during this inspection.

## Responsive behavior

- **375px:** Navigation collapses to a menu button; opening it reveals the section links and socials. Project selector labels are shortened to project names. Skills switch to touch-oriented guidance; runtime/hardware details expose explicit controls. Content is arranged for a narrow viewport.
- **768px:** The menu button remains available. Project entries include numbering and more metadata than at 375px. Home, projects, and skills retain viewport-height section layouts at this width; longer narrative sections continue vertically.
- **1440px:** Home, projects, skills, and contact are approximately 900px tall at the inspected viewport. About and education are long editorial sections (about 1,750px and 1,715px respectively); stats is about 1,000px. Large serif headings and more spacious project/skills layouts are used.

## Interactions verified or observed

- Expand/collapse the navigation and follow section anchors.
- Switch between dark and light themes.
- Select a project; next/previous controls, keyboard arrows, and swipe are advertised.
- Filter skill items by category; the tabs expose selected state to accessibility APIs.
- Play/mute audio, change tracks, and adjust volume/seek using labeled controls (controls observed; audio playback intentionally not started).
- Reveal/flip runtime and hardware detail cards depending on input mode.
- Submit a required-field contact form (interaction observed; endpoint not tested).
- Use the back-to-top footer control.

## Handoff constraints

- Recreate only the observed structure, layout logic, and interaction patterns with Arul’s own identity, copy, and original assets.
- Keep the black-first visual direction if appropriate, but choose a distinct accent color for Arul’s brand.
- Treat the exact hover/cursor behavior and the contact form’s backend as unresolved details; do not invent them from the text cues alone.
- Preserve the supplied privacy constraint: do not publish date of birth, home address, phone number, family details, or ID numbers.
