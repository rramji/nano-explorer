import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MOLECULES, MOLECULE_ORDER, matchesKeyLabel } from "./molecules";

/**
 * MOActivity.jsx
 * -----------------------------------------------------------------------------
 * A multi-problem molecular orbital diagram activity.
 *
 *   <MOActivity />                       // runs the full ordered set
 *   <MOActivity order={["HF","BN"]} />   // custom subset / order
 *
 * Architecture
 *   MOActivity      shell: holds all per-problem state, navigation, summary
 *     DiagramBuilder  one problem: blank canvas, evaluation, questions
 *       LevelNode     one draggable orbital level
 *
 * Per-problem state (nodes, links, question answers, status) is lifted into the
 * shell and keyed by molecule id, so leaving a problem and coming back restores
 * the student's work. Nothing is graded for points; the status is diagnostic.
 * -----------------------------------------------------------------------------
 */

// ----------------------------------------------------------------------------
// Theme. Swap for CSS variables / Tailwind as desired; every color lives here.
// ----------------------------------------------------------------------------
const theme = {
  bg: "#ffffff",
  surface: "#f7f7f5",
  surface2: "#efeeea",
  border: "#e2e0da",
  borderStrong: "#9a978e",
  text: "#26241f",
  textMuted: "#8a877e",
  accent: "#6090c0", // steel blue
  danger: "#e07070", // dusty rose
  success: "#5a9a6a", // sage green
  warn: "#b07a1e",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  radius: 8,
};

const STATUS = {
  untouched: { label: "Not started", color: theme.textMuted },
  attempted: { label: "In progress", color: theme.warn },
  revised: { label: "Solved after revising", color: theme.accent },
  first: { label: "Solved first try", color: theme.success },
};

// ----------------------------------------------------------------------------
// Shared UI atoms
// ----------------------------------------------------------------------------
function Button({ children, onClick, active, ariaLabel, small, disabled }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      style={{
        font: "inherit",
        fontSize: small ? 12 : 13,
        padding: small ? "3px 6px" : "7px 12px",
        borderRadius: theme.radius,
        border: `0.5px solid ${theme.border}`,
        background: active ? theme.surface2 : theme.bg,
        color: disabled ? theme.textMuted : theme.text,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

function Note({ kind, children }) {
  const color =
    kind === "ok" ? theme.success : kind === "warn" ? theme.warn : theme.danger;
  const bg =
    kind === "ok"
      ? "rgba(90,154,106,0.10)"
      : kind === "warn"
      ? "rgba(176,122,30,0.10)"
      : "rgba(224,112,112,0.10)";
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        padding: "10px 12px",
        background: bg,
        borderRadius: theme.radius,
        fontSize: 13,
        lineHeight: 1.6,
        color,
        marginBottom: 6,
      }}
    >
      <span aria-hidden="true">{kind === "ok" ? "✓" : "!"}</span>
      <span>{children}</span>
    </div>
  );
}

function Arrows({ up, down }) {
  return (
    <span style={{ color: theme.accent, fontSize: 15, lineHeight: 1 }}>
      {up ? "↑" : ""}
      {down ? "↓" : ""}
      {!up && !down ? "\u00A0" : ""}
    </span>
  );
}

