# Gridiron Coach

A browser-based learning game for American Football formations, positions, and strategic matchups. No server required — fully static, deployable to GitHub Pages.

## What it is

Gridiron Coach teaches football strategy through an interactive play-calling loop:

1. **Scout** the opposing formation on a live field diagram
2. **Call** your formation and play type as a counter
3. **Watch** the play resolve with an animated outcome
4. **Learn** from the breakdown — why it worked, why it didn't, and what each position was responsible for

Every element of the UI doubles as a teaching surface. Hover any player dot to see their role; click to go deeper. Every football term is linked to a searchable glossary.

## Current state — Phase 0

The Sandbox and Glossary are live. Phase 1 (the play-calling game loop) is next.

**Sandbox** — Browse all formations (offense and defense), inspect player alignments, read strengths/weaknesses, and toggle "Tells" to see pre-snap reads. Switch to the Positions tab to explore every position's responsibilities and coaching notes.

**Glossary** — 40+ terms covering formations, coverages, gaps, down-and-distance, personnel packages, and more. Searchable, with related-term navigation.

## Tech stack

- **Svelte 5** + **Vite** — component framework and build tool
- **SVG** — field and player rendering (no canvas, no game engine)
- **Svelte stores** — reactive state, persisted to `localStorage` in later phases
- **GitHub Actions** — automatic deploy to GitHub Pages on push to `main`

## Development

```bash
npm install
npm run dev       # localhost:5173
npm run build     # production build → dist/
```

## Deploy to GitHub Pages

1. Create a GitHub repo and push this branch to `main`.
2. In the repo settings → **Pages**, set source to **GitHub Actions**.
3. Every push to `main` triggers the deploy workflow at `.github/workflows/deploy.yml`.

## Project structure

```
src/
  data/           # JSON — formations, positions, plays, matchups, glossary
  lib/
    components/   # Svelte UI components (field, glossary drawer, cards)
    stores/       # Svelte writable stores
  routes/         # Page-level components (Sandbox, Coach, Drill, Tutorial)
  App.svelte
  app.css
.github/
  workflows/
    deploy.yml    # GitHub Pages deploy pipeline
```

## Design

Full design rationale and phased build plan: [DESIGN.md](DESIGN.md)
