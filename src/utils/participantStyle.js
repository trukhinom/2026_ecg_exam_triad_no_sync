// src/utils/participantStyle.js
//
// Single source of participant colors/anonymized labels for ALL charts —
// previously PARTICIPANT_COLORS/PARTICIPANT_LABELS were duplicated in
// every src/charts/*.js. Now color consistency across charts is guaranteed
// by code structure (one import), not by remembering to copy the same
// hex values a third time.

export const PARTICIPANT_COLORS = {
  participant_1: "#d6337a",
  participant_2: "#1b5e4f",
  participant_3: "#4a90d9",
};

export const PARTICIPANT_LABELS = {
  participant_1: "Participant 1",
  participant_2: "Participant 2",
  participant_3: "Participant 3",
};
