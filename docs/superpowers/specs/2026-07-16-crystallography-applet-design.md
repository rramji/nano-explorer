# Crystallography Applet — Design

## Overview

Port `/home/robert/research/lei/nano102_activites/crystallography_activity.jsx` (a React +
Three.js Miller-index plane-placement tutor) into Nano Explorer as a new applet at
`src/applets/crystallography/`, added to the landing-page grid alongside DLVO, vdW, and
Derjaguin.

## Background

Nano Explorer's existing applets (DLVO, vdW, Derjaguin) are monolithic vanilla-JS/HTML pages
built with Vite, using Plotly from a CDN and no npm-managed UI framework. The source file for
this activity is a full React component using real Three.js WebGL rendering (rotatable 3D unit
cell, draggable intercept handles, raycasting), which doesn't fit that vanilla pattern.

Given a stated priority on UI/UX quality over stack consistency, and confirmation that GitHub
Pages static hosting is unaffected either way, the decision is to add a genuine Vite + React
build for this one page rather than porting the component to vanilla JS or compiling JSX with
an in-browser Babel. This preserves the original component's interaction logic (drag math,
raycasting) without the risk of introducing bugs during a manual rewrite, at the cost of this
being the first applet with npm-managed UI dependencies.

"Module #1" was the user's numbering for this being the first activity of this kind they're
porting in — it is not a distinct content category from "applets." It is treated identically to
DLVO/vdW/Derjaguin: same directory convention, same landing-page grid, same shared header.

## Stack & Build Changes

- Add npm dependencies: `react`, `react-dom`, `three` (runtime deps — bundled into the page).
- Add npm dev dependency: `@vitejs/plugin-react`.
- `vite.config.js`:
  - Add `plugins: [react()]`.
  - Add a new entry to `rollupOptions.input`: `crystallography: resolve(__dirname, 'src/applets/crystallography/index.html')`.

## Files

- `src/applets/crystallography/index.html`
  - `<link rel="stylesheet" href="../../style.css" />` (shared site styles, same as other applets).
  - Shared `site-header` navy bar with `← Nano Explorer` back-link (`.back-link`), matching the
    convention in `vdw/index.html` and `derjaguin/index.html`.
  - `<div id="root"></div>` mount point.
  - `<script type="module" src="./main.jsx"></script>`.
- `src/applets/crystallography/main.jsx`
  - `ReactDOM.createRoot(document.getElementById('root')).render(<App />)`.
- `src/applets/crystallography/App.jsx`
  - The ported `crystallography_activity.jsx` component (all physics/geometry logic, drag
    handling, plane math, problem set, and in-component styling carried over unchanged).
  - Only adjustments: import paths, and removing/renaming the default export as needed to wire
    into `main.jsx`.

## Visual Integration

- The activity keeps its own warm "paper/ink" palette (cream background, dark ink text,
  rose/steel/sage/amber accents) — this is a deliberate, self-contained worksheet aesthetic and
  is not restyled to match the site's cooler navy/blue-gray theme.
- Only the added shared `site-header` above the component uses the site's standard navy bar
  and back-link styling, exactly as it does on every other applet page.

## Landing Page Card

Added to the grid in `index.html`, positioned after the Derjaguin card and before the existing
"coming soon" placeholders (Brownian Diffusion, DLS, Superparamagnetism):

- Icon: 💠
- Banner gradient: `linear-gradient(135deg,#fdf6e3,#f0e0c0)` (warm cream, echoing the applet's
  own palette)
- Category tag: "Crystal Structure"
- Title: "Miller Indices"
- Description: "Practice translating (hkl) Miller indices into a plane position — drag
  intercept handles in a rotatable 3D unit cell, including the zero- and negative-index edge
  cases."
- Card links to `/nano-explorer/src/applets/crystallography/`, same href pattern as the other
  applet cards.

## Out of Scope

- No changes to the component's physics/pedagogy content (problem set, feedback logic, plane
  math) beyond what's needed to make it build and mount correctly.
- No restyling of the activity's internal palette or layout.
- No changes to the other existing applets.
