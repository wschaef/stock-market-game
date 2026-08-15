import { ACTION_CARDS, RISK_CARDS } from "./catalog";
import { zeroShares } from "./price";
import {
  ACTIONS_PER_PLAYER_IN_PILE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  RISKS_PER_PLAYER_IN_PILE,
  STARTING_CASH,
  STARTING_HAND,
  STARTING_PRICE,
  type Card,
  type GameState,
} from "./types";

export type ShuffleFn = <T>(items: T[]) => T[];

export function fisherYates<T>(items: T[], random = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const identityShuffle: ShuffleFn = (items) => [...items];

export function setupGame(
  playerNames: string[],
  shuffle: ShuffleFn = (items) => fisherYates(items),
): GameState {
  if (playerNames.length < MIN_PLAYERS || playerNames.length > MAX_PLAYERS) {
    throw new Error(`Need ${MIN_PLAYERS}–${MAX_PLAYERS} players`);
  }
  const names = playerNames.map((name) => name.trim()).filter(Boolean);
  if (names.length !== playerNames.length) {
    throw new Error("Player names cannot be empty");
  }

  const n = names.length;
  const actions = shuffle(ACTION_CARDS.map((card) => ({ ...card })));
  const risks = shuffle(RISK_CARDS.map((card) => ({ ...card })));

  const players = names.map((name, index) => ({
    id: `p${index + 1}`,
    name,
    cash: STARTING_CASH,
    shares: zeroShares(),
    hand: actions.splice(0, STARTING_HAND),
  }));

  const pileActions = actions.splice(0, ACTIONS_PER_PLAYER_IN_PILE * n);
  const pileRisks = risks.splice(0, RISKS_PER_PLAYER_IN_PILE * n);
  const drawPile = shuffle([...pileActions, ...pileRisks]);
  const unusedCards: Card[] = [...actions, ...risks];

  return {
    players,
    currentPlayerIndex: 0,
    prices: {
      commerzbank: STARTING_PRICE,
      bayer: STARTING_PRICE,
      bmw: STARTING_PRICE,
      bp: STARTING_PRICE,
    },
    drawPile,
    discardPile: [],
    unusedCards,
    phase: "chooseTurn",
    pendingCard: null,
    lastEvents: [],
    lastDrawn: null,
    lastError: null,
  };
}