// ----------------------------------------------------------------------------
// One draggable orbital level
// ----------------------------------------------------------------------------
function LevelNode({ node, flagged, onDragBegin, onCycle, onRename, onDelete, onLink, armed }) {
  const [editing, setEditing] = useState(false);

  return (
    <div
      style={{
        position: "absolute",
        left: node.x,
        top: node.y,
        width: node.w,
        userSelect: "none",
        boxShadow: flagged ? `0 0 0 2px ${theme.danger}` : "none",
        outline: armed ? `2px solid ${theme.accent}` : "none",
        outlineOffset: 2,
        borderRadius: 4,
        padding: 2,
      }}
    >
      <div
        onPointerDown={(e) => {
          e.preventDefault();
          onDragBegin(node, e.clientX, e.clientY);
        }}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "grab",
          marginBottom: 2,
        }}
      >
        <span style={{ color: theme.textMuted, fontSize: 12 }}>⠿</span>
        <span style={{ display: "flex", gap: 2 }}>
          <Button small ariaLabel="connect this level" onClick={() => onLink(node)}>⇢</Button>
          <Button small ariaLabel="delete this level" onClick={() => onDelete(node)}>✕</Button>
        </span>
      </div>

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

      {editing ? (
        <input
          autoFocus
          defaultValue={node.label}
          onBlur={(ev) => {
            onRename(node, ev.target.value);
            setEditing(false);
          }}
          onKeyDown={(ev) => ev.key === "Enter" && ev.target.blur()}
          style={{ width: "100%", textAlign: "center", font: "inherit", fontFamily: theme.mono, fontSize: 12, marginTop: 3 }}
        />
      ) : (
        <div
          onDoubleClick={() => setEditing(true)}
          title="double-click to rename"
          style={{ textAlign: "center", marginTop: 3, fontSize: 12, fontFamily: theme.mono, color: theme.textMuted, cursor: "text", minHeight: 14 }}
        >
          {node.label}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Evaluation (pure). Returns { solved, flagged:Set, items:[{kind,text}] }.
// Order-based: relies on vertical position, never absolute coordinates.
// ----------------------------------------------------------------------------
const levelElectrons = (n) => (n.type === "deg" ? n.eA + n.eB : n.e);

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

  const usedForKey = new Array(mol.key.length).fill(null);
  const unmatched = [];
  ordered.forEach((n) => {
    const ki = mol.key.findIndex((k, i) => usedForKey[i] === null && matchesKeyLabel(n.label, k));
    if (ki >= 0) usedForKey[ki] = n;
    else unmatched.push(n);
  });
  const missing = mol.key.filter((_, i) => usedForKey[i] === null);
  if (missing.length)
    items.push({
      kind: "danger",
      text: `Missing or mislabeled levels: expected ${missing.map((m) => m.label).join(", ")}. Check the standard valence set for this molecule.`,
    });
  unmatched.forEach((n) => flagged.add(n.id));
  if (unmatched.length)
    items.push({
      kind: "danger",
      text: `Some levels are not part of the accepted set for ${mol.title}; the highlighted rows may be extra or mislabeled.`,
    });

  let orderOk = true;
  if (!missing.length && !unmatched.length) {
    const keyLabels = mol.key.map((k) => k.label);
    const userLabels = ordered.map((n) => mol.key.find((k) => matchesKeyLabel(n.label, k)).label);
    for (let i = 0; i < keyLabels.length; i++) {
      if (userLabels[i] !== keyLabels[i]) {
        orderOk = false;
        break;
      }
    }
    if (!orderOk) {
      ordered.forEach((n) => flagged.add(n.id));
      items.push({ kind: "warn", text: `All the right levels are present, but the energy ordering is off. ${mol.orderingHint}` });
    }
  }

  if (!missing.length && !unmatched.length && orderOk) {
    let occErr = false;
    mol.key.forEach((k, i) => {
      const n = usedForKey[i];
      const occ = levelElectrons(n);
      if (occ !== k.occ) {
        flagged.add(n.id);
        occErr = true;
        return;
      }
      if (k.degenerate && n.type === "deg") {
        const singles = (n.eA === 1 ? 1 : 0) + (n.eB === 1 ? 1 : 0);
        const expectedSingles = occ <= 2 ? occ : 4 - occ;
        if (singles !== expectedSingles) {
          flagged.add(n.id);
          occErr = true;
        }
      }
    });
    if (occErr)
      items.push({
        kind: "warn",
        text: "Right levels and order, but some occupancies are off. Fill lowest first, and within a degenerate π set place one electron in each component before pairing.",
      });
  }

  const solved = items.length === 0;
  if (solved)
    items.push({ kind: "ok", text: `Diagram matches the accepted solution. Bond order is ${mol.bondOrder}. Now answer the questions below.` });

  return { solved, flagged, items };
}

// ----------------------------------------------------------------------------
// One problem: blank canvas + evaluation + questions.
// State is controlled by the parent via `state` / `onState`.
// ----------------------------------------------------------------------------
function DiagramBuilder({ mol, state, onState, onStatus }) {
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const [hint, setHint] = useState("Add a level, drag it to set its energy, click the line for electrons, double-click the label to rename.");
  const [feedback, setFeedback] = useState(null);
  const [flagged, setFlagged] = useState(new Set());
  const [showQ, setShowQ] = useState(state.solved || false);
  const [linkFrom, setLinkFrom] = useState(null);

  const { nodes, links, uid, answers, everWrong } = state;

  const patch = (delta) => onState({ ...state, ...delta });

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

  const rename = (node, value) =>
    patch({ nodes: nodes.map((n) => (n.id === node.id ? { ...n, label: value || n.label } : n)) });

  const remove = (node) =>
    patch({
      nodes: nodes.filter((n) => n.id !== node.id),
      links: links.filter((l) => l.a !== node.id && l.b !== node.id),
    });

  const link = (node) => {
    if (linkFrom && linkFrom !== node.id) {
      const dup = links.some((l) => (l.a === linkFrom && l.b === node.id) || (l.a === node.id && l.b === linkFrom));
      if (!dup) patch({ links: [...links, { a: linkFrom, b: node.id }] });
      setLinkFrom(null);
      setHint("Line drawn. Click a line to delete it.");
    } else {
      setLinkFrom(node.id);
      setHint("Now click the connect arrow on a second level to join them.");
    }
  };

  // dragging
  const onMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    const rect = canvasRef.current.getBoundingClientRect();
    let x = e.clientX - rect.left - d.dx;
    let y = e.clientY - rect.top - d.dy;
    x = Math.max(0, Math.min(x, canvasRef.current.clientWidth - d.w));
    y = Math.max(0, Math.min(y, canvasRef.current.clientHeight - 80));
    onState((s) => ({ ...s, nodes: s.nodes.map((n) => (n.id === d.id ? { ...n, x, y } : n)) }));
  }, [onState]);

  const onUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }, [onMove]);

  const dragBegin = (node, clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    dragRef.current = { id: node.id, dx: clientX - rect.left - node.x, dy: clientY - rect.top - node.y, w: node.w };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  useEffect(() => () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }, [onMove, onUp]);

  const anchor = (n) => ({ x: n.x + n.w / 2, y: n.y + 40 });

  const check = () => {
    const res = evaluate(mol, nodes);
    setFlagged(res.flagged);
    setFeedback(res.items);
    setShowQ(res.solved);
    if (res.solved) {
      const status = everWrong ? "revised" : "first";
      patch({ solved: true, status });
      onStatus(status);
    } else {
      patch({ everWrong: true, solved: false, status: "attempted" });
      onStatus("attempted");
    }
  };

  const clearAll = () => {
    onState({ ...state, nodes: [], links: [], solved: false });
    setFeedback(null);
    setFlagged(new Set());
    setShowQ(false);
    setLinkFrom(null);
    setHint("Canvas cleared.");
  };

  const answerQuestion = (q, value) => {
    const correct = q.type === "mc" ? value === q.answer : true; // free response is always "recorded"
    patch({ answers: { ...answers, [q.id]: { value, correct } } });
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <Button onClick={() => addNode("single")}>+ σ level</Button>
        <Button onClick={() => addNode("deg")}>+ π level (degenerate)</Button>
        <Button onClick={check}>Check diagram</Button>
        <Button onClick={clearAll}>Clear</Button>
      </div>

      <div style={{ fontSize: 12, color: theme.textMuted, margin: "0 0 10px", minHeight: 16, lineHeight: 1.6 }}>{hint}</div>

      <div
        ref={canvasRef}
        style={{ position: "relative", height: 600, background: theme.surface, border: `0.5px solid ${theme.border}`, borderRadius: 12, overflow: "hidden", touchAction: "none" }}
      >
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          {links.map((l, i) => {
            const a = nodes.find((n) => n.id === l.a);
            const b = nodes.find((n) => n.id === l.b);
            if (!a || !b) return null;
            const pa = anchor(a);
            const pb = anchor(b);
            return (
              <line
                key={i}
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
                stroke={theme.borderStrong}
                strokeWidth={1}
                strokeDasharray="4 3"
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
                onClick={() => {
                  patch({ links: links.filter((x) => x !== l) });
                  setHint("Line removed.");
                }}
              />
            );
          })}
        </svg>

        {nodes.length === 0 && (
          <p style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 13, color: theme.textMuted, margin: 0 }}>
            Empty canvas. Add an orbital level to begin.
          </p>
        )}

        {nodes.map((n) => (
          <LevelNode
            key={n.id}
            node={n}
            flagged={flagged.has(n.id)}
            armed={linkFrom === n.id}
            onDragBegin={dragBegin}
            onCycle={cycle}
            onRename={rename}
            onDelete={remove}
            onLink={link}
          />
        ))}
      </div>

      {feedback && (
        <div style={{ marginTop: 14 }}>
          {feedback.map((it, i) => (
            <Note key={i} kind={it.kind}>{it.text}</Note>
          ))}
        </div>
      )}

      {showQ && (
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: `0.5px solid ${theme.border}` }}>
          {mol.questions.map((q) => {
            const ans = answers[q.id];
            return (
              <div key={q.id} style={{ marginBottom: 18 }}>
                <p style={{ fontSize: 15, fontWeight: 500, margin: "0 0 10px" }}>{q.prompt}</p>

                {q.type === "mc" ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {q.options.map((opt) => {
                      const chosen = ans && ans.value === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => answerQuestion(q, opt)}
                          style={{
                            minWidth: 44,
                            height: 40,
                            padding: "0 12px",
                            fontSize: 15,
                            borderRadius: theme.radius,
                            border: `0.5px solid ${chosen ? (ans.correct ? theme.success : theme.danger) : theme.border}`,
                            background: chosen ? (ans.correct ? "rgba(90,154,106,0.12)" : "rgba(224,112,112,0.12)") : theme.bg,
                            color: theme.text,
                            cursor: "pointer",
                          }}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <FreeResponse q={q} saved={ans && ans.value} onSave={(v) => answerQuestion(q, v)} />
                )}

                {ans && q.type === "mc" && (
                  <div style={{ marginTop: 10 }}>
                    <Note kind={ans.correct ? "ok" : "danger"}>{ans.correct ? q.explainCorrect : q.explainWrong}</Note>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FreeResponse({ q, saved, onSave }) {
  const [text, setText] = useState(saved || "");
  const [done, setDone] = useState(Boolean(saved));
  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDone(false);
        }}
        rows={3}
        placeholder="Type your explanation…"
        style={{ width: "100%", font: "inherit", fontSize: 14, padding: 10, borderRadius: theme.radius, border: `0.5px solid ${theme.border}`, resize: "vertical", boxSizing: "border-box" }}
      />
      <div style={{ marginTop: 8 }}>
        <Button onClick={() => { onSave(text); setDone(true); }} disabled={!text.trim()}>Save response</Button>
      </div>
      {done && (
        <div style={{ marginTop: 10 }}>
          <Note kind="ok">Response recorded. For reference: {q.guidance}</Note>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Fresh empty state for a problem
// ----------------------------------------------------------------------------
const emptyState = () => ({ nodes: [], links: [], uid: 0, answers: {}, everWrong: false, solved: false, status: "untouched" });

// ----------------------------------------------------------------------------
// Shell: navigation + summary
// ----------------------------------------------------------------------------
export default function MOActivity({ order = MOLECULE_ORDER }) {
  const ids = order.filter((id) => MOLECULES[id]);
  const [idx, setIdx] = useState(0);
  const [view, setView] = useState("problem"); // "problem" | "summary"
  const [states, setStates] = useState(() => Object.fromEntries(ids.map((id) => [id, emptyState()])));

  const currentId = ids[idx];
  const mol = MOLECULES[currentId];

  const setState = (updater) =>
    setStates((prev) => {
      const next = typeof updater === "function" ? updater(prev[currentId]) : updater;
      return { ...prev, [currentId]: next };
    });

  const setStatus = (status) =>
    setStates((prev) => ({ ...prev, [currentId]: { ...prev[currentId], status } }));

  const go = (i) => {
    setIdx(i);
    setView("problem");
  };

  const solvedCount = ids.filter((id) => states[id].solved).length;

  const tab = (id, i) => {
    const st = STATUS[states[id].status] || STATUS.untouched;
    const active = i === idx && view === "problem";
    return (
      <button
        key={id}
        onClick={() => go(i)}
        style={{
          font: "inherit",
          fontSize: 13,
          padding: "6px 12px",
          borderRadius: 999,
          border: `0.5px solid ${active ? theme.text : theme.border}`,
          background: active ? theme.text : theme.bg,
          color: active ? theme.bg : theme.text,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 999, background: st.color, display: "inline-block" }} />
        {MOLECULES[id].title}
      </button>
    );
  };

  return (
    <div style={{ color: theme.text, fontFamily: "system-ui, sans-serif", maxWidth: 760, margin: "0 auto", padding: "24px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 20, fontWeight: 600 }}>Molecular orbital diagrams</span>
        <span style={{ fontSize: 13, color: theme.textMuted }}>{solvedCount} of {ids.length} solved</span>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "12px 0 20px" }}>
        {ids.map(tab)}
        <button
          onClick={() => setView("summary")}
          style={{
            font: "inherit",
            fontSize: 13,
            padding: "6px 12px",
            borderRadius: 999,
            border: `0.5px solid ${view === "summary" ? theme.text : theme.border}`,
            background: view === "summary" ? theme.text : theme.bg,
            color: view === "summary" ? theme.bg : theme.text,
            cursor: "pointer",
          }}
        >
          Summary
        </button>
      </div>

      {view === "problem" ? (
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 18, fontWeight: 500 }}>{mol.prompt}</span>
            <span style={{ fontSize: 13, color: theme.textMuted }}>Problem {idx + 1} of {ids.length}</span>
          </div>

          <DiagramBuilder
            key={currentId}
            mol={mol}
            state={states[currentId]}
            onState={setState}
            onStatus={setStatus}
          />

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
            <Button onClick={() => go(Math.max(0, idx - 1))} disabled={idx === 0}>← Previous</Button>
            {idx < ids.length - 1 ? (
              <Button onClick={() => go(idx + 1)}>Next →</Button>
            ) : (
              <Button onClick={() => setView("summary")}>Finish → Summary</Button>
            )}
          </div>
        </div>
      ) : (
        <Summary ids={ids} states={states} onOpen={go} />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// End-of-set summary
// ----------------------------------------------------------------------------
function Summary({ ids, states, onOpen }) {
  return (
    <div>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: theme.text, margin: "0 0 16px" }}>
        Your progress across all {ids.length} problems. Open any one to keep working; there is no lock-out and nothing is scored.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ids.map((id, i) => {
          const st = STATUS[states[id].status] || STATUS.untouched;
          const mc = MOLECULES[id].questions.filter((q) => q.type === "mc");
          const answered = mc.filter((q) => states[id].answers[q.id]).length;
          const rightMC = mc.filter((q) => states[id].answers[q.id] && states[id].answers[q.id].correct).length;
          return (
            <div
              key={id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 14px",
                background: theme.surface,
                border: `0.5px solid ${theme.border}`,
                borderRadius: theme.radius,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: st.color, display: "inline-block" }} />
                <span style={{ fontSize: 15, fontWeight: 500 }}>{MOLECULES[id].title}</span>
                <span style={{ fontSize: 13, color: st.color }}>{st.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 12, color: theme.textMuted }}>
                  {states[id].solved ? `questions ${rightMC}/${mc.length}` : answered ? `${answered} answered` : "\u00A0"}
                </span>
                <Button small onClick={() => onOpen(i)}>Open</Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
