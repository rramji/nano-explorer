# Molecular Orbital Diagrams applet — design

**Date:** 2026-07-16
**Status:** Approved for planning

## Goal

Port an existing standalone draft (a multi-problem molecular orbital diagram
activity) into the Nano Explorer applet collection, wiring it into the site's
established structure and surfacing it on the landing page.

Fidelity: **port + polish.** Reproduce the draft's behavior and content
faithfully; flag and fix only small rough edges, checking with the user before
any substantive change to behavior or content.

## Source draft

Two files the user authored:

- `/mnt/c/Users/rober/Downloads/MOActivity.jsx` — the engine/UI. A `MOActivity`
  shell holding per-problem state keyed by molecule id, a `DiagramBuilder` per
  problem (blank draggable canvas + a pure `evaluate()` grader + follow-up
  questions), and a `LevelNode` per draggable orbital level. Self-contained
  `theme` object for all colors; pure React + inline styles.
- `/mnt/c/Users/rober/Downloads/molecules.js` — the content layer: answer keys
  (bottom→top energy ordering), accepted label variants, occupancies, bond
  order / unpaired counts, and per-molecule follow-up questions. Covers five
  species: C₂²⁻, C₂⁺, BN, NO⁻, HF. Header comments document deliberate
  chemistry choices (row σ/π ordering flip after N₂, BN treated as the
  intro-textbook diamagnetic case, HF's nonbonding lone pairs).

Nothing is scored; status is diagnostic (untouched / attempted / revised /
first-try).

## Existing pattern (to mirror)

Each applet under `src/applets/<name>/` has:

- `App.jsx` — the React component, default export
- `main.jsx` — mounts `<App />` into `#root` (identical boilerplate across applets)
- `index.html` — shell that pulls in the shared site header + `../../style.css`

Registration lives in two places:

- `vite.config.js` — one entry per applet in `build.rollupOptions.input`
- root `index.html` — one landing-page `<a class="card">` per applet

Convention confirmed from crystallography/DLVO/vdW: each applet carries its
**own internal color palette** inside its canvas while sharing the site's blue
header chrome. The draft's self-contained `theme` therefore fits as-is; no
restyle.

## Target structure

New directory `src/applets/mo-diagrams/`:

| File | Content |
|------|---------|
| `App.jsx` | `MOActivity` shell + `DiagramBuilder`, `LevelNode`, `evaluate()`, `Summary`, UI atoms — ported from `MOActivity.jsx`, default export |
| `molecules.js` | Content layer ported verbatim from the draft; kept a separate module (engine vs. content boundary the draft author designed) |
| `main.jsx` | Standard mount boilerplate |
| `index.html` | Standard applet shell, `<title>Molecular Orbital Diagrams — Nano Explorer</title>`, links `../../style.css` |

The draft's `import { ... } from "./molecules"` stays valid unchanged.

## Integration edits

1. `vite.config.js`: add `'mo-diagrams': resolve(__dirname, 'src/applets/mo-diagrams/index.html')`
   to `rollupOptions.input`.
2. root `index.html`: add a live `<a class="card">` linking to
   `/nano-explorer/src/applets/mo-diagrams/`, positioned **second — immediately
   after the Miller Indices card**. Tag "Chemical Bonding", title "Molecular
   Orbital Diagrams", short description of the drag-to-build activity, and a
   banner emoji/gradient consistent with the other cards (⚛-style).

## Dependencies

None new. Pure React + inline styles; project already on React 19.

## Verification

- `npm run build` (vite) completes without errors and emits the new entry.
- Drive the built/preview page with the `playwright` npm package **directly in
  a node script** (the Playwright MCP is broken in this WSL setup — no root).
  Exercise one full problem end to end: add σ and π levels, drag to order them,
  click to set occupancies, Check, reach the solved state, answer the MC +
  free-response questions, navigate between molecules, and open the Summary.

## Out of scope

- Reworking the interaction model, molecule set, or evaluation logic.
- Restyling to the site's blue palette.
- Any new tooling or dependencies.

## Polish log (to fill during implementation)

Any small issues spotted during the port get noted here and raised with the
user before a substantive change is made.
