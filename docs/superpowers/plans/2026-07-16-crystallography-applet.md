# Crystallography Applet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `/home/robert/research/lei/nano102_activites/crystallography_activity.jsx` into Nano Explorer as a new applet at `src/applets/crystallography/`, built with a real Vite + React pipeline, wired into the landing page grid.

**Architecture:** Add `react`, `react-dom`, `three` as runtime deps and `@vitejs/plugin-react` as a build dep. Add a new Vite multi-page entry (`src/applets/crystallography/index.html` → `main.jsx` → `App.jsx`). `App.jsx` is the original component copied verbatim (it already imports `three` the same way Vite resolves it, so no logic changes are needed — only the shared site-header wrapper is added around it in `index.html`). Add a matching card to the root `index.html` landing page grid.

**Tech Stack:** Vite 5 (existing), React 18, Three.js, `@vitejs/plugin-react`. No test framework exists in this repo (no jest/vitest, no `test` script) — verification is done by running the dev server and driving the page in a real headless browser via the `playwright` npm package directly (added as a devDependency in Task 1), matching how the existing DLVO/vdW/Derjaguin applets are verified in this project. **Do not use the Playwright MCP tool (`mcp__playwright__browser_*`)** — it is broken in this environment (defaults to launching real Google Chrome, which isn't installed and can't be installed without root). Write a plain node script that does `import { chromium } from "playwright"` and run it with `node <script>.mjs` from inside `/home/robert/research/nano-explorer` (Node resolves `node_modules` relative to the script's own location, so the script must live under the repo, e.g. in `.superpowers/sdd/`, not `/tmp`).

## Global Constraints

- No changes to the existing DLVO, vdW, or Derjaguin applets.
- No changes to the crystallography component's physics/pedagogy logic (problem set, plane math, feedback text) — copy verbatim.
- No restyling of the component's internal palette (`PAPER`/`INK`/`ROSE`/`STEEL`/`SAGE`/`AMBER`) — only the shared `site-header` wrapper uses the site's navy theme, exactly as on every other applet page.
- Card copy (already approved): icon 💠, banner gradient `linear-gradient(135deg,#fdf6e3,#f0e0c0)`, tag "Crystal Structure", title "Miller Indices", description "Practice translating (hkl) Miller indices into a plane position — drag intercept handles in a rotatable 3D unit cell, including the zero- and negative-index edge cases."
- `npm run build` (via `.github/workflows/deploy.yml`) must continue to produce a working `dist/` with no config changes beyond `vite.config.js`.

---

### Task 1: Wire up the Vite + React build pipeline with a placeholder page

**Files:**
- Modify: `package.json` (via `npm install`, not hand-edited)
- Modify: `vite.config.js`
- Create: `src/applets/crystallography/index.html`
- Create: `src/applets/crystallography/main.jsx`
- Create: `src/applets/crystallography/App.jsx` (placeholder, replaced in Task 2)

**Interfaces:**
- Produces: a working Vite entry at `src/applets/crystallography/index.html` that mounts a React root into `<div id="root">` via `main.jsx`, rendering whatever `App.jsx` default-exports. Task 2 replaces the body of `App.jsx` only — `main.jsx` and `index.html` are not touched again.

- [ ] **Step 1: Install runtime and build dependencies**

Run:
```bash
cd /home/robert/research/nano-explorer
npm install react react-dom three
npm install -D @vitejs/plugin-react
```

Expected: `package.json` gains `"react"`, `"react-dom"`, `"three"` under `dependencies` and `"@vitejs/plugin-react"` under `devDependencies`; `package-lock.json` updates; exit code 0.

- [ ] **Step 2: Verify install**

Run: `cat package.json`
Expected: a `"dependencies"` block containing `react`, `react-dom`, `three`, and `@vitejs/plugin-react` present under `"devDependencies"` alongside `"vite"`.

- [ ] **Step 3: Add the React plugin and new entry to `vite.config.js`**

Replace the full contents of `vite.config.js` with:

```javascript
import { defineConfig } from 'vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/nano-explorer/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dlvo:      resolve(__dirname, 'src/applets/dlvo/index.html'),
        derjaguin: resolve(__dirname, 'src/applets/derjaguin/index.html'),
        crystallography: resolve(__dirname, 'src/applets/crystallography/index.html'),
      },
    },
  },
})
```

- [ ] **Step 4: Create the placeholder `App.jsx`**

Create `src/applets/crystallography/App.jsx`:

```jsx
export default function App() {
  return <h1>Crystallography placeholder</h1>;
}
```

- [ ] **Step 5: Create `main.jsx`**

Create `src/applets/crystallography/main.jsx`:

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

- [ ] **Step 6: Create `index.html`**

Create `src/applets/crystallography/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Miller Indices — Nano Explorer</title>
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

- [ ] **Step 7: Start the dev server and verify the placeholder renders**

Run: `npm run dev -- --port 5173` in the background (or in a separate terminal).

Then, using a browser (Playwright MCP `browser_navigate`/`browser_snapshot` if available, otherwise any browser):
- Navigate to `http://localhost:5173/nano-explorer/src/applets/crystallography/`
- Confirm the navy `site-header` bar with "Nano Explorer" / "← All applets" is visible.
- Confirm "Crystallography placeholder" text renders below it.
- Check the browser console (`browser_console_messages` if using Playwright) for zero errors.

Expected: page loads, no console errors, placeholder heading visible under the site header.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vite.config.js src/applets/crystallography/
git commit -m "Add Vite+React build pipeline for crystallography applet (placeholder)"
```

---

### Task 2: Port the full component

**Files:**
- Modify: `src/applets/crystallography/App.jsx` (replace placeholder with the real component)

**Interfaces:**
- Consumes: nothing new — `main.jsx` already imports `App` as the default export from `./App.jsx` (Task 1), which is preserved.
- Produces: the fully interactive crystallography tutor at the same mount point Task 1 established.

- [ ] **Step 1: Copy the source file verbatim**

Run:
```bash
cp /home/robert/research/lei/nano102_activites/crystallography_activity.jsx /home/robert/research/nano-explorer/src/applets/crystallography/App.jsx
```

- [ ] **Step 2: Verify the copy is byte-identical to the source**

Run: `diff /home/robert/research/lei/nano102_activites/crystallography_activity.jsx /home/robert/research/nano-explorer/src/applets/crystallography/App.jsx`
Expected: no output (files identical).

- [ ] **Step 3: Confirm the component still default-exports `App`**

Run: `grep -n "export default function App" /home/robert/research/nano-explorer/src/applets/crystallography/App.jsx`
Expected: one match, confirming `main.jsx`'s `import App from "./App.jsx"` still resolves correctly (no edit needed here).

- [ ] **Step 4: Restart the dev server and verify full interactivity with a Playwright script**

Run: `npm run dev -- --port 5173` (restart if it was already running, so the new `App.jsx` is picked up).

Create `/home/robert/research/nano-explorer/.superpowers/sdd/task-2-verify.mjs` (this is a throwaway verification script, not part of the app — do not add it to git):

```javascript
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto("http://localhost:5173/nano-explorer/src/applets/crystallography/");
await page.waitForTimeout(600);
await page.screenshot({ path: ".superpowers/sdd/task-2-01-initial.png" });

// Canvas should render non-trivial pixel content (not a blank/black box).
const canvasBox = await page.locator("canvas").boundingBox();
console.log("canvas box:", JSON.stringify(canvasBox));

// Drag on empty canvas space (away from the handle spheres) to rotate the view.
const cx = canvasBox.x + canvasBox.width * 0.15;
const cy = canvasBox.y + canvasBox.height * 0.15;
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.mouse.move(cx + 120, cy + 40, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(200);
await page.screenshot({ path: ".superpowers/sdd/task-2-02-rotated.png" });

// Click Check, then Reveal answer, then Next plane — locate by visible button text.
await page.getByRole("button", { name: "Check" }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: ".superpowers/sdd/task-2-03-after-check.png" });

await page.getByRole("button", { name: "Reveal answer" }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: ".superpowers/sdd/task-2-04-revealed.png" });

