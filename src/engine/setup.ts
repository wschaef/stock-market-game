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
  type AiStrategy,
  type Card,
  type GameState,
  type RandomFn,
  type SeatConfig,
} from "./types";

export type ShuffleFn = <T>(items: T[]) => T[];

export function fisherYates<T>(items: T[], random: RandomFn = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const identityShuffle: ShuffleFn = (items) => [...items];

export type PileCounts = {
  riskCards: number
  otherCards: number
};

export function maxOtherCardsForPlayers(playerCount: number): number {
  return ACTION_CARDS.length - STARTING_HAND * playerCount;
}

export function defaultPileCounts(playerCount: number): PileCounts {
  const maxOther = maxOtherCardsForPlayers(playerCount);
  return {
    riskCards: RISKS_PER_PLAYER_IN_PILE * playerCount,
    otherCards: Math.min(ACTIONS_PER_PLAYER_IN_PILE * playerCount, maxOther),
  };
}

export type SetupOptions = {
  seats: SeatConfig[]
  riskCards?: number
  otherCards?: number
  shuffle?: ShuffleFn
  random?: RandomFn
};

function normalizeSeats(input: string[] | SeatConfig[]): SeatConfig[] {
  if (input.length === 0) return [];
  if (typeof input[0] === "string") {
    return (input as string[]).map((name) => ({
      name,
      controller: "human" as const,
      strategy: null,
    }));
  }
  return input as SeatConfig[];
}

function resolveStrategy(
  controller: SeatConfig["controller"],
  strategy: AiStrategy | null | undefined,
): AiStrategy | null {
  if (controller !== "ai") return null;
  return strategy ?? "wealth";
}

function requirePileCount(
  label: string,
  value: number,
  max: number,
): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be an integer ≥ 0`);
  }
  if (value > max) {
    throw new Error(`${label} cannot exceed ${max}`);
  }
}

export function setupGame(
  seatsOrNames: string[] | SeatConfig[] | SetupOptions,
  shuffleArg: ShuffleFn = (items) => fisherYates(items),
): GameState {
  const options: SetupOptions =
    Array.isArray(seatsOrNames)
      ? { seats: normalizeSeats(seatsOrNames), shuffle: shuffleArg }
      : seatsOrNames;

  const seats = options.seats;
  const random = options.random ?? Math.random;
  const shuffle =
    options.shuffle ??
    ((items: Card[]) => fisherYates(items, random));

  if (seats.length < MIN_PLAYERS || seats.length > MAX_PLAYERS) {
    throw new Error(`Need ${MIN_PLAYERS}–${MAX_PLAYERS} players`);
  }

  const names = seats.map((seat) => seat.name.trim()).filter(Boolean);
  if (names.length !== seats.length) {
    throw new Error("Player names cannot be empty");
  }

  for (const seat of seats) {
    if (seat.controller === "ai" && seat.strategy != null) {
      const ok = seat.strategy === "wealth" || seat.strategy === "punish" || seat.strategy === "balanced";
      if (!ok) throw new Error(`Unknown AI strategy: ${String(seat.strategy)}`);
    }
  }

  const n = seats.length;
  const defaults = defaultPileCounts(n);
  const riskCards = options.riskCards ?? defaults.riskCards;
  const otherCards = options.otherCards ?? defaults.otherCards;
  const maxOther = maxOtherCardsForPlayers(n);

  requirePileCount("Risk cards", riskCards, RISK_CARDS.length);
  requirePileCount("Other cards", otherCards, maxOther);
  if (riskCards + otherCards < 1) {
    throw new Error("Draw pile needs at least 1 card (risk + other)");
  }

  const actions = shuffle(ACTION_CARDS.map((card) => ({ ...card })));
  const risks = shuffle(RISK_CARDS.map((card) => ({ ...card })));

  const players = seats.map((seat, index) => ({
    id: `p${index + 1}`,
    name: names[index],
    cash: STARTING_CASH,
    shares: zeroShares(),
    hand: actions.splice(0, STARTING_HAND),
    controller: seat.controller,
    strategy: resolveStrategy(seat.controller, seat.strategy),
  }));

  const pileActions = actions.splice(0, otherCards);
  const pileRisks = risks.splice(0, riskCards);
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
    log: [
      {
        id: 0,
        text: `Game started · ${n} players · ${riskCards} risk · ${otherCards} other`,
      },
    ],
    random,
  };
}
