# MO Atomic-Orbital (LCAO) Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let students add s/p atomic orbitals (per atom, left/right of the canvas) that combine into the molecular orbitals, and have `Check diagram` grade the atomic side alongside the MO column.

**Architecture:** Extend the existing single-file React applet. Nodes gain a `role` (`"mo"`/`"ao"`) and a new 3-slot `"trip"` type for atomic p. The pure `evaluate()` splits nodes by role, keeps the MO-column grading unchanged, and delegates atomic-side grading to a new pure, exported `gradeAtomicOrbitals()` so the grading logic can be unit-tested directly in Node. Content lives in `molecules.js` as a per-molecule `atoms` block.

**Tech Stack:** React 19, Vite 5, inline styles. No new dependencies. Verification via `vite build`, Node scripts importing the pure functions, and Playwright (npm package direct).

## Global Constraints

- No new dependencies.
- Do not change the MO-column grading behavior, the molecule set, the site integration, or the applet's internal `theme`.
- Applet files only: `src/applets/mo-diagrams/App.jsx` and `src/applets/mo-diagrams/molecules.js`.
- Repo has pre-existing unrelated working-tree changes (`src/applets/derjaguin/index.html`, untracked `.claude/`, `derjaguin_approximation.html`, `.superpowers/` scratch). Commit ONLY the files each task names.
- Browser/Node verification uses the `playwright`/module imports directly (Playwright MCP is broken in this WSL setup). Node ESM can't resolve deps from outside the repo tree — create a temp symlink `<scratchpad>/node_modules` → the repo's `node_modules` for scratch scripts and remove it after. Scratch scripts go in the session scratchpad, not the repo.
- Grading model (from the approved spec `docs/superpowers/specs/2026-07-16-mo-atomic-orbitals-design.md`):
  - Atom assignment by x-position: node center (`x + w/2`) < `canvasWidth/2` → left group, else right group. Orientation is arbitrary — grading tries both atom↔side assignments and accepts either.
  - Neutral molecules (BN, HF) → `config` mode: per-orbital occupancy + Hund's on p/π sets.
  - Ion molecules (C₂²⁻, C₂⁺, NO⁻) → `total` mode: correct AO *set* per side + grand total of atomic electrons = `atoms.total`; per-orbital placement not graded.
  - Hund's expected-singles: for a set with `cap` orbitals (deg cap=2, trip cap=3) at occupancy `n`: `n <= cap ? n : 2*cap - n`.

---

### Task 1: Add `atoms` content blocks to all five molecules

**Files:**
- Modify: `src/applets/mo-diagrams/molecules.js`
- Test: `<scratchpad>/check-atoms.mjs` (not committed)

**Interfaces:**
- Consumes: nothing.
- Produces: each `MOLECULES[id]` gains an `atoms` object: `{ mode: "config"|"total", total?: number, list: [Atom, Atom] }` where `Atom = { element: string, orbitals: [{ type: "single"|"trip", label: string, alt?: string[], occ?: number }] }`. `occ` is present in `config` mode, absent in `total` mode. `total` is present only in `total` mode and equals `totalValence`. Task 3 consumes these.

- [ ] **Step 1: Write the failing structural test**

Create `<scratchpad>/check-atoms.mjs`:

