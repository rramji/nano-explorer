import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";

/* ============================================================
   Crystallography plane-placement tutor
   - Tetragonal unit cell (a = b != c), rotatable 3D
   - Student is given (hkl) and must PLACE the plane by dragging
     three intercept handles along the a1, a2, a3 axes.
   - The plane renders live from wherever the handles sit.
   - "Check" compares the placed intercepts to 1/h, 1/k, 1/l.

   The genuine skill: turning indices into a position in the cell,
   including the awkward cases (intercept at infinity for a zero
   index, and negative/bar indices on the negative side).
   ============================================================ */

// ---- Palette ---------------------------------------------------
const ROSE = "#e07070";
const STEEL = "#6090c0";
const SAGE = "#5a9a6a";
const INK = "#1c2530";
const PAPER = "#f7f5f0";
const LINE = "#c9c3b8";
const AMBER = "#d08a3a";

// ---- Cell dimensions (world units) -----------------------------
const A = 1.0; // a1, a2
const C = 1.55; // a3

// Handles slide over this fractional range along each axis.
const RANGE = { min: -1.15, max: 1.15 };
// Drag a handle past this fractional position (past the arrow tip) and the
// intercept snaps to infinity: the plane goes parallel to that axis.
const INF_THRESHOLD = 1.24;
// Where the infinite handle parks visually (just past the arrow tip) so it
// stays grabbable and can be pulled back onto the axis.
const INF_PARK = 1.32;

// Axis unit directions in world space.  a1 -> +x, a2 -> +z, a3 -> +y
const AXES = [
  { key: "a1", dir: new THREE.Vector3(1, 0, 0), color: ROSE, label: "a\u2081" },
  { key: "a2", dir: new THREE.Vector3(0, 0, 1), color: ROSE, label: "a\u2082" },
  { key: "a3", dir: new THREE.Vector3(0, 1, 0), color: ROSE, label: "a\u2083" },
];

// Fractional coord (u along a1, v along a2, w along a3) -> world.
function fracToWorld(u, v, w) {
  return new THREE.Vector3(u * A - A / 2, w * C - C / 2, v * A - A / 2);
}
function axisPoint(axisIdx, frac) {
  const f = [0, 0, 0];
  f[axisIdx] = frac;
  return fracToWorld(f[0], f[1], f[2]);
}

function interceptsFromIndices(h, k, l) {
  const inv = (n) => (n === 0 ? Infinity : 1 / n);
  return [inv(h), inv(k), inv(l)];
}
function fmtIntercept(x) {
  if (!isFinite(x)) return "\u221e";
  if (Number.isInteger(x)) return String(x);
  const d = Math.round(1 / x);
  if (Math.abs(1 / d - x) < 1e-9) return `${x < 0 ? "-" : ""}1/${Math.abs(d)}`;
  return x.toFixed(2);
}
function fmtIndex(n) {
  return n < 0 ? `${Math.abs(n)}\u0305` : String(n);
}

/* ---- Plane polygon from three intercepts ---------------------- */
function planeFromIntercepts(ia, ib, ic) {
  const h = isFinite(ia) ? 1 / ia : 0;
  const k = isFinite(ib) ? 1 / ib : 0;
  const l = isFinite(ic) ? 1 / ic : 0;
  if (h === 0 && k === 0 && l === 0) return null;
  return clipPlaneToCube(h, k, l, 1);
}

function clipPlaneToCube(h, k, l, d) {
  const eps = 1e-9;
  const corners = [];
  for (let u = 0; u <= 1; u++)
    for (let v = 0; v <= 1; v++)
      for (let w = 0; w <= 1; w++) corners.push([u, v, w]);
  const edges = [];
  for (let i = 0; i < corners.length; i++)
    for (let j = i + 1; j < corners.length; j++) {
      const diff = corners[i].reduce(
        (a, x, idx) => a + (x !== corners[j][idx] ? 1 : 0),
        0
      );
      if (diff === 1) edges.push([corners[i], corners[j]]);
    }
  const f = (p) => h * p[0] + k * p[1] + l * p[2] - d;
  const pts = [];
  for (const [p, q] of edges) {
    const fp = f(p),
      fq = f(q);
    if (Math.abs(fp) < eps) pushUnique(pts, p);
    if (Math.abs(fq) < eps) pushUnique(pts, q);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
      const t = fp / (fp - fq);
      pushUnique(pts, [
        p[0] + t * (q[0] - p[0]),
        p[1] + t * (q[1] - p[1]),
        p[2] + t * (q[2] - p[2]),
      ]);
    }
  }
  if (pts.length < 3) return null;
  return orderLoop(pts, [h, k, l]);
}

