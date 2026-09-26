import type { Phase } from "../engine/types";

/** Narrow hand flyout must stay open when the human has to play a card. */
export function handFlyoutForcedOpen(input: {
  phase: Phase
  humanTurn: boolean
}): boolean {
  return input.humanTurn && input.phase === "chooseHandCard";
}