```js
import { MOLECULES } from "/home/robert/research/nano-explorer/src/applets/mo-diagrams/molecules.js";

const expected = {
  "C2^2-": { mode: "total", total: 10, els: ["C", "C"] },
  "C2^+":  { mode: "total", total: 7,  els: ["C", "C"] },
  "BN":    { mode: "config", els: ["B", "N"] },
  "NO^-":  { mode: "total", total: 12, els: ["N", "O"] },
  "HF":    { mode: "config", els: ["H", "F"] },
};
let ok = true;
for (const [id, exp] of Object.entries(expected)) {
  const a = MOLECULES[id].atoms;
  if (!a) { console.log(`${id}: MISSING atoms`); ok = false; continue; }
  const els = a.list.map((x) => x.element);
  const modeOk = a.mode === exp.mode;
  const elsOk = JSON.stringify(els) === JSON.stringify(exp.els);
  const totalOk = exp.mode === "total" ? a.total === exp.total : a.total === undefined;
  // config molecules must carry occ on every orbital; total molecules must not.
  const occOk = a.list.every((atom) => atom.orbitals.every((o) =>
    exp.mode === "config" ? typeof o.occ === "number" : o.occ === undefined));
  // every orbital has a valid type
  const typeOk = a.list.every((atom) => atom.orbitals.every((o) => o.type === "single" || o.type === "trip"));
  console.log(`${id}: mode ${a.mode} els ${els} total ${a.total} -> ${modeOk && elsOk && totalOk && occOk && typeOk ? "OK" : "FAIL"}`);
  if (!(modeOk && elsOk && totalOk && occOk && typeOk)) ok = false;
}
// config sums check the neutral configs total to totalValence
for (const id of ["BN", "HF"]) {
  const sum = MOLECULES[id].atoms.list.reduce((s, atom) => s + atom.orbitals.reduce((t, o) => t + o.occ, 0), 0);
  const okSum = sum === MOLECULES[id].totalValence;
  console.log(`${id}: config sum ${sum} vs totalValence ${MOLECULES[id].totalValence} -> ${okSum ? "OK" : "FAIL"}`);
  if (!okSum) ok = false;
}
console.log(ok ? "\nATOMS OK" : "\nATOMS FAIL");
process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Run it to verify it fails**

```bash
node <scratchpad>/check-atoms.mjs
```
Expected: FAIL (`MISSING atoms` for every molecule).

- [ ] **Step 3: Add the `atoms` blocks**

In `src/applets/mo-diagrams/molecules.js`, add an `atoms` property to each molecule object (place it just before its `questions:` property). Use these exact values:

For `"C2^2-"`:
```js
    atoms: {
      mode: "total",
      total: 10,
      list: [
        { element: "C", orbitals: [{ type: "single", label: "2s" }, { type: "trip", label: "2p" }] },
        { element: "C", orbitals: [{ type: "single", label: "2s" }, { type: "trip", label: "2p" }] },
      ],
    },
```

For `"C2^+"`: identical to above but `total: 7`.

For `"BN"`:
```js
    atoms: {
      mode: "config",
      list: [
        { element: "B", orbitals: [{ type: "single", label: "2s", occ: 2 }, { type: "trip", label: "2p", occ: 1 }] },
        { element: "N", orbitals: [{ type: "single", label: "2s", occ: 2 }, { type: "trip", label: "2p", occ: 3 }] },
      ],
    },
```

For `"NO^-"`:
```js
    atoms: {
      mode: "total",
      total: 12,
      list: [
        { element: "N", orbitals: [{ type: "single", label: "2s" }, { type: "trip", label: "2p" }] },
        { element: "O", orbitals: [{ type: "single", label: "2s" }, { type: "trip", label: "2p" }] },
      ],
    },
```

For `"HF"`:
```js
    atoms: {
      mode: "config",
      list: [
        { element: "H", orbitals: [{ type: "single", label: "1s", occ: 1 }] },
        { element: "F", orbitals: [{ type: "single", label: "2s", occ: 2 }, { type: "trip", label: "2p", occ: 5 }] },
      ],
    },
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
node <scratchpad>/check-atoms.mjs
```
Expected: prints `OK` for every molecule and `ATOMS OK`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/applets/mo-diagrams/molecules.js
git commit -m "Add atomic-orbital (atoms) content blocks to MO molecules"
```

---

### Task 2: Node model, `trip` type, toolbar buttons, and hint

**Files:**
- Modify: `src/applets/mo-diagrams/App.jsx`
- Test: `<scratchpad>/ao-ui.mjs` (not committed)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: nodes carry `role: "mo"|"ao"` and (for `trip`) `eC`. `addNode(spec)` takes `{ type, role, label }`. `levelElectrons` handles `trip`. `LevelNode` renders 1/2/3 slots for single/deg/trip. Toolbar has `+ s orbital` and `+ p orbital`. Task 3 consumes the updated `levelElectrons` and the `role` field.

- [ ] **Step 1: Update `levelElectrons` for `trip`**

Replace (current line ~207):
```js
const levelElectrons = (n) => (n.type === "deg" ? n.eA + n.eB : n.e);
```
with:
```js
const levelElectrons = (n) =>
  n.type === "deg" ? n.eA + n.eB : n.type === "trip" ? n.eA + n.eB + n.eC : n.e;
```

