/**
 * molecules.js
 * -----------------------------------------------------------------------------
 * Content layer for the MO diagram activity. Everything an instructor is likely
 * to edit lives here: the answer keys, the accepted valence ordering, and the
 * follow-up questions. The engine (MOActivity.jsx) imports this and never needs
 * to change when you add or retune a molecule.
 *
 * KEY SHAPE
 *   title          display name (unicode ok)
 *   prompt         instruction shown above the canvas
 *   totalValence   expected total electrons across all levels
 *   bondOrder      correct bond order (used in feedback + a question)
 *   unpaired       correct number of unpaired electrons
 *   orderingHint   one sentence used in feedback when the ordering is wrong;
 *                  write it per molecule because the σ/π ordering is NOT the
 *                  same across the row (see notes below)
 *   electronNote   one sentence explaining the electron count
 *   key            array, BOTTOM (lowest energy) -> TOP (highest energy)
 *                    label       canonical label
 *                    alt         accepted notation variants (matched loosely)
 *                    occ         correct occupancy at the accepted fill
 *                    degenerate  true for π-type levels (occ 0..4, Hund checked)
 *                    nonbonding  optional flag, excluded from bond-order intuition
 *   questions      array of follow-up questions (see QUESTION SHAPE)
 *
 * QUESTION SHAPE
 *   { id, type: "mc",   prompt, options:[...], answer: <value in options>,
 *     explainCorrect, explainWrong }
 *   { id, type: "free", prompt, guidance }   // recorded, not auto-graded
 *
 *   The free-response "reasoning" question is passed into standardQuestions as
 *   a per-molecule `reasoning: { prompt, guidance }` because the bonding story
 *   is species-specific (electron added vs. removed vs. neutral isoelectronic).
 *
 * -----------------------------------------------------------------------------
 * CHEMISTRY NOTES — please read before deploying, some of these are choices:
 *
 * 1. Row ordering flips. Early second-row diatomics (through N2) put π2p BELOW
 *    σ2p because of s-p mixing; from O2 onward σ2p drops BELOW π2p. So C2/C2+/BN
 *    use π<σ, while NO- (isoelectronic with O2) uses σ<π. The keys below encode
 *    that; do not "fix" one to match another.
 *
 * 2. BN is genuinely subtle. Treated as isoelectronic with C2 (8 valence e) the
 *    simple textbook answer is a closed-shell (π2p)^4, diamagnetic, bond order
 *    2. High-level calculations actually favor a 3-Pi ground state with two
 *    unpaired electrons due to σ/π near-degeneracy. The key below uses the
 *    intro-textbook diamagnetic answer; if your course teaches the triplet,
 *    change `unpaired` to 2, the π2p occ to 3, and add a σ2p occ of 1.
 *
 * 3. HF is not a homonuclear ladder. H 1s mixes with F 2pz to give one bonding
 *    σ and one antibonding σ*; F 2s and the remaining F 2p pair are essentially
 *    nonbonding lone pairs. The AO sides sit at very different energies. Labels
 *    here are approximate; you will likely rename them for your notation.
 * -----------------------------------------------------------------------------
 */

// Build the standard trio of follow-ups for a homonuclear-style diatomic.
// `reasoning` is the per-molecule free-response { prompt, guidance }: the
// bonding story differs by species (electron added vs. removed vs. neutral),
// so it must be written per molecule rather than sharing one generic prompt.
function standardQuestions({ unpaired, bondOrder, reasoning }) {
  const magnetism = unpaired === 0 ? "Diamagnetic" : "Paramagnetic";
  return [
    {
      id: "unpaired",
      type: "mc",
      prompt: "How many unpaired electrons does this molecule have?",
      options: ["0", "1", "2", "3", "4"],
      answer: String(unpaired),
      explainCorrect:
        "Correct. Unpaired electrons are the lone single arrows in your diagram; count the levels holding just one.",
      explainWrong:
        "Not quite. Unpaired electrons appear alone (a single ↑ or ↓) in a level. Scan for any level holding just one arrow, then count them.",
    },
    {
      id: "bondorder",
      type: "mc",
      prompt: "What is the bond order?",
      options: ["0.5", "1", "1.5", "2", "2.5", "3"],
      answer: String(bondOrder),
      explainCorrect: "Correct. Bond order = (bonding − antibonding) / 2.",
      explainWrong:
        "Not quite. Bond order = (bonding electrons − antibonding electrons) / 2. Count electrons in bonding levels versus starred (antibonding) levels.",
    },
    {
      id: "magnetism",
      type: "mc",
      prompt: "Is this molecule diamagnetic or paramagnetic?",
      options: ["Diamagnetic", "Paramagnetic"],
      answer: magnetism,
      explainCorrect:
        magnetism === "Diamagnetic"
          ? "Correct. With every electron paired, the molecule is diamagnetic."
          : "Correct. Unpaired electrons make the molecule paramagnetic.",
      explainWrong:
        "Not quite. A molecule is paramagnetic when it has one or more unpaired electrons, and diamagnetic when all electrons are paired.",
    },
    {
      id: "reasoning",
      type: "free",
      prompt: reasoning.prompt,
      guidance: reasoning.guidance,
    },
  ];
}

