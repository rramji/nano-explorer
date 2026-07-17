# Molecular Orbital Diagrams applet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the user's standalone molecular-orbital-diagram draft into the Nano Explorer applet collection and surface it as the second card on the landing page.

**Architecture:** Mirror the existing per-applet pattern (`App.jsx` + `molecules.js` + `main.jsx` + `index.html` under `src/applets/<name>/`), register a Vite entry, and add a landing-page card. The draft is ported verbatim (fidelity: port + polish); the engine (`App.jsx`) and content (`molecules.js`) stay separate modules as the draft author designed. No restyle — the applet keeps its own internal `theme`, matching the other applets which each carry their own canvas palette under the shared site header.

**Tech Stack:** React 19, Vite 5, inline styles (no new dependencies). Verification via `vite build` and the `playwright` npm package driven from a Node script.

## Global Constraints

- No new dependencies. Pure React + inline styles; project is already on React 19 / Vite 5.
- Do NOT restyle to the site's blue palette — keep the draft's self-contained `theme` object.
- Do NOT rework the interaction model, molecule set (C₂²⁻, C₂⁺, BN, NO⁻, HF), or evaluation logic. Port verbatim; raise any polish item with the user before a substantive change.
- Applet directory name: `mo-diagrams`.
- Vite `base` is `/nano-explorer/`; applet URL path is `/nano-explorer/src/applets/mo-diagrams/`.
- Browser verification uses the `playwright` npm package in a Node script (the Playwright MCP is broken in this WSL setup). Put scratch scripts in the session scratchpad, not the repo.
- Source draft files (authoritative, copy verbatim):
  - `/mnt/c/Users/rober/Downloads/MOActivity.jsx`
  - `/mnt/c/Users/rober/Downloads/molecules.js`

---

### Task 1: Port the applet files and register the Vite entry

**Files:**
- Create: `src/applets/mo-diagrams/App.jsx` (verbatim copy of `MOActivity.jsx`)
- Create: `src/applets/mo-diagrams/molecules.js` (verbatim copy of the draft `molecules.js`)
- Create: `src/applets/mo-diagrams/main.jsx`
- Create: `src/applets/mo-diagrams/index.html`
- Modify: `vite.config.js` (add one `input` entry)
- Test: scratchpad Node script using `playwright` (smoke test; not committed)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: a working applet served at `/nano-explorer/src/applets/mo-diagrams/`. `App.jsx` default-exports the `MOActivity` React component. `molecules.js` exports `MOLECULES`, `MOLECULE_ORDER`, `matchesKeyLabel`, `norm`. Task 2 relies only on the applet URL path.

- [ ] **Step 1: Copy the engine file verbatim**

Copy `/mnt/c/Users/rober/Downloads/MOActivity.jsx` to `src/applets/mo-diagrams/App.jsx` with **no content changes**. Its existing first line stays:

```jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MOLECULES, MOLECULE_ORDER, matchesKeyLabel } from "./molecules";
```

The default export is `export default function MOActivity(...)`, which `main.jsx` imports as `App`. Do not rename it.

- [ ] **Step 2: Copy the content file verbatim**

Copy `/mnt/c/Users/rober/Downloads/molecules.js` to `src/applets/mo-diagrams/molecules.js` with **no content changes**. It must export `MOLECULES`, `MOLECULE_ORDER`, `matchesKeyLabel`, and `norm`.

- [ ] **Step 3: Create `main.jsx`**

Identical boilerplate to the other applets (matches `src/applets/crystallography/main.jsx`):

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 4: Create `index.html`**

Mirror `src/applets/crystallography/index.html`, with the MO title:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Molecular Orbital Diagrams — Nano Explorer</title>
  <link rel="stylesheet" href="../../style.css" />
</head>
<body>

<header class="site-header">
  <a class="logo" href="/nano-explorer/">Nano <span>Explorer</span></a>
  <a class="back-link" href="/nano-explorer/">← All applets</a>
</header>

<div id="root"></div>

<script type="module" src="./main.jsx"></script>
</body>
</html>
```

- [ ] **Step 5: Register the Vite entry**

In `vite.config.js`, add the `mo-diagrams` line to `build.rollupOptions.input` (keep the others):

```js
input: {
  main: resolve(__dirname, 'index.html'),
  dlvo:      resolve(__dirname, 'src/applets/dlvo/index.html'),
  derjaguin: resolve(__dirname, 'src/applets/derjaguin/index.html'),
  crystallography: resolve(__dirname, 'src/applets/crystallography/index.html'),
  'mo-diagrams': resolve(__dirname, 'src/applets/mo-diagrams/index.html'),
},
```

- [ ] **Step 6: Verify the production build (watch it succeed with the new entry)**

Run: `npm run build`
Expected: build completes with no errors, and the output lists an entry under `dist/` for `src/applets/mo-diagrams/index.html` (grep the output: `npm run build 2>&1 | grep mo-diagrams` should print at least one line).

- [ ] **Step 7: Write the Playwright smoke test**

Create `<scratchpad>/mo-smoke.mjs` (scratchpad dir, not the repo). Start the preview server separately (`npm run preview -- --port 4173` in the background) and point the script at it:

```js
import { chromium } from "playwright";

const URL = "http://localhost:4173/nano-explorer/src/applets/mo-diagrams/";
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: "networkidle" });

// App mounted: title + all five molecule tabs + toolbar buttons render.
await page.getByText("Molecular orbital diagrams").waitFor();
for (const t of ["C₂²⁻", "C₂⁺", "BN", "NO⁻", "HF"]) {
  await page.getByRole("button", { name: t }).waitFor();
}
await page.getByRole("button", { name: "+ σ level" }).waitFor();