- [ ] **Step 2: Update `addNode` to take a descriptor and set role/eC/spawn side**

Replace the current `addNode` (lines ~308-319):
```js
  const addNode = (type) => {
    const w = type === "deg" ? 120 : 90;
    const cw = canvasRef.current ? canvasRef.current.clientWidth : 600;
    const id = "n" + (uid + 1);
    patch({
      uid: uid + 1,
      nodes: [
        ...nodes,
        { id, type, x: cw / 2 - w / 2, y: 60 + (nodes.length * 46) % 320, w, label: type === "deg" ? "π2p" : "σ2s", e: 0, eA: 0, eB: 0 },
      ],
    });
  };
```
with:
```js
  const addNode = ({ type, role, label }) => {
    const w = type === "trip" ? 150 : type === "deg" ? 120 : 90;
    const cw = canvasRef.current ? canvasRef.current.clientWidth : 600;
    const id = "n" + (uid + 1);
    // AO nodes spawn near the left edge so the student drags them into the
    // correct atom column; MO nodes spawn centred.
    const x = role === "ao" ? 20 : cw / 2 - w / 2;
    patch({
      uid: uid + 1,
      nodes: [
        ...nodes,
        { id, type, role, x, y: 60 + (nodes.length * 46) % 320, w, label, e: 0, eA: 0, eB: 0, eC: 0 },
      ],
    });
  };
```

- [ ] **Step 3: Update `cycle` to handle the third slot**

Replace the current `cycle` (lines ~321-330):
```js
  const cycle = (node, half) => {
    setFlagged(new Set());
    patch({
      nodes: nodes.map((n) => {
        if (n.id !== node.id) return n;
        if (n.type === "deg") return half === 0 ? { ...n, eA: (n.eA + 1) % 3 } : { ...n, eB: (n.eB + 1) % 3 };
        return { ...n, e: (n.e + 1) % 3 };
      }),
    });
  };
```
with:
```js
  const cycle = (node, slot) => {
    setFlagged(new Set());
    patch({
      nodes: nodes.map((n) => {
        if (n.id !== node.id) return n;
        if (n.type === "deg" || n.type === "trip") {
          if (slot === 0) return { ...n, eA: (n.eA + 1) % 3 };
          if (slot === 1) return { ...n, eB: (n.eB + 1) % 3 };
          return { ...n, eC: (n.eC + 1) % 3 };
        }
        return { ...n, e: (n.e + 1) % 3 };
      }),
    });
  };
```

- [ ] **Step 4: Update `LevelNode` to render 2 or 3 slots**

Replace the `node.type === "deg" ? (...) : (...)` block in `LevelNode` (lines ~156-177):
```jsx
      {node.type === "deg" ? (
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          {[0, 1].map((half) => {
            const e = half === 0 ? node.eA : node.eB;
            return (
              <div key={half} onClick={() => onCycle(node, half)} style={{ width: 44, cursor: "pointer" }}>
                <div style={{ height: 20, display: "flex", justifyContent: "center", alignItems: "center" }}>
                  <Arrows up={e >= 1} down={e >= 2} />
                </div>
                <div style={{ height: 2, background: theme.borderStrong }} />
              </div>
            );
          })}
        </div>
      ) : (
        <div onClick={() => onCycle(node)} style={{ cursor: "pointer" }}>
          <div style={{ height: 20, display: "flex", justifyContent: "center", alignItems: "center" }}>
            <Arrows up={node.e >= 1} down={node.e >= 2} />
          </div>
          <div style={{ height: 2, background: theme.borderStrong }} />
        </div>
      )}
```
with:
```jsx
      {node.type === "deg" || node.type === "trip" ? (
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          {(node.type === "trip" ? [0, 1, 2] : [0, 1]).map((slot) => {
            const e = slot === 0 ? node.eA : slot === 1 ? node.eB : node.eC;
            return (
              <div key={slot} onClick={() => onCycle(node, slot)} style={{ width: 40, cursor: "pointer" }}>
                <div style={{ height: 20, display: "flex", justifyContent: "center", alignItems: "center" }}>
                  <Arrows up={e >= 1} down={e >= 2} />
                </div>
                <div style={{ height: 2, background: theme.borderStrong }} />
              </div>
            );
          })}
        </div>
      ) : (
        <div onClick={() => onCycle(node)} style={{ cursor: "pointer" }}>
          <div style={{ height: 20, display: "flex", justifyContent: "center", alignItems: "center" }}>
            <Arrows up={node.e >= 1} down={node.e >= 2} />
          </div>
          <div style={{ height: 2, background: theme.borderStrong }} />
        </div>
      )}
```