export const MOLECULES = {
  "C2^2-": {
    title: "C₂²⁻",
    prompt: "Construct the MO diagram for C₂²⁻",
    totalValence: 10,
    bondOrder: 3,
    unpaired: 0,
    orderingHint:
      "For C₂ the π2p levels lie BELOW σ2p. Lowest energy sits at the bottom of the canvas.",
    electronNote:
      "C₂²⁻ has 10 valence electrons: 8 from two carbons plus 2 for the 2− charge.",
    key: [
      { label: "σ2s", alt: ["sigma2s"], occ: 2 },
      { label: "σ*2s", alt: ["sigma*2s"], occ: 2 },
      { label: "π2p", alt: ["pi2p"], degenerate: true, occ: 4 },
      { label: "σ2p", alt: ["sigma2p"], occ: 2 },
      { label: "π*2p", alt: ["pi*2p"], degenerate: true, occ: 0 },
      { label: "σ*2p", alt: ["sigma*2p"], occ: 0 },
    ],
    questions: standardQuestions({
      unpaired: 0,
      bondOrder: 3,
      reasoning: {
        prompt:
          "In a sentence, explain how adding two electrons to neutral C₂ raises the bond order.",
        guidance:
          "Neutral C₂ has bond order 2 (its π2p bonding set is full). The two extra electrons fill the bonding σ2p level, so (bonding − antibonding) / 2 climbs from 2 to 3.",
      },
    }),
  },

  "C2^+": {
    title: "C₂⁺",
    prompt: "Construct the MO diagram for C₂⁺",
    totalValence: 7,
    bondOrder: 1.5,
    unpaired: 1,
    orderingHint:
      "For C₂ the π2p levels lie BELOW σ2p. Lowest energy sits at the bottom of the canvas.",
    electronNote:
      "C₂⁺ has 7 valence electrons: 8 from two carbons minus 1 for the + charge.",
    key: [
      { label: "σ2s", alt: ["sigma2s"], occ: 2 },
      { label: "σ*2s", alt: ["sigma*2s"], occ: 2 },
      { label: "π2p", alt: ["pi2p"], degenerate: true, occ: 3 },
      { label: "σ2p", alt: ["sigma2p"], occ: 0 },
      { label: "π*2p", alt: ["pi*2p"], degenerate: true, occ: 0 },
      { label: "σ*2p", alt: ["sigma*2p"], occ: 0 },
    ],
    questions: standardQuestions({
      unpaired: 1,
      bondOrder: 1.5,
      reasoning: {
        prompt:
          "In a sentence, explain how removing one electron from neutral C₂ lowers the bond order.",
        guidance:
          "Neutral C₂ has bond order 2. The electron is pulled from a filled bonding π2p level, so (bonding − antibonding) / 2 drops from 2 to 1.5.",
      },
    }),
  },

  BN: {
    title: "BN",
    prompt: "Construct the MO diagram for BN",
    totalValence: 8,
    bondOrder: 2,
    unpaired: 0, // intro-textbook (isoelectronic with C2); see note 2 above
    orderingHint:
      "BN is isoelectronic with C₂: the π2p levels lie BELOW σ2p. Lowest energy at the bottom.",
    electronNote:
      "BN has 8 valence electrons: 3 from boron and 5 from nitrogen.",
    key: [
      { label: "σ2s", alt: ["sigma2s"], occ: 2 },
      { label: "σ*2s", alt: ["sigma*2s"], occ: 2 },
      { label: "π2p", alt: ["pi2p"], degenerate: true, occ: 4 },
      { label: "σ2p", alt: ["sigma2p"], occ: 0 },
      { label: "π*2p", alt: ["pi*2p"], degenerate: true, occ: 0 },
      { label: "σ*2p", alt: ["sigma*2p"], occ: 0 },
    ],
    questions: standardQuestions({
      unpaired: 0,
      bondOrder: 2,
      reasoning: {
        prompt:
          "In a sentence, explain why BN — isoelectronic with C₂ — has a bond order of 2.",
        guidance:
          "BN's 8 valence electrons fill the same levels as neutral C₂: σ2s² σ*2s² π2p⁴. That leaves four more bonding than antibonding electrons, so (bonding − antibonding) / 2 = 2.",
      },
    }),
  },

  "NO^-": {
    title: "NO⁻",
    prompt: "Construct the MO diagram for NO⁻",
    totalValence: 12,
    bondOrder: 2,
    unpaired: 2,
    orderingHint:
      "NO⁻ is isoelectronic with O₂: here σ2p lies BELOW the π2p levels. Lowest energy at the bottom.",
    electronNote:
      "NO⁻ has 12 valence electrons: 5 from nitrogen, 6 from oxygen, plus 1 for the − charge.",
    key: [
      { label: "σ2s", alt: ["sigma2s"], occ: 2 },
      { label: "σ*2s", alt: ["sigma*2s"], occ: 2 },
      { label: "σ2p", alt: ["sigma2p"], occ: 2 },
      { label: "π2p", alt: ["pi2p"], degenerate: true, occ: 4 },
      { label: "π*2p", alt: ["pi*2p"], degenerate: true, occ: 2 },
      { label: "σ*2p", alt: ["sigma*2p"], occ: 0 },
    ],
    questions: standardQuestions({
      unpaired: 2,
      bondOrder: 2,
      reasoning: {
        prompt:
          "In a sentence, explain how adding one electron to neutral NO lowers the bond order.",
        guidance:
          "Neutral NO has bond order 2.5, with a single electron already in an antibonding π*2p level. The added electron joins that π*2p set, so (bonding − antibonding) / 2 falls from 2.5 to 2.",
      },
    }),
  },

  HF: {
    title: "HF",
    prompt: "Construct the MO diagram for HF",
    totalValence: 8,
    bondOrder: 1,
    unpaired: 0,
    orderingHint:
      "In HF only H 1s and F 2pz combine into a σ / σ* pair; F 2s and the other two F 2p orbitals stay nonbonding. Nonbonding lone pairs sit between the bonding σ and σ*.",
    electronNote:
      "HF has 8 valence electrons: 1 from hydrogen and 7 from fluorine.",
    key: [
      { label: "σ2s", alt: ["sigma2s", "2s(F)", "nb2s"], occ: 2, nonbonding: true },
      { label: "σ", alt: ["sigma", "σsp", "1σ"], occ: 2 },
      { label: "πnb", alt: ["pi_nb", "π(nb)", "lonepair", "πlp"], degenerate: true, occ: 4, nonbonding: true },
      { label: "σ*", alt: ["sigma*"], occ: 0 },
    ],
    questions: [
      {
        id: "unpaired",
        type: "mc",
        prompt: "How many unpaired electrons does HF have?",
        options: ["0", "1", "2", "3", "4"],
        answer: "0",
        explainCorrect:
          "Correct. The bonding σ is filled and the F lone pairs are all paired, so nothing is unpaired.",
        explainWrong:
          "Not quite. Every occupied level in HF holds a pair: the bonding σ and the fluorine lone pairs. Look for any single arrow.",
      },
      {
        id: "bondorder",
        type: "mc",
        prompt: "What is the bond order of HF?",
        options: ["0.5", "1", "1.5", "2"],
        answer: "1",
        explainCorrect:
          "Correct. One bonding pair in the σ level, no antibonding electrons, so bond order is 1.",
        explainWrong:
          "Not quite. Only the σ level is bonding (2 electrons); the nonbonding lone pairs do not count. Bond order = (2 − 0)/2.",
      },
      {
        id: "nonbonding",
        type: "free",
        prompt:
          "Which fluorine orbitals end up nonbonding, and why can't they mix with hydrogen's 1s?",
        guidance:
          "Consider symmetry and energy match: H 1s meets F 2pz along the bond axis, while F 2s is too low and F 2px/2py have the wrong symmetry to overlap.",
      },
    ],
  },
};

// Order in which problems are presented.
export const MOLECULE_ORDER = ["C2^2-", "C2^+", "BN", "NO^-", "HF"];

// --- label matching ---------------------------------------------------------
export const norm = (s) =>
  (s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/sigma/g, "σ")
    .replace(/pi/g, "π")
    .replace(/\u2217/g, "*");

export function matchesKeyLabel(userLabel, keyEntry) {
  const u = norm(userLabel);
  if (u === norm(keyEntry.label)) return true;
  return (keyEntry.alt || []).some((a) => norm(a) === u);
}
