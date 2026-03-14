# Derjaguin Approximation Applet — Implementation Plan

## Overview

A self-contained HTML applet at `src/applets/derjaguin/index.html` that visualizes the Derjaguin
approximation by comparing bead-by-bead numerical vdW energy sums against the analytic DA formula
and the exact Hamaker result. Follows the same monolithic HTML pattern as the DLVO and vdW applets.

---

## Physics

### Geometries

| Geometry | DA formula | Exact Hamaker |
|---|---|---|
| Sphere–Sphere (equal R) | E = −AR/(12D) | V = −(A/6)[2R²/(D(D+4R)) + 2R²/(2R+D)² + ln(D(D+4R)/(2R+D)²)] |
| Sphere–Flat | E = −AR/(6D) | V = −(A/6)[R/D + R/(D+2R) + ln(D/(D+2R))] |

Both formulas assume non-retarded London dispersion (no retardation correction). The DA is
derived from the Proximity Force Approximation and is only valid when D ≪ R.

### Bead Model

Each object is filled with point beads on a 3D Cartesian grid. The total pairwise interaction is:

```
E_num = −C₆_bead · Σᵢ Σⱼ 1/rᵢⱼ⁶
```

where the sum runs over all cross-object bead pairs. C₆_bead is calibrated so the sum
converges to the exact Hamaker result as N → ∞:

**Calibration**: compute the raw sum `S = Σᵢⱼ 1/rᵢⱼ⁶` at a reference separation D_ref = R,
then set `C₆_bead = −E_exact(D_ref) × kBT / S`. This works for both geometries without
needing to derive the normalization analytically.

### Units

| Quantity | Internal unit | Display |
|---|---|---|
| Length | nm | nm |
| Hamaker A | zJ (1e-21 J) | zJ |
| Energy | zJ | kBT (divide by 4.116 zJ at 298 K) |
| C₆_bead | zJ·nm⁶ | — |

### Validity Regimes

| D/R | DA status |
|---|---|
| < 0.05 | Valid (error < ~5%) |
| 0.05 – 0.3 | Marginal |
| > 0.3 | Invalid (DA significantly overestimates attraction) |

The bead model is only valid down to D ≈ Δ (bead spacing). Below this, beads from the two
objects interpenetrate and the sum diverges. The minimum D in the energy curve is set to
`max(0.3 nm, 0.9 × Δ)`.

---

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│  site-header (navy bar, back link)                          │
│  applet-header (title + subtitle)                           │
├──────────────┬──────────────────────────────────────────────┤
│  Controls    │  Canvas (dark background, bead visualization)│
│  (310px)     ├──────────────────────────────────────────────┤
│              │  Plotly (2-row subplot: energy + error)      │
│              ├──────────────────────────────────────────────┤
│              │  Info panel (stats bar)                      │
├──────────────┴──────────────────────────────────────────────┤
│  <details> Theory reference                                 │
└─────────────────────────────────────────────────────────────┘
```

Responsive: collapses to single column at `max-width: 900px`.

---

## Controls (left sidebar)

### Geometry
Pill buttons (same style as DLVO valence-group):
- **Sphere–Sphere** (default)
- **Sphere–Flat**

### Particle Parameters
| Control | Type | Range | Default |
|---|---|---|---|
| Radius R | Slider | 1–50 nm, step 1 | 10 nm |
| Beads per sphere N | Slider | 10–300, step 10 | 100 |
| Hamaker A | Slider (log) | 0.4–200 zJ | 6.5 zJ |

Material presets (pill buttons): SiO₂/water (6.5 zJ), PS/water (1.3 zJ), Au/water (45 zJ),
TiO₂/water (6.0 zJ)

### Visualization
| Control | Type | Range |
|---|---|---|
| Separation D | Slider | 0.5 to 3R nm, step 0.1 |

The D slider only updates the canvas and info panel (no full recompute).

### Display Curves
Checkboxes:
- Show Numerical (bead sum)
- Show Derjaguin Approximation
- Show Exact Hamaker
- Show Error subplot

---

## Canvas Visualization

### Rendering
- Dark background (`#0a0e1a`)
- **2D projection**: all beads projected onto the xz-plane; y-depth encoded as opacity
  (`alpha = 0.35 + 0.65 × (y − y_min)/(y_max − y_min)`) so front-face beads appear solid
  and rear beads fade — gives a convincing 3D sphere feel