- [ ] **Step 5: Update the toolbar buttons**

Replace the two MO buttons (lines ~424-425):
```jsx
        <Button onClick={() => addNode("single")}>+ σ level</Button>
        <Button onClick={() => addNode("deg")}>+ π level (degenerate)</Button>
```
with the MO buttons (using the new descriptor form) plus the two AO buttons:
```jsx
        <Button onClick={() => addNode({ type: "single", role: "mo", label: "σ2s" })}>+ σ level</Button>
        <Button onClick={() => addNode({ type: "deg", role: "mo", label: "π2p" })}>+ π level (degenerate)</Button>
        <Button onClick={() => addNode({ type: "single", role: "ao", label: "2s" })}>+ s orbital</Button>
        <Button onClick={() => addNode({ type: "trip", role: "ao", label: "2p" })}>+ p orbital</Button>
```

- [ ] **Step 6: Update the default hint text**

Replace the initial hint (current line ~298):
```js
  const [hint, setHint] = useState("Add a level, drag it to set its energy, click the line for electrons, double-click the label to rename.");
```
with:
```js
  const [hint, setHint] = useState("Build the MOs down the centre (lowest energy at the bottom) and the atomic orbitals on the sides: one atom's on the left, the other's on the right. Drag to position, click a line for electrons, double-click a label to rename.");
```

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: `✓ built` with no errors.

- [ ] **Step 8: Write the Playwright UI test**

Create `<scratchpad>/ao-ui.mjs` (start preview separately, see Step 9):

```js
import { chromium } from "playwright";
const URL = "http://localhost:4180/nano-explorer/src/applets/mo-diagrams/";
const b = await chromium.launch();
const p = await b.newPage();
await p.setViewportSize({ width: 1200, height: 900 });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await p.goto(URL, { waitUntil: "networkidle" });

// AO buttons exist.
await p.getByRole("button", { name: "+ s orbital" }).click();
await p.getByRole("button", { name: "+ p orbital" }).click();

// The p AO is a 3-slot node (width 150). Its clickable slots are the three
// short lines. Confirm the node exists and has three fillable slots.
const pnode = p.locator('div[style*="position: absolute"][style*="width: 150px"]').first();
await pnode.waitFor();
const slots = pnode.locator('div[style*="cursor: pointer"]');
const slotCount = await slots.count();
console.log("p-orbital slot count:", slotCount, slotCount === 3 ? "OK" : "FAIL");

// Fill the three slots once each (single electron each -> Hund-style).
for (let i = 0; i < 3; i++) await slots.nth(i).click();
// Each slot now shows an up arrow.
const arrows = await pnode.locator("span", { hasText: "↑" }).count();
console.log("up arrows after one click each:", arrows);

// s AO is a single-slot node (width 90).
const snode = p.locator('div[style*="position: absolute"][style*="width: 90px"]').first();
await snode.waitFor();

await b.close();
const ok = slotCount === 3 && arrows >= 3 && errs.length === 0;
console.log("console errors:", errs.length);
console.log(ok ? "AO-UI OK" : "AO-UI FAIL");
process.exit(ok ? 0 : 1);
```

- [ ] **Step 9: Run the UI test to verify it passes**

```bash
npm run build
npm run preview -- --port 4180 >/dev/null 2>&1 &
PV=$!; sleep 2
ln -sfn "$PWD/node_modules" <scratchpad>/node_modules
node <scratchpad>/ao-ui.mjs; ST=$?
rm -f <scratchpad>/node_modules; kill $PV 2>/dev/null
exit $ST
```
Expected: `p-orbital slot count: 3 OK`, up arrows ≥ 3, `console errors: 0`, `AO-UI OK`, exit 0.