function pushUnique(arr, p) {
  const eps = 1e-6;
  for (const q of arr)
    if (
      Math.abs(q[0] - p[0]) < eps &&
      Math.abs(q[1] - p[1]) < eps &&
      Math.abs(q[2] - p[2]) < eps
    )
      return;
  arr.push(p);
}
function orderLoop(pts, normal) {
  const c = [0, 0, 0];
  for (const p of pts) {
    c[0] += p[0];
    c[1] += p[1];
    c[2] += p[2];
  }
  c[0] /= pts.length;
  c[1] /= pts.length;
  c[2] /= pts.length;
  const n = new THREE.Vector3(...normal).normalize();
  let ref =
    Math.abs(n.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const ex = ref.clone().sub(n.clone().multiplyScalar(ref.dot(n))).normalize();
  const ey = n.clone().cross(ex).normalize();
  return pts
    .map((p) => {
      const d = new THREE.Vector3(p[0] - c[0], p[1] - c[1], p[2] - c[2]);
      return { p, ang: Math.atan2(d.dot(ey), d.dot(ex)) };
    })
    .sort((a, b) => a.ang - b.ang)
    .map((o) => o.p);
}

// ---- Problems: (hkl), difficulty ordered -----------------------
const PROBLEMS = [
  { hkl: [0, 0, 1], tag: "warm-up" },
  { hkl: [0, 1, 1], tag: "warm-up" },
  { hkl: [1, 1, 1], tag: "core" },
  { hkl: [1, 1, 2], tag: "core" },
  { hkl: [2, 0, 1], tag: "core" },
  { hkl: [2, 1, 0], tag: "core" },
  { hkl: [1, -1, 0], tag: "bar index" },
  { hkl: [1, 2, -1], tag: "bar index" },
];

// ================================================================
//  3D scene: cell + draggable intercept handles + live plane
// ================================================================
function CellScene({ handles, setHandles, targetPlane, showTarget, enabled }) {
  const mountRef = useRef(null);
  const api = useRef({});

  const handlesRef = useRef(handles);
  handlesRef.current = handles;
  const setHandlesRef = useRef(setHandles);
  setHandlesRef.current = setHandles;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(PAPER);
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    const camDist = 4.4;
    camera.position.set(camDist * 0.8, camDist * 0.55, camDist * 0.95);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dl = new THREE.DirectionalLight(0xffffff, 0.45);
    dl.position.set(3, 5, 4);
    scene.add(dl);

    const root = new THREE.Group();
    scene.add(root);

    // ---- Cell wireframe ----
    const box = new THREE.BoxGeometry(A, C, A);
    root.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(box),
        new THREE.LineBasicMaterial({ color: INK })
      )
    );
    const dotGeom = new THREE.SphereGeometry(0.018, 10, 10);
    const dotMat = new THREE.MeshBasicMaterial({ color: INK });
    for (let u = 0; u <= 1; u++)
      for (let v = 0; v <= 1; v++)
        for (let w = 0; w <= 1; w++) {
          const d = new THREE.Mesh(dotGeom, dotMat);
          d.position.copy(fracToWorld(u, v, w));
          root.add(d);
        }

    // ---- Axis arrows ----
    const origin = fracToWorld(0, 0, 0);
    AXES.forEach((ax) => {
      const len = ax.key === "a3" ? C : A;
      root.add(
        new THREE.ArrowHelper(
          ax.dir.clone().normalize(),
          origin,
          len * 1.2,
          ax.color,
          0.11,
          0.06
        )
      );
    });

    // ---- Draggable handle spheres ----
    const handleMeshes = AXES.map((ax, i) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 20, 20),
        new THREE.MeshStandardMaterial({
          color: STEEL,
          emissive: STEEL,
          emissiveIntensity: 0.15,
          roughness: 0.5,
        })
      );
      m.userData.axisIdx = i;
      root.add(m);
      return m;
    });

    const planeGroup = new THREE.Group();
    root.add(planeGroup);
    const targetGroup = new THREE.Group();
    root.add(targetGroup);

    let rotX = 0.18,
      rotY = -0.6;
    root.rotation.set(rotX, rotY, 0);

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let mode = null;
    let dragAxis = -1;
    let px = 0,
      py = 0;

    const el = renderer.domElement;
    const setNDC = (clientX, clientY) => {
      const r = el.getBoundingClientRect();
      ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
    };
    const pickHandle = (clientX, clientY) => {
      setNDC(clientX, clientY);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(
        handleMeshes.filter((m) => m.visible),
        false
      );
      return hits.length ? hits[0].object.userData.axisIdx : -1;
    };
    const fracFromPointer = (clientX, clientY, axisIdx) => {
      setNDC(clientX, clientY);
      raycaster.setFromCamera(ndc, camera);
      const ray = raycaster.ray;
      const q = new THREE.Quaternion().setFromEuler(root.rotation);
      const dirW = AXES[axisIdx].dir.clone().applyQuaternion(q).normalize();
      const origW = fracToWorld(0, 0, 0).applyQuaternion(q);
      const w0 = new THREE.Vector3().subVectors(ray.origin, origW);
      const a = ray.direction.dot(ray.direction);
      const b = ray.direction.dot(dirW);
      const cc = dirW.dot(dirW);
      const dd = ray.direction.dot(w0);
      const e = dirW.dot(w0);
      const denom = a * cc - b * b;
      let s = Math.abs(denom) < 1e-6 ? 0 : (a * e - b * dd) / denom;
      const cellLen = axisIdx === 2 ? C : A;
      let frac = s / cellLen;
      // Past the arrow tip => the intercept has run off to infinity:
      // the plane becomes parallel to this axis. Sentinel null = infinite.
      if (frac > INF_THRESHOLD) return null;
      const snaps = [-1, -0.5, -1 / 3, 0, 1 / 3, 0.5, 1, 1.5];
      for (const sn of snaps) if (Math.abs(frac - sn) < 0.06) frac = sn;
      return Math.max(RANGE.min, Math.min(RANGE.max, frac));
    };

    const onDown = (e) => {
      const axis = enabledRef.current ? pickHandle(e.clientX, e.clientY) : -1;
      if (axis >= 0) {
        mode = "drag";
        dragAxis = axis;
      } else {
        mode = "rotate";
        px = e.clientX;
        py = e.clientY;
      }
    };
    const onMove = (e) => {
      if (mode === "drag" && dragAxis >= 0) {
        const frac = fracFromPointer(e.clientX, e.clientY, dragAxis);
        const key = AXES[dragAxis].key;
        const next = { ...handlesRef.current, [key]: frac };
        handlesRef.current = next;
        setHandlesRef.current(next);
      } else if (mode === "rotate") {
        rotY += (e.clientX - px) * 0.008;
        rotX += (e.clientY - py) * 0.008;
        rotX = Math.max(-1.4, Math.min(1.4, rotX));
        px = e.clientX;
        py = e.clientY;
      }
    };
    const onUp = () => {
      mode = null;
      dragAxis = -1;
    };

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const axis = enabledRef.current ? pickHandle(t.clientX, t.clientY) : -1;
      if (axis >= 0) {
        mode = "drag";
        dragAxis = axis;
      } else {
        mode = "rotate";
        px = t.clientX;
        py = t.clientY;
      }
    };
    const onTouchMove = (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (mode === "drag" && dragAxis >= 0) {
        e.preventDefault();
        const frac = fracFromPointer(t.clientX, t.clientY, dragAxis);
        const key = AXES[dragAxis].key;
        const next = { ...handlesRef.current, [key]: frac };
        handlesRef.current = next;
        setHandlesRef.current(next);
      } else if (mode === "rotate") {
        rotY += (t.clientX - px) * 0.008;
        rotX += (t.clientY - py) * 0.008;
        rotX = Math.max(-1.4, Math.min(1.4, rotX));
        px = t.clientX;
        py = t.clientY;
      }
    };

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onUp);
    const onWheel = (e) => {
      e.preventDefault();
      camera.position.multiplyScalar(1 + e.deltaY * 0.001);
      camera.position.clampLength(2.6, 9);
    };
    el.addEventListener("wheel", onWheel, { passive: false });

    const targetRef = { current: { targetPlane, showTarget } };
    api.current.targetRef = targetRef;

    const buildPolyMesh = (loop, color, opacity) => {
      const grp = new THREE.Group();
      const verts = loop.map((p) => fracToWorld(p[0], p[1], p[2]));
      const pos = [];
      for (let i = 1; i < verts.length - 1; i++)
        pos.push(
          verts[0].x, verts[0].y, verts[0].z,
          verts[i].x, verts[i].y, verts[i].z,
          verts[i + 1].x, verts[i + 1].y, verts[i + 1].z
        );
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      grp.add(
        new THREE.Mesh(
          g,
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        )
      );
      const lg = new THREE.BufferGeometry().setFromPoints([...verts, verts[0]]);
      grp.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color })));
      return grp;
    };

    let lastKey = "";
    let lastTargetKey = "";
    const clearGroup = (g) => {
      while (g.children.length) {
        const c = g.children.pop();
        c.traverse?.((o) => {
          o.geometry?.dispose?.();
          o.material?.dispose?.();
        });
      }
    };
    const refreshPlane = () => {
      const H = handlesRef.current;
      const key = JSON.stringify(H);
      if (key === lastKey) return;
      lastKey = key;
      clearGroup(planeGroup);
      AXES.forEach((ax, i) => {
        const val = H[ax.key];
        const m = handleMeshes[i];
        m.visible = true;
        if (val === null || val === undefined) {
          // Infinite: park the handle just past the arrow tip, amber, so the
          // student can still grab it and pull it back onto the axis.
          m.position.copy(axisPoint(i, INF_PARK));
          m.material.color.set(AMBER);
          m.material.emissive.set(AMBER);
        } else {
          m.position.copy(axisPoint(i, val));
          m.material.color.set(STEEL);
          m.material.emissive.set(STEEL);
        }
      });
      const ia = H.a1 === null ? Infinity : H.a1;
      const ib = H.a2 === null ? Infinity : H.a2;
      const ic = H.a3 === null ? Infinity : H.a3;
      const loop = planeFromIntercepts(ia, ib, ic);
      if (loop) planeGroup.add(buildPolyMesh(loop, STEEL, 0.3));
    };
    const refreshTarget = () => {
      const t = targetRef.current;
      const key = JSON.stringify([t.showTarget, t.targetPlane]);
      if (key === lastTargetKey) return;
      lastTargetKey = key;
      clearGroup(targetGroup);
      if (t.showTarget && t.targetPlane) {
        const loop = clipPlaneToCube(...t.targetPlane, 1);
        if (loop) targetGroup.add(buildPolyMesh(loop, SAGE, 0.22));
      }
    };

    let raf;
    const loop = () => {
      root.rotation.x = rotX;
      root.rotation.y = rotY;
      refreshPlane();
      refreshTarget();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    const onResize = () => {
      const w = mount.clientWidth,
        h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onUp);
      el.removeEventListener("wheel", onWheel);
      renderer.dispose();
      if (renderer.domElement.parentNode)
        renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (api.current.targetRef)
      api.current.targetRef.current = { targetPlane, showTarget };
  }, [targetPlane, showTarget]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}