await page.getByRole("button", { name: "Next plane" }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: ".superpowers/sdd/task-2-05-next-problem.png" });

console.log("console/page errors:", JSON.stringify(errors));
await browser.close();
```

Run: `node .superpowers/sdd/task-2-verify.mjs`

Then:
- Read each of the five screenshots (`.superpowers/sdd/task-2-0N-*.png`) with the Read tool and visually confirm: a real 3D unit cell renders (not blank/black) in the first two, the view visibly rotated between screenshots 1 and 2, feedback text appears after "Check" in screenshot 3, the green target plane + comparison table appear in screenshot 4, and the Miller index / problem chip changed in screenshot 5 (compare its task card text against screenshot 1's).
- Confirm the script printed `console/page errors: []` (or only expected debug/info noise, no actual errors).
- Delete the screenshots and the verification script afterward (`rm .superpowers/sdd/task-2-*.png .superpowers/sdd/task-2-verify.mjs`) — they are throwaway, not part of the commit.

Expected: all interactions work exactly as they did in the original standalone component; no console errors; screenshots visually confirm correct rendering at each step.

- [ ] **Step 5: Commit**

```bash
git add src/applets/crystallography/App.jsx
git commit -m "Port crystallography plane-placement tutor into Nano Explorer"
```

---

### Task 3: Add the landing page card

**Files:**
- Modify: `index.html` (root landing page)

**Interfaces:**
- Consumes: the applet URL path established in Task 1 (`/nano-explorer/src/applets/crystallography/`).
- Produces: nothing consumed by later tasks — this is the last content task.

- [ ] **Step 1: Insert the new card into the grid**

In `index.html`, insert this card immediately after the Derjaguin card (after the closing `</a>` that follows `Derjaguin Approximation`'s `card-footer`, and before the first `<div class="card soon">` for Brownian Diffusion):

```html
  <a class="card" href="/nano-explorer/src/applets/crystallography/">
    <div class="card-banner" style="background: linear-gradient(135deg,#fdf6e3,#f0e0c0);">💠</div>
    <div class="card-body">
      <div class="card-tag">Crystal Structure</div>
      <div class="card-title">Miller Indices</div>
      <div class="card-desc">
        Practice translating (hkl) Miller indices into a plane position —
        drag intercept handles in a rotatable 3D unit cell, including the
        zero- and negative-index edge cases.
      </div>
    </div>
    <div class="card-footer">Open applet</div>
  </a>

