# Molecular Orbital applet — atomic-orbital (LCAO) support — design

**Date:** 2026-07-16
**Status:** Approved for planning
**Builds on:** the ported MO Diagrams applet (`src/applets/mo-diagrams/`).

## Goal

Let students add the **atomic orbitals** (s and p) that combine, via LCAO, into
the molecular orbitals — one atom's orbitals on the left, the other's on the
right, the MO column in the centre — and have `Check diagram` grade the atomic
side as well as the MO column.

## Decisions (from brainstorming)

1. **AOs are graded**, including electrons — not just visual scaffolding.
2. **Atomic p** is a **3-slot degenerate set** (px, py, pz), each 0–2 e⁻, so
   Hund's rule is visible and gradeable on the atom.
3. **Two labelled atoms**: an AO belongs to atom A or atom B; each atom's set is
   graded. Atom assignment is **by x-position** — left half of canvas → atom A,
   right half → atom B (orientation is arbitrary; grading accepts either atom on
   either side).
4. **Ion vs neutral grading:**
   - **Neutral molecules (BN, HF) → `config` mode:** grade each atom's neutral
     ground-state config *per orbital*, with Hund's rule on the 2p triplet.
     Atomic total then equals the MO total automatically.
   - **Ions (C₂²⁻, C₂⁺, NO⁻) → `total` mode:** grade the correct AO *set* on each
     side and the *grand total* of atomic electrons (= `totalValence`); do not
     grade per-orbital placement. Atomic total = MO total. (No unique per-orbital
     atomic answer exists for these ions, so per-orbital grading is impossible
     there — this is the deliberate trade-off.)
5. The MO-column grading is **unchanged**; AO checks are layered on top and
   surfaced as distinct feedback messages.

## Node model

Every node gains `role: "mo" | "ao"` (treat a missing `role` as `"mo"` for
safety). A new node **type `"trip"`** represents a 3-orbital p set.

| type     | slots | electron fields | used for            |
|----------|-------|-----------------|---------------------|
| `single` | 1     | `e` (0–2)       | σ MO, **s AO**      |
| `deg`    | 2     | `eA,eB` (0–2)   | π MO                |
| `trip`   | 3     | `eA,eB,eC` (0–2)| **p AO**            |

`levelElectrons(n)`: `single → e`; `deg → eA+eB`; `trip → eA+eB+eC`.

AO nodes drag, link (correlation lines), rename, cycle-fill, and delete exactly
like MO nodes; the only differences are `role`, the `trip` render/fill path, and
that AO nodes are graded by the AO rules below.

## Toolbar & placement

Existing MO buttons unchanged, now tagged `role:"mo"`:
- `+ σ level` → `{type:"single", role:"mo", label:"σ2s", w:90}`
- `+ π level (degenerate)` → `{type:"deg", role:"mo", label:"π2p", w:120}`

New AO buttons, tagged `role:"ao"`:
- `+ s orbital` → `{type:"single", role:"ao", label:"2s", w:90}`
- `+ p orbital` → `{type:"trip", role:"ao", label:"2p", w:150}`

New AO nodes spawn near the **left edge** (so the student drags them into the
correct atom column); MO nodes keep spawning centred. Hint text explains the
layout: atom-A orbitals on the left, atom-B on the right, MOs down the centre,
each column ordered by energy (lowest at the bottom). Default AO labels are `2s`
and `2p`; for HF the hydrogen orbital is renamed to `1s` (double-click), matched
via the existing `alt` list.

## Content layer (`molecules.js`)

Each molecule gains an `atoms` block:

```js
atoms: {
  mode: "config",              // "config" (neutral) | "total" (ion)
  total: 10,                   // total mode only; equals totalValence
  list: [                      // exactly two atoms; orientation-agnostic
    { element: "C",
      orbitals: [
        { type: "single", label: "2s", alt: ["sigma2s"], occ: 2 },
        { type: "trip",   label: "2p", occ: 2 },
      ] },
    { element: "C",
      orbitals: [ /* same for the second carbon */ ] },
  ],
}
```

