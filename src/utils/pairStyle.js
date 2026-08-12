// src/utils/pairStyle.js
//
// Color/label scheme for participant PAIRS - used by charts about a
// relationship between two participants (currently just WCC), as opposed
// to participantStyle.js, which is about a single participant. Deliberately
// a different, distinct palette from participantStyle.js - reusing the
// same 3 colors for a different kind of entity (pair vs person) on a page
// where both appear would make it look like pair lines were tied to one
// specific participant's color, which they aren't.

export const PAIR_COLORS = {
  p1p2: "#e08214",
  p2p3: "#8073ac",
  p3p1: "#1b7837",
};

export const PAIR_LABELS = {
  p1p2: "Participant 1 × 2",
  p2p3: "Participant 2 × 3",
  p3p1: "Participant 3 × 1",
};