- [ ] **Step 10: Commit**

```bash
git add src/applets/mo-diagrams/App.jsx
git commit -m "Add atomic-orbital node model: trip type, AO buttons, hint"
```

---

### Task 3: Atomic-side grading in `evaluate`

**Files:**
- Modify: `src/applets/mo-diagrams/App.jsx`
- Test: `<scratchpad>/grade-ao.mjs` (not committed)

**Interfaces:**
- Consumes: `atoms` blocks (Task 1); `levelElectrons`/`role` (Task 2).
- Produces: exported `gradeAtomicOrbitals(mol, aoNodes, canvasWidth) -> { items, flagged }` (pure). `evaluate(mol, nodes, canvasWidth)` is exported and now grades AO nodes too. `check()` passes the canvas width.

- [ ] **Step 1: Write the failing grading unit test**

Create `<scratchpad>/grade-ao.mjs`:

```js
import { MOLECULES } from "/home/robert/research/nano-explorer/src/applets/mo-diagrams/molecules.js";
import { gradeAtomicOrbitals } from "/home/robert/research/nano-explorer/src/applets/mo-diagrams/App.jsx";

const CW = 600; // center 300
let id = 0;
// side: "L" -> x=20, "R" -> x=450. type sets width.
const ao = (type, label, side, e) => {
  const w = type === "trip" ? 150 : 90;
  const n = { id: "a" + ++id, type, role: "ao", label, w, x: side === "L" ? 20 : 450, y: 100, e: 0, eA: 0, eB: 0, eC: 0 };
  if (type === "single") n.e = e;
  else { n.eA = e[0]; n.eB = e[1]; n.eC = e[2] ?? 0; }
  return n;
};
const kinds = (r) => r.items.map((i) => i.kind);
let pass = true;
const check = (name, cond) => { console.log(`${cond ? "ok  " : "FAIL"} ${name}`); if (!cond) pass = false; };

// --- HF (config): H 1s^1 | F 2s^2 2p^5 ---
const hf = MOLECULES["HF"];
let r = gradeAtomicOrbitals(hf, [
  ao("single", "1s", "L", 1),
  ao("single", "2s", "R", 2),
  ao("trip", "2p", "R", [2, 2, 1]),
], CW);
check("HF correct -> no items", r.items.length === 0);

// HF wrong: F 2s only 1 electron
r = gradeAtomicOrbitals(hf, [
  ao("single", "1s", "L", 1),
  ao("single", "2s", "R", 1),
  ao("trip", "2p", "R", [2, 2, 1]),
], CW);
check("HF wrong occ -> warn", kinds(r).includes("warn"));

// HF orientation swapped (F left, H right) -> still correct
r = gradeAtomicOrbitals(hf, [
  ao("single", "2s", "L", 2),
  ao("trip", "2p", "L", [2, 2, 1]),
  ao("single", "1s", "R", 1),
], CW);
check("HF orientation-swapped -> no items", r.items.length === 0);

// HF set error: put a 2p on the H side
r = gradeAtomicOrbitals(hf, [
  ao("single", "1s", "L", 1),
  ao("trip", "2p", "L", [0, 0, 0]),
  ao("single", "2s", "R", 2),
  ao("trip", "2p", "R", [2, 2, 1]),
], CW);
check("HF set error -> danger", kinds(r).includes("danger"));

// --- BN (config): B 2s^2 2p^1 | N 2s^2 2p^3 ---
const bn = MOLECULES["BN"];
r = gradeAtomicOrbitals(bn, [
  ao("single", "2s", "L", 2), ao("trip", "2p", "L", [1, 0, 0]),
  ao("single", "2s", "R", 2), ao("trip", "2p", "R", [1, 1, 1]),
], CW);
check("BN correct -> no items", r.items.length === 0);

// BN Hund's violation on N 2p^3 (2,1,0 = 3 e but only 1 single)
r = gradeAtomicOrbitals(bn, [
  ao("single", "2s", "L", 2), ao("trip", "2p", "L", [1, 0, 0]),
  ao("single", "2s", "R", 2), ao("trip", "2p", "R", [2, 1, 0]),
], CW);
check("BN Hund's violation -> warn", kinds(r).includes("warn"));

// --- C2^2- (total, 10): set + grand total only ---
const c2 = MOLECULES["C2^2-"];
r = gradeAtomicOrbitals(c2, [
  ao("single", "2s", "L", 2), ao("trip", "2p", "L", [2, 2, 1]), // 7 on left C
  ao("single", "2s", "R", 2), ao("trip", "2p", "R", [1, 0, 0]), // 3 on right C -> total 10
], CW);
check("C2^2- total=10 -> no items", r.items.length === 0);

// C2^2- wrong total (8)
r = gradeAtomicOrbitals(c2, [
  ao("single", "2s", "L", 2), ao("trip", "2p", "L", [2, 0, 0]),
  ao("single", "2s", "R", 2), ao("trip", "2p", "R", [2, 0, 0]),
], CW);
check("C2^2- wrong total -> warn", kinds(r).includes("warn"));

// no AO nodes -> prompt
r = gradeAtomicOrbitals(c2, [], CW);
check("no AO nodes -> warn prompt", kinds(r).includes("warn"));

console.log(pass ? "\nGRADE-AO OK" : "\nGRADE-AO FAIL");
process.exit(pass ? 0 : 1);
```