`occ` is required in `config` mode and ignored in `total` mode (only the orbital
set matters there). Per-molecule values:

| Molecule | mode   | atom A            | atom B            | total |
|----------|--------|-------------------|-------------------|-------|
| C₂²⁻     | total  | C {2s,2p}         | C {2s,2p}         | 10    |
| C₂⁺      | total  | C {2s,2p}         | C {2s,2p}         | 7     |
| BN       | config | B 2s² 2p¹         | N 2s² 2p³         | (8)   |
| NO⁻      | total  | N {2s,2p}         | O {2s,2p}         | 12    |
| HF       | config | H 1s¹             | F 2s² 2p⁵         | (8)   |

Hund's expected-singles for a `trip` at occupancy `n`: `n ≤ 3 ? n : 6 − n`
(so 2p¹→1, 2p³→3, 2p⁵→1). Existing `deg` Hund's check (`n ≤ 2 ? n : 4 − n`) is
unchanged.

## Grading (`evaluate`)

Signature changes to `evaluate(mol, nodes, canvasWidth)` (the caller passes
`canvasRef.current.clientWidth`). Behaviour:

1. Split `nodes` into `moNodes` (`role !== "ao"`) and `aoNodes` (`role === "ao"`).
2. **MO column:** run the existing checks on `moNodes` (unchanged), but *do not*
   emit the final success message yet.
3. **AO side** (`aoNodes`, using `atoms`):
   - Split into `left` / `right` by node centre (`x + w/2`) vs `canvasWidth/2`.
   - If no AO nodes: emit a `warn` prompting the student to add them.
   - **Set check:** each side's orbital labels (matched by `matchesKeyLabel`
     against `type`+`label`/`alt`) must equal one atom's orbital set. Try both
     orientations (left↔A/right↔B and left↔B/right↔A); accept if either matches
     fully. Missing/extra/mislabelled AO nodes → `danger` item + flag those nodes.
   - **Electrons:**
     - `config` mode: for the matched orientation, each orbital's occupancy must
       equal `occ`, and each `trip`/`deg` must satisfy Hund's singles. Mismatches
       → `warn` + flag.
     - `total` mode: grand total AO electrons must equal `atoms.total`. Mismatch
       → `warn` (no per-orbital flagging).
4. `solved` = no items accumulated. When solved, push the existing MO success
   message (bond order, "answer the questions below"). Questions still gate on
   `solved`, so they now require a correct atomic side too.

Feedback items are worded to distinguish AO-set errors, atomic-config/Hund's
errors (neutral), atomic-total errors (ion), and MO-column errors.

## Files touched

- `src/applets/mo-diagrams/App.jsx` — `role` on nodes; `trip` type in `addNode`,
  `cycle`, `LevelNode` render, `levelElectrons`; new toolbar buttons + spawn
  positions + hint; `evaluate` split + AO grading (likely a small `evaluateAO`
  helper); `check()` passes canvas width.
- `src/applets/mo-diagrams/molecules.js` — `atoms` block for all five molecules;
  export any AO-label helper if needed (reuse `matchesKeyLabel`).

## Verification

`npm run build` clean, then a Playwright node script (playwright npm package
directly — MCP is broken in this WSL setup) that, for at least one neutral
(config) and one ion (total) molecule:
- adds σ/π MO levels and s/p AO nodes, drags AOs to left/right columns and MOs to
  centre, fills electrons;
- confirms `Check diagram` reports AO-set, atomic (config Hund's / ion total),
  and MO errors independently, and reaches the solved state (questions appear)
  when the whole diagram — atomic sides plus MO column — is correct.

## Out of scope

- Grading the correlation (link) lines between AOs and MOs.
- Changing the MO-column grading, molecule set, or the site integration.
- Per-orbital atomic grading for the ions (impossible; see Decision 4).