- Beads drawn back-to-front (painter's algorithm) so front beads render on top
- Always-on `ResizeObserver` to handle width changes without blurriness (DPR-aware)

### Bead Coloring
Per-bead energy contribution `Eᵢ = −C₆_bead · Σⱼ 1/rᵢⱼ⁶` mapped to a "hot" colormap:

```
frac ∈ [0,1]:   0–0.33 → black→red   0.33–0.66 → red→yellow   0.66–1.0 → yellow→white
```

Normalization: `frac = |Eᵢ| / P95(|Eᵢ|)` (95th-percentile soft-clamp so outliers don't wash
out the scale). Beads nearest the gap glow brightest.

### Coordinate Systems

**Sphere–Sphere** (separation axis = x):
- Sphere 1 center at `(−R − D/2, 0)`, Sphere 2 at `(+R + D/2, 0)` in xz-plane
- ViewBox centered at origin; scale = `0.35 × canvasHeight / (R + D/2)`

**Sphere–Flat** (separation axis = z):
- Flat surface at z = 0; sphere center at `(0, R+D)` in xz-plane
- Flat slab beads extend z ∈ [−3R, 0], x ∈ [−2R, 2R]
- ViewBox centered at `z = R/2`

### Annotations
- Faint circle outlines showing object boundaries
- Double-arrow dimension line at the gap with `D = X.X nm` label
- Legend: colored squares for Obj 1 / Obj 2

---

## Energy Plot (Plotly)

### Two-Row Subplot
- **Row 1** (65% height): Interaction energy V/kBT vs. D (nm)
- **Row 2** (28% height): Relative error vs. D

Both rows share the same x-axis (log scale).

### Traces

| Trace | Color | Style | y-axis |
|---|---|---|---|
| Numerical (bead sum) | Blue `#2575e8` | Solid | y1 |
| Derjaguin Approx. | Red `#e05c3a` | Dashed | y1 |
| Exact Hamaker | Green `#22aa66` | Dotted | y1 |
| DA error `|E_DA−E_exact|/|E_exact|` | Red `#e05c3a` | Solid | y2 |
| Num error `|E_num−E_exact|/|E_exact|` | Blue `#2575e8` | Dashed | y2 |

### Reference Lines (shapes)
- **Orange dotted** vertical at `D = R`: DA validity boundary, labeled "D = R"
- **Purple dotted** vertical at `D = Δ`: bead model validity boundary, labeled "D = Δ"

### Axes
- x: D (nm), log scale, range [D_min, D_max]
- y1: V/kBT (negative → attractive), linear scale
- y2: relative error, log scale, tick format `%`

---

## Info Panel

Seven items in a horizontal flex bar (matches DLVO info-panel pattern):

| Item | Content |
|---|---|
| Beads N₁, N₂ | Actual bead counts after grid generation |
| Spacing Δ | Bead spacing in nm |
| D/R | Current D/R ratio |
| E (num) | Numerical energy at current D in kBT |
| E (DA) | DA energy at current D in kBT |
| DA Error | `|E_DA−E_exact|/|E_exact|` in % |
| DA Validity | Colored badge: Valid / Marginal / Invalid |

---

## State Object

```javascript
const KBT_ZJ = 4.116;   // kBT at 298 K in zJ

const state = {
  geometry: 'ss',     // 'ss' | 'sf'
  R_nm:     10,
  N_target: 100,
  A_zJ:     6.5,
  D_nm:     1.0,      // canvas visualization separation
  showNum:  true,
  showDA:   true,
  showExact:true,
  showError:true,
  cache: {
    beads1:    null,   // [{x,y,z}] sphere 1 beads at origin
    beads2:    null,   // [{x,y,z}] sphere 2 or slab beads at origin
    N1: 0, N2: 0,
    delta_nm:  0,
    C6bead:    0,      // zJ·nm⁶
    D_arr:     null,   // Float64Array, ~80 log-spaced points
    E_num:     null,   // kBT
    E_da:      null,   // kBT
    E_exact:   null,   // kBT
    err_da:    null,   // fractional
    err_num:   null,   // fractional
  },
};
```

---

## Key Functions

```
generateSphericalBeads(R_nm, N_target)
  → { beads: [{x,y,z}], delta_nm, N_actual }
  3D Cartesian grid inside sphere, spacing = (V_sphere/N_target)^(1/3)

generateFlatSlabBeads(R_nm, delta_nm)
  → { beads: [{x,y,z}], N_actual }
  Same delta_nm; disk of radius 2R, depth 3R; beads at z ∈ [−3R, 0]

numericalSumRaw(beads1, pos1, beads2, pos2)
  → S (nm^−6)
  Inner pairwise loop: Σᵢⱼ 1/rᵢⱼ⁶, skipping pairs with r < 0.15 nm

calibrateC6bead(beads1, beads2, A_zJ, R_nm, geometry)
  → C6bead (zJ·nm⁶)
  Calls energyExact(D_ref = R), then C6 = −E_exact × kBT / S_raw

energyDA(geometry, A_zJ, R_nm, D_nm)    → kBT
energyExact(geometry, A_zJ, R_nm, D_nm) → kBT
numericalEnergy(beads1, pos1, beads2, pos2, C6, kBT) → kBT

precompute()
  Regenerates beads, calibrates C6, computes all three curves + errors over D_arr
  Called when: geometry / R / N / A changes

drawCanvas()
  Recomputes per-bead energy contributions at current D_nm, renders cross-section
  Called when: D slider moves, or after precompute()

updatePlot()
  Plotly.newPlot (first call) or Plotly.react (subsequent) with cached arrays
  Called when: precompute() completes or display checkboxes change

updateInfoPanel()
  Linear interpolation in D_arr to get values at current D_nm
  Called when: D slider moves or after precompute()
```

---

## Update Flow

```
geometry / R / N / A change:
  precompute()  →  updatePlot()  →  drawCanvas()  →  updateInfoPanel()
  (slow path, ~50–200 ms)

D slider:
  drawCanvas()  →  updateInfoPanel()
  (fast path, < 5 ms)

display checkbox:
  updatePlot()  only
  (Plotly.react, instant)
```

---

## Computational Limits

For sphere–sphere with N_target = 300:
- Actual beads per sphere ≈ 300; pairs = 90,000
- Full curve (80 D-points): 7.2M inner loop iterations ≈ 40 ms ✓

For sphere–flat with N_target = 300:
- Sphere beads ≈ 300; slab beads ≈ 1,800 (6× density ratio for the larger slab volume)
- Pairs per D-point = 540,000; full curve = 43.2M iterations ≈ 250 ms ✓ (acceptable)

Hard cap: if N1 × N2 > 200,000, automatically reduce N_target by 20% and warn user in info panel.

---

## Files to Create / Modify

| File | Action |
|---|---|
| `src/applets/derjaguin/index.html` | Create (main applet, ~750–900 lines) |
| `vite.config.js` | Add `derjaguin` entry to `rollupOptions.input` |
| `index.html` | Add card to landing page grid |

---

## Open Questions / Design Choices

1. **Flat slab depth**: Using 3R as depth provides < 1% truncation error for D ≥ 0.5 nm; is this sufficient or should depth scale with D?
2. **N_target slider max**: Currently 300. For sphere–flat this can be slow at 300. Should we have separate max for each geometry (300 ss / 150 sf), or one cap with a warning?
3. **Canvas orientation**: Sphere–sphere shown with separation axis horizontal; sphere–flat shown with sphere above the flat (separation axis vertical). Is this clear, or should both use the same orientation?
4. **Error subplot**: Currently shows both DA error and numerical error on the same log-scale y-axis. Alternatively, make the error subplot optional (behind the "Show Error" checkbox) to reduce visual clutter.
5. **Retardation correction**: The Hamaker formula here is non-retarded. Should we add an optional Lifshitz retardation correction (e.g., `1 / (1 + 14D/λ_L)` term as in the DLVO applet)?