- [ ] **Step 2: Run it to verify it fails**

```bash
ln -sfn "$PWD/node_modules" <scratchpad>/node_modules
node <scratchpad>/grade-ao.mjs; rm -f <scratchpad>/node_modules
```
Expected: FAIL — `gradeAtomicOrbitals` is not exported yet (import error / not a function).

- [ ] **Step 3: Add the pure grading helpers and export them**

In `src/applets/mo-diagrams/App.jsx`, immediately BEFORE the `function evaluate(` line (~209, after `levelElectrons`), insert:

```js
// Match one side's AO nodes against an atom's expected orbital set.
// Returns { setOk, occOk, flagged:Set } — occ/Hund's only checked in config mode.
function matchAtomSide(groupNodes, atom, mode) {
  const flagged = new Set();
  const used = new Array(atom.orbitals.length).fill(null);
  const extra = [];
  groupNodes.forEach((n) => {
    const oi = atom.orbitals.findIndex(
      (o, i) => used[i] === null && n.type === o.type && matchesKeyLabel(n.label, o)
    );
    if (oi >= 0) used[oi] = n;
    else extra.push(n);
  });
  const missing = atom.orbitals.filter((_, i) => used[i] === null);
  const setOk = missing.length === 0 && extra.length === 0;
  extra.forEach((n) => flagged.add(n.id));
  let occOk = true;
  if (setOk && mode === "config") {
    atom.orbitals.forEach((o, i) => {
      const n = used[i];
      const occ = levelElectrons(n);
      if (occ !== o.occ) {
        flagged.add(n.id);
        occOk = false;
        return;
      }
      if (o.type === "deg" || o.type === "trip") {
        const slots = o.type === "trip" ? [n.eA, n.eB, n.eC] : [n.eA, n.eB];
        const singles = slots.filter((x) => x === 1).length;
        const cap = o.type === "trip" ? 3 : 2;
        const expected = occ <= cap ? occ : 2 * cap - occ;
        if (singles !== expected) {
          flagged.add(n.id);
          occOk = false;
        }
      }
    });
  }
  return { setOk, occOk, flagged };
}

// Grade the atomic-orbital side. Pure; exported for unit testing.
export function gradeAtomicOrbitals(mol, aoNodes, canvasWidth) {
  const items = [];
  const flagged = new Set();
  if (!mol.atoms) return { items, flagged };

  if (aoNodes.length === 0) {
    items.push({
      kind: "warn",
      text: "Now add the atomic orbitals that combine to form these MOs: place one atom's orbitals on the left, the other atom's on the right.",
    });
    return { items, flagged };
  }

  const center = (canvasWidth || 600) / 2;
  const left = aoNodes.filter((n) => n.x + n.w / 2 < center);
  const right = aoNodes.filter((n) => n.x + n.w / 2 >= center);
  const [atom0, atom1] = mol.atoms.list;
  const mode = mol.atoms.mode;

  // Orientation is arbitrary: try both atom-to-side assignments.
  const orientations = [
    { L: matchAtomSide(left, atom0, mode), R: matchAtomSide(right, atom1, mode) },
    { L: matchAtomSide(left, atom1, mode), R: matchAtomSide(right, atom0, mode) },
  ];
  const score = (o) =>
    (o.L.setOk ? 2 : 0) + (o.R.setOk ? 2 : 0) + (o.L.occOk ? 1 : 0) + (o.R.occOk ? 1 : 0);
  const chosen = orientations.reduce((best, o) => (score(o) > score(best) ? o : best), orientations[0]);

  if (!(chosen.L.setOk && chosen.R.setOk)) {
    chosen.L.flagged.forEach((id) => flagged.add(id));
    chosen.R.flagged.forEach((id) => flagged.add(id));
    const wantSets = mol.atoms.list
      .map((a) => `${a.element} {${a.orbitals.map((o) => o.label).join(", ")}}`)
      .join(" and ");
    items.push({
      kind: "danger",
      text: `The atomic-orbital sides don't match the two atoms. Expected ${wantSets} — put one atom's orbitals on the left and the other's on the right.`,
    });
    return { items, flagged };
  }

  if (mode === "config") {
    if (!(chosen.L.occOk && chosen.R.occOk)) {
      chosen.L.flagged.forEach((id) => flagged.add(id));
      chosen.R.flagged.forEach((id) => flagged.add(id));
      items.push({
        kind: "warn",
        text: "The atomic orbitals are right, but some atomic electron configurations are off. Use each atom's neutral ground-state configuration, and within a p set put one electron in each of px, py, pz before pairing (Hund's rule).",
      });
    }
  } else {
    const aoTotal = aoNodes.reduce((s, n) => s + levelElectrons(n), 0);
    if (aoTotal !== mol.atoms.total) {
      items.push({
        kind: "warn",
        text: `The atomic orbitals are right, but you have placed ${aoTotal} atomic electrons; the two atoms together should bring ${mol.atoms.total}. (Which atomic orbital holds the charge isn't graded — only the total.)`,
      });
    }
  }
  return { items, flagged };
}
```

- [ ] **Step 4: Split `evaluate` by role, layer in AO grading, and export it**

Replace the `evaluate` function header and the electron-total block. Change the signature line:
```js
function evaluate(mol, nodes) {
  const items = [];
  const flagged = new Set();
  const ordered = [...nodes].sort((a, b) => b.y - a.y); // bottom -> top
  const total = ordered.reduce((s, n) => s + levelElectrons(n), 0);

  if (total !== mol.totalValence) {
    items.push({
      kind: "warn",
      text: `You have placed ${total} electrons; ${mol.title} needs ${mol.totalValence}. ${mol.electronNote} Fill from the bottom up.`,
    });
  }
```
with:
```js
export function evaluate(mol, nodes, canvasWidth) {
  const items = [];
  const flagged = new Set();
  const moNodes = nodes.filter((n) => (n.role || "mo") !== "ao");
  const aoNodes = nodes.filter((n) => n.role === "ao");
  const ordered = [...moNodes].sort((a, b) => b.y - a.y); // bottom -> top
  const total = ordered.reduce((s, n) => s + levelElectrons(n), 0);

  if (total !== mol.totalValence) {
    items.push({
      kind: "warn",
      text: `You have placed ${total} electrons in the molecular orbitals; ${mol.title} needs ${mol.totalValence}. ${mol.electronNote} Fill from the bottom up.`,
    });
  }
```

Then, immediately BEFORE the final success block:
```js
  const solved = items.length === 0;
  if (solved)
    items.push({ kind: "ok", text: `Diagram matches the accepted solution. Bond order is ${mol.bondOrder}. Now answer the questions below.` });

  return { solved, flagged, items };
}
```
insert the AO grading call so it becomes:
```js
  const ao = gradeAtomicOrbitals(mol, aoNodes, canvasWidth);
  ao.items.forEach((it) => items.push(it));
  ao.flagged.forEach((id) => flagged.add(id));

  const solved = items.length === 0;
  if (solved)
    items.push({ kind: "ok", text: `Diagram matches the accepted solution. Bond order is ${mol.bondOrder}. Now answer the questions below.` });

  return { solved, flagged, items };
}
```

(All the MO checks between — missing/unmatched/order/occupancy — are unchanged; they already operate on `ordered`, which is now derived from `moNodes`.)

- [ ] **Step 5: Pass canvas width from `check()`**

Replace the first line of `check` (~393):
```js
  const check = () => {
    const res = evaluate(mol, nodes);
```
with:
```js
  const check = () => {
    const cw = canvasRef.current ? canvasRef.current.clientWidth : 600;
    const res = evaluate(mol, nodes, cw);
```

- [ ] **Step 6: Run the grading unit test to verify it passes**

```bash
ln -sfn "$PWD/node_modules" <scratchpad>/node_modules
node <scratchpad>/grade-ao.mjs; ST=$?
rm -f <scratchpad>/node_modules
exit $ST
```
Expected: every line `ok`, final `GRADE-AO OK`, exit 0.

- [ ] **Step 7: Build and smoke-check the wired app**

```bash
npm run build
npm run preview -- --port 4181 >/dev/null 2>&1 &
PV=$!; sleep 2
ln -sfn "$PWD/node_modules" <scratchpad>/node_modules
cat > <scratchpad>/ao-wired.mjs <<'JS'
import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage();
await p.setViewportSize({ width: 1200, height: 900 });
await p.goto("http://localhost:4181/nano-explorer/src/applets/mo-diagrams/", { waitUntil: "networkidle" });
// Default molecule is C2^2- (an ion). Add a σ MO and press Check: with no AO
// nodes yet, feedback must include the "add the atomic orbitals" prompt,
// proving evaluate now runs the AO path in the live app.
await p.getByRole("button", { name: "+ σ level" }).click();
await p.getByRole("button", { name: "Check diagram" }).click();
await p.getByText(/atomic orbitals/i).first().waitFor({ timeout: 5000 });
console.log("AO feedback present in live app: OK");
await b.close();
JS
node <scratchpad>/ao-wired.mjs; ST=$?
rm -f <scratchpad>/node_modules; kill $PV 2>/dev/null
exit $ST
```
Expected: `AO feedback present in live app: OK`, exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/applets/mo-diagrams/App.jsx
git commit -m "Grade the atomic-orbital side in evaluate (config + total modes)"
```

---

## Self-Review

**Spec coverage:**
- AO node model + `trip` (px/py/pz) → Task 2. ✓
- Graded incl. electrons; per-orbital+Hund's (config) vs set+total (ion) → Task 3 (`gradeAtomicOrbitals`), Task 1 (`mode`/`occ`/`total`). ✓
- Two labelled atoms, atom-by-x-position, orientation-agnostic → Task 3 (`matchAtomSide` + both orientations). ✓
- Per-molecule configs (BN B 2s²2p¹ / N 2s²2p³; HF H 1s¹ / F 2s²2p⁵; ion totals 10/7/12) → Task 1 table + values. ✓
- Toolbar buttons, spawn side, hint → Task 2. ✓
- MO grading unchanged; AO surfaced as distinct feedback → Task 3 Step 4 (checks operate on `moNodes`; AO items appended). ✓
- `evaluate(mol, nodes, canvasWidth)` + `check()` passes width → Task 3 Steps 4–5. ✓
- Verification: build + Node imports + Playwright → each task. ✓

**Placeholder scan:** `<scratchpad>` is a literal substitution instruction (the session scratchpad path), not an unfilled gap. All code blocks are complete; no TBDs.

**Type consistency:** `addNode({type, role, label})` shape matches all four call sites (Task 2 Step 5). `role` field written in Task 2 is read in Task 3 (`n.role`). `levelElectrons` handles `trip` (Task 2) before Task 3 uses it. `gradeAtomicOrbitals(mol, aoNodes, canvasWidth) -> {items, flagged}` — same name/shape in the export (Task 3 Step 3), the `evaluate` caller (Step 4), and the unit test (Step 1). `atoms` shape (`mode`/`total`/`list[].orbitals[].{type,label,occ}`) is identical across Task 1 content, the Task 1 test, and Task 3's `matchAtomSide`/`gradeAtomicOrbitals`. `matchesKeyLabel(userLabel, keyEntry)` is already imported in App.jsx and used with orbital entries carrying `label`/`alt`.