```

- [ ] **Step 2: Verify the card renders on the landing page**

With `npm run dev -- --port 5173` running, create and run a throwaway verification script the
same way as Task 2 Step 4 (plain node script under `.superpowers/sdd/`, using
`import { chromium } from "playwright"` — do NOT use the Playwright MCP tool, see the plan's
Tech Stack section for why). It should:
- Navigate to `http://localhost:5173/nano-explorer/`.
- Take a screenshot and confirm (via the Read tool, visually) a new card appears after
  "Derjaguin Approximation" and before "Brownian Diffusion", with the 💠 icon on a cream
  gradient banner, tag "Crystal Structure", title "Miller Indices", and the description text.
- Click the new card's link (`page.getByRole("link").filter({ hasText: "Miller Indices" })`
  or similar) and confirm the resulting URL is `.../src/applets/crystallography/` and the
  crystallography page loads (e.g. check `page.url()` after the click).
- Collect console/pageerror events the same way as Task 2 Step 4 and confirm none.
- Delete the screenshot and script afterward.

Expected: card renders correctly, link navigates successfully, no console errors.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Add Miller Indices card to landing page"
```

---

### Task 4: Production build verification

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Produces: confirmation that `.github/workflows/deploy.yml`'s `npm ci && npm run build` will succeed on this branch.

- [ ] **Step 1: Run a clean production build**

Run:
```bash
cd /home/robert/research/nano-explorer
npm run build
```

Expected: exit code 0; output includes `dist/src/applets/crystallography/index.html` among the built files, alongside `dist/index.html`, `dist/src/applets/dlvo/index.html`, `dist/src/applets/derjaguin/index.html`.

- [ ] **Step 2: Confirm the built files exist**

Run: `ls dist/src/applets/crystallography/`
Expected: `index.html` present, plus a hashed JS bundle referenced from it (check with `grep -o 'src="[^"]*"' dist/src/applets/crystallography/index.html`).

- [ ] **Step 3: Serve the production build and smoke-test it**

Run: `npm run preview -- --port 4173` in the background.

Using the same node+playwright script approach as Tasks 2/3 (NOT the Playwright MCP tool):
- Navigate to `http://localhost:4173/nano-explorer/`, screenshot and confirm the Miller Indices card is present.
- Click through to the crystallography applet, confirm the 3D scene renders (canvas bounding box present, screenshot shows non-blank content) and at least one drag-to-rotate interaction works (screenshot before/after a canvas drag differ), with zero console errors.
- Delete the screenshots and script afterward.

Expected: identical behavior to the dev-server checks in Task 2/3, confirming the production bundle works, not just the dev server.

- [ ] **Step 4: Stop the preview/dev servers**

Stop any background `npm run dev` / `npm run preview` processes started during this plan.

- [ ] **Step 5: Final commit (if anything changed)**

If Task 4 required no file changes, there is nothing to commit here — this task is verification-only. If any fix was needed during verification, commit it with a message describing the fix.