// Core interaction: adding a level replaces the empty-canvas message.
await page.getByRole("button", { name: "+ σ level" }).click();
await page.getByText("Empty canvas.").waitFor({ state: "detached" });

// Check produces diagnostic feedback (an incomplete diagram warns).
await page.getByRole("button", { name: "Check diagram" }).click();
await page.getByText(/electrons/).first().waitFor();

await page.screenshot({ path: "<scratchpad>/mo-smoke.png", fullPage: true });
await browser.close();

if (errors.length) {
  console.error("CONSOLE/PAGE ERRORS:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("SMOKE OK");
```

- [ ] **Step 8: Run the smoke test to verify it passes**

Run (from repo root):
```bash
npm run preview -- --port 4173 &
PREVIEW_PID=$!
sleep 2
node <scratchpad>/mo-smoke.mjs
STATUS=$?
kill $PREVIEW_PID
exit $STATUS
```
Expected: prints `SMOKE OK`, exits 0, and `<scratchpad>/mo-smoke.png` shows the mounted activity (title, five tabs, canvas with one level, feedback note). Open the screenshot to visually confirm no layout breakage. If console errors appear, fix before committing.

- [ ] **Step 9: Commit**

```bash
git add src/applets/mo-diagrams vite.config.js
git commit -m "Add Molecular Orbital Diagrams applet"
```

---

### Task 2: Add the landing-page card (second, after Miller Indices)

**Files:**
- Modify: root `index.html` (insert one `<a class="card">` block)
- Test: scratchpad Node script using `playwright` (not committed)

**Interfaces:**
- Consumes: the applet URL path `/nano-explorer/src/applets/mo-diagrams/` from Task 1.
- Produces: a live landing-page card, positioned immediately after the Miller Indices card.

- [ ] **Step 1: Insert the card**

In root `index.html`, inside `<div class="grid">`, insert this block **immediately after** the closing `</a>` of the Miller Indices card (`href=".../crystallography/"`) and **before** the DLVO card:

```html
  <a class="card" href="/nano-explorer/src/applets/mo-diagrams/">
    <div class="card-banner" style="background: linear-gradient(135deg,#eef0fb,#d8dcf5);">⚛</div>
    <div class="card-body">
      <div class="card-tag">Chemical Bonding</div>
      <div class="card-title">Molecular Orbital Diagrams</div>
      <div class="card-desc">
        Build MO diagrams for second-row diatomics from a blank canvas —
        place and order the energy levels, fill electrons, then read off bond
        order, unpaired electrons, and magnetism.
      </div>
    </div>
    <div class="card-footer">Open applet</div>
  </a>
```

- [ ] **Step 2: Write the Playwright navigation test**

Create `<scratchpad>/mo-card.mjs`:

```js
import { chromium } from "playwright";

const BASE = "http://localhost:4173/nano-explorer/";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(BASE, { waitUntil: "networkidle" });

// The card exists and is the SECOND card in the grid (after Miller Indices).
const titles = await page.locator(".grid .card .card-title").allInnerTexts();
if (titles[0] !== "Miller Indices") throw new Error("first card not Miller Indices: " + titles[0]);
if (titles[1] !== "Molecular Orbital Diagrams") throw new Error("second card not MO: " + titles[1]);

// It links to the applet and navigates there.
await page.getByText("Molecular Orbital Diagrams").click();
await page.waitForURL("**/mo-diagrams/");
await page.getByText("Molecular orbital diagrams").waitFor();

await browser.close();
console.log("CARD OK");
```

- [ ] **Step 3: Run it to verify it fails before, passes after (build + preview)**

Run:
```bash
npm run build
npm run preview -- --port 4173 &
PREVIEW_PID=$!
sleep 2
node <scratchpad>/mo-card.mjs
STATUS=$?
kill $PREVIEW_PID
exit $STATUS
```
Expected: prints `CARD OK`, exits 0. (If run before Step 1, the second-card assertion fails — confirming the test is meaningful.)

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Add Molecular Orbital Diagrams card to landing page"
```

---

## Self-Review

**Spec coverage:**
- Directory + four files under `src/applets/mo-diagrams/` → Task 1 (steps 1–4). ✓
- `molecules.js` kept separate → Task 1 step 2. ✓
- Vite registration → Task 1 step 5. ✓
- Landing-page card, second after Miller Indices → Task 2. ✓
- Own internal theme, no restyle → enforced by verbatim copy (Task 1 steps 1–2) + Global Constraints. ✓
- No new dependencies → Global Constraints; nothing installs anything. ✓
- Build passes + playwright end-to-end drive → Task 1 steps 6–8, Task 2 step 3. ✓
- Out of scope (no logic rework, no restyle) → Global Constraints. ✓

**Placeholder scan:** `<scratchpad>` is a literal instruction to substitute the session scratchpad path, not an unfilled plan gap; all code blocks are complete. No TBDs.

**Type consistency:** `App.jsx` default export imported as `App` in `main.jsx`; `molecules.js` exports (`MOLECULES`, `MOLECULE_ORDER`, `matchesKeyLabel`, `norm`) match `App.jsx`'s import. Applet URL path is identical across Task 1 (index.html, smoke test) and Task 2 (card href, nav test): `/nano-explorer/src/applets/mo-diagrams/`. Card copy/title (`Molecular Orbital Diagrams`) matches the nav-test assertion.
