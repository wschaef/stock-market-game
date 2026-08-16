import { ACTION_CARDS, RISK_CARDS } from "./catalog";
import { zeroShares } from "./price";
import {
  ACTIONS_PER_PLAYER_IN_PILE,
  DEFAULT_ROUNDS,
  MAX_PLAYERS,
  MAX_ROUNDS,
  MIN_PLAYERS,
  MIN_ROUNDS,
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

export type SetupOptions = {
  seats: SeatConfig[]
  roundsTotal?: number
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

  const roundsTotal = options.roundsTotal ?? DEFAULT_ROUNDS;
  if (
    !Number.isInteger(roundsTotal) ||
    roundsTotal < MIN_ROUNDS ||
    roundsTotal > MAX_ROUNDS
  ) {
    throw new Error(`Rounds must be an integer from ${MIN_ROUNDS} to ${MAX_ROUNDS}`);
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
    roundsTotal,
    roundsCompleted: 0,
    log: [
      {
        id: 0,
        text: `Game started · ${n} players · ${roundsTotal} round${roundsTotal === 1 ? "" : "s"}`,
      },
    ],
    random,
  };
}
