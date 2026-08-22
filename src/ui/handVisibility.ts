import type { Card, GameState } from "../engine/types";
import { formatRiskHeadline } from "../engine/logFormat";

export type FaceUpHand = {
  mode: "faceUp"
  ownerIndex: number
  ownerName: string
  cards: Card[]
  playable: boolean
  label: string
};

export type HiddenHand = {
  mode: "hidden"
  ownerIndex: number
  ownerName: string
  count: number
  label: string
};

export type HandPresentation = FaceUpHand | HiddenHand;

/** Seat whose private hand the local device should reveal, if any. */
export function viewingSeatIndex(state: GameState): number | null {
  const humans: number[] = [];
  for (let index = 0; index < state.players.length; index += 1) {
    if (state.players[index].controller === "human") humans.push(index);
  }
  if (humans.length === 1) return humans[0];
  if (humans.length === 0) return null;
  const current = state.currentPlayerIndex;
  return state.players[current].controller === "human" ? current : null;
}

export function handPresentation(state: GameState): HandPresentation {
  const viewer = viewingSeatIndex(state);
  if (viewer !== null) {
    const owner = state.players[viewer];
    return {
      mode: "faceUp",
      ownerIndex: viewer,
      ownerName: owner.name,
      cards: owner.hand,
      playable:
        state.phase === "chooseHandCard" &&
        state.currentPlayerIndex === viewer &&
        owner.controller === "human",
      label: "Your cards",
    };
  }

  const current = state.players[state.currentPlayerIndex];
  return {
    mode: "hidden",
    ownerIndex: state.currentPlayerIndex,
    ownerName: current.name,
    count: current.hand.length,
    label: `${current.name}'s cards`,
  };
}

export type LastDrawnView =
  | { visible: false }
  | { visible: true; hidden: true; message: string }
  | { visible: true; hidden: false; card: Card };

export function lastDrawnView(state: GameState): LastDrawnView {
  const card = state.lastDrawn;
  if (!card) return { visible: false };
  if (card.kind === "risk") {
    return state.phase === "optionalTrade"
      ? { visible: true, hidden: false, card }
      : { visible: false };
  }
  if (state.phase !== "chooseHandCard") return { visible: false };
  const viewer = viewingSeatIndex(state);
  if (viewer !== null && viewer === state.currentPlayerIndex) {
    return { visible: true, hidden: false, card };
  }
  return { visible: true, hidden: true, message: "An Action was drawn (hidden)." };
}

export function lastDrawnAnnouncement(state: GameState): string | null {
  const view = lastDrawnView(state);
  if (!view.visible) return null;
  if (view.hidden) return view.message;
  if (view.card.kind === "risk") {
    return `Last drawn: ${formatRiskHeadline(view.card, state.lastEvents)}`;
  }
  return `Last drawn: ${view.card.title}`;
}