// ================================================================
//  Main app
// ================================================================
export default function App() {
  const [problemIdx, setProblemIdx] = useState(0);
  const problem = PROBLEMS[problemIdx];
  const [h, k, l] = problem.hkl;

  const [handles, setHandles] = useState({ a1: 0.5, a2: 0.5, a3: 0.5 });
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const target = interceptsFromIndices(h, k, l);
  const targetPlaneCoeffs = [h, k, l];

  const resetProblem = useCallback((idx) => {
    setProblemIdx(idx);
    setHandles({ a1: 0.5, a2: 0.5, a3: 0.5 });
    setRevealed(false);
    setFeedback(null);
  }, []);

  const toggleInfinite = (axisKey) => {
    setHandles((H) => ({
      ...H,
      [axisKey]: H[axisKey] === null ? 0.5 : null,
    }));
    setFeedback(null);
  };

  const check = () => {
    const got = [handles.a1, handles.a2, handles.a3].map((x) =>
      x === null ? Infinity : x
    );
    const ok = got.every((g, i) => {
      const want = target[i];
      if (!isFinite(want)) return !isFinite(g);
      if (!isFinite(g)) return false;
      return Math.abs(g - want) < 0.02;
    });
    setFeedback(ok ? "correct" : "wrong");
    if (ok) setRevealed(true);
  };

  const nextProblem = () => resetProblem((problemIdx + 1) % PROBLEMS.length);

  return (
    <div style={S.wrap}>
      <style>{CSS}</style>

      <header style={S.header}>
        <div>
          <div style={S.kicker}>Crystallography practice</div>
          <h1 style={S.title}>Place the plane</h1>
        </div>
        <div style={S.taskCard}>
          <span style={S.taskLabel}>Draw</span>
          <span style={S.taskHkl}>
            ({fmtIndex(h)}{fmtIndex(k)}{fmtIndex(l)})
          </span>
        </div>
      </header>

      <div className="cp-grid" style={S.grid}>
        <div style={S.viewport}>
          <CellScene
            handles={handles}
            setHandles={setHandles}
            targetPlane={targetPlaneCoeffs}
            showTarget={revealed}
            enabled={!revealed}
          />
          <div style={S.hint}>
            drag dots along axes · past the tip = parallel (\u221e) · drag
            empty space to rotate
          </div>
          {revealed && (
            <div style={S.legend}>
              <span style={{ color: STEEL }}>■</span> your plane&nbsp;&nbsp;
              <span style={{ color: SAGE }}>■</span> correct
            </div>
          )}
        </div>

        <div style={S.panel}>
          <div style={S.problemBar}>
            {PROBLEMS.map((p, i) => (
              <button
                key={i}
                className={i === problemIdx ? "chip active" : "chip"}
                onClick={() => resetProblem(i)}
              >
                ({fmtIndex(p.hkl[0])}{fmtIndex(p.hkl[1])}{fmtIndex(p.hkl[2])})
              </button>
            ))}
          </div>

          <p style={S.prompt}>
            You're given the plane{" "}
            <b style={S.mono}>
              ({fmtIndex(h)}{fmtIndex(k)}{fmtIndex(l)})
            </b>
            . Position each intercept so the shaded plane matches those indices.
            If an index is <b>0</b>, the plane never meets that axis: set it
            parallel with the button below.
          </p>

          <div style={S.readout}>
            {AXES.map((ax) => {
              const val = handles[ax.key];
              return (
                <div key={ax.key} style={S.readCol}>
                  <span style={{ ...S.axisTag, color: ROSE }}>{ax.label}</span>
                  <div style={S.readVal}>
                    {val === null ? "\u221e" : fmtIntercept(val)}
                  </div>
                  <button
                    className={val === null ? "par active" : "par"}
                    onClick={() => toggleInfinite(ax.key)}
                    disabled={revealed}
                    title="Set this axis parallel (intercept at infinity)"
                  >
                    {val === null ? "on axis" : "\u221e parallel"}
                  </button>
                </div>
              );
            })}
          </div>

          {feedback && (
            <div
              style={{
                ...S.feedback,
                color: feedback === "correct" ? SAGE : ROSE,
              }}
            >
              {feedback === "correct"
                ? "Correct. Your plane matches (hkl)."
                : "Not matching yet. Compare each intercept to 1/index."}
            </div>
          )}

          <div style={S.actions}>
            {!revealed && (
              <button className="btn primary" onClick={check}>
                Check
              </button>
            )}
            {!revealed && (
              <button
                className="btn ghost"
                onClick={() => {
                  setRevealed(true);
                  setFeedback(null);
                }}
              >
                Reveal answer
              </button>
            )}
            {revealed && (
              <button className="btn primary" onClick={nextProblem}>
                Next plane
              </button>
            )}
          </div>

          {revealed && (
            <div style={S.reveal}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th>axis</th>
                    <th>index</th>
                    <th>1/index</th>
                    <th>you</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["a\u2081", h, target[0], handles.a1],
                    ["a\u2082", k, target[1], handles.a2],
                    ["a\u2083", l, target[2], handles.a3],
                  ].map(([ax, idx, want, got]) => {
                    const gv = got === null ? Infinity : got;
                    const good = !isFinite(want)
                      ? !isFinite(gv)
                      : isFinite(gv) && Math.abs(gv - want) < 0.02;
                    return (
                      <tr key={ax}>
                        <td style={{ color: ROSE, fontWeight: 600 }}>{ax}</td>
                        <td>{fmtIndex(idx)}</td>
                        <td style={{ color: SAGE, fontWeight: 600 }}>
                          {fmtIntercept(want)}
                        </td>
                        <td style={{ color: good ? SAGE : ROSE }}>
                          {got === null ? "\u221e" : fmtIntercept(got)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p style={S.note}>
                Each intercept is the reciprocal of its index. A zero index
                gives an intercept at infinity (the plane runs parallel to that
                axis); a negative index puts the intercept on the negative side
                of the origin.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ================================================================
//  Styles
// ================================================================
const S = {
  wrap: {
    fontFamily: "'Inter', system-ui, sans-serif",
    background: PAPER,
    color: INK,
    padding: 20,
    borderRadius: 14,
    maxWidth: 1000,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  kicker: {
    fontSize: 12,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: ROSE,
    fontWeight: 600,
  },
  title: { fontSize: 26, margin: "4px 0 0", fontWeight: 700 },
  taskCard: {
    display: "flex",
    alignItems: "baseline",
    gap: 10,
    background: INK,
    color: "#fff",
    padding: "8px 16px",
    borderRadius: 10,
  },
  taskLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    opacity: 0.7,
  },
  taskHkl: {
    fontFamily: "'Roboto Mono', monospace",
    fontSize: 22,
    fontWeight: 700,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1.15fr 1fr",
    gap: 18,
    alignItems: "stretch",
  },
  viewport: {
    position: "relative",
    background: PAPER,
    border: `1px solid ${LINE}`,
    borderRadius: 12,
    minHeight: 440,
    overflow: "hidden",
  },
  hint: {
    position: "absolute",
    bottom: 8,
    left: 10,
    fontSize: 11,
    color: "#9a948a",
  },
  legend: {
    position: "absolute",
    top: 10,
    right: 12,
    fontSize: 12,
    background: "rgba(255,255,255,.85)",
    padding: "4px 10px",
    borderRadius: 6,
    border: `1px solid ${LINE}`,
  },
  panel: {
    background: "#fff",
    border: `1px solid ${LINE}`,
    borderRadius: 12,
    padding: 18,
    display: "flex",
    flexDirection: "column",
  },
  problemBar: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  prompt: {
    fontSize: 14,
    lineHeight: 1.55,
    color: "#42484f",
    margin: "0 0 14px",
  },
  mono: { fontFamily: "'Roboto Mono', monospace" },
  readout: { display: "flex", gap: 10, marginBottom: 6 },
  readCol: {
    flex: 1,
    textAlign: "center",
    border: `1px solid ${LINE}`,
    borderRadius: 10,
    padding: "10px 6px",
    background: PAPER,
  },
  axisTag: {
    fontFamily: "'Roboto Mono', monospace",
    fontSize: 14,
    fontWeight: 700,
  },
  readVal: {
    fontFamily: "'Roboto Mono', monospace",
    fontSize: 20,
    fontWeight: 700,
    margin: "6px 0 8px",
  },
  actions: { display: "flex", gap: 8, marginTop: 16 },
  feedback: { marginTop: 12, fontSize: 13, fontWeight: 600 },
  reveal: { marginTop: 16, paddingTop: 14, borderTop: `1px solid ${LINE}` },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  note: { fontSize: 12.5, lineHeight: 1.5, color: "#6a6f76", marginTop: 10 },
};

const CSS = `
  .chip{border:1px solid ${LINE};background:${PAPER};padding:5px 9px;border-radius:7px;
    font-family:'Roboto Mono',monospace;font-size:12.5px;cursor:pointer;color:#5a6068;}
  .chip.active{background:${INK};color:#fff;border-color:${INK};}
  .btn{padding:10px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;
    font-family:inherit;border:1.5px solid transparent;}
  .btn.primary{background:${STEEL};color:#fff;}
  .btn.primary:hover{filter:brightness(1.05);}
  .btn.ghost{background:transparent;border-color:${LINE};color:#5a6068;}
  .btn.ghost:hover{background:${PAPER};}
  .par{margin-top:2px;border:1px solid ${LINE};background:#fff;border-radius:6px;
    font-size:11px;padding:3px 6px;cursor:pointer;color:#6a6f76;font-family:inherit;}
  .par.active{background:${AMBER};color:#fff;border-color:${AMBER};}
  .par:disabled{opacity:.5;cursor:default;}
  table th{text-align:left;font-weight:600;color:#9a948a;font-size:11px;
    text-transform:uppercase;letter-spacing:.05em;padding:4px 6px;border-bottom:1px solid ${LINE};}
  table td{padding:6px;border-bottom:1px solid #eee;font-family:'Roboto Mono',monospace;}
  @media(max-width:760px){ .cp-grid{grid-template-columns:1fr !important;} }
`;
