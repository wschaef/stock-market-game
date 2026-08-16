import { applyNamedOps, netWorth } from "../engine/price";
import { allowedChoices } from "../engine/turn";
import type {
  Card,
  CardOp,
  Company,
  GameState,
  NamedOp,
} from "../engine/types";

export type PlayerWealthPreview = {
  playerId: string
  name: string
  before: number
  afterMin: number
  afterMax: number
  deltaMin: number
  deltaMax: number
};

export type CardWealthPreview = {
  dependsOnChoice: boolean
  players: PlayerWealthPreview[]
};

function hasChoice(ops: CardOp[]): boolean {
  return ops.some((op) => op.type === "deltaChoice" || op.type === "scaleChoice");
}

function asNamed(op: CardOp, company: Company): NamedOp {
  if (op.type === "deltaChoice") {
    return { type: "delta", company, amount: op.amount };
  }
  if (op.type === "scaleChoice") {
    return { type: "scale", company, factor: op.factor };
  }
  return op;
}

function resolveOps(card: Card, choice: Company | null): NamedOp[] {
  if (!hasChoice(card.ops)) {
    return card.ops as NamedOp[];
  }
  if (!choice) {
    throw new Error("Choice required");
  }
  return card.ops.map((op) => asNamed(op, choice));
}

function wealthAfter(state: GameState, card: Card, choice: Company | null): number[] {
  const { random, ...rest } = state;
  const next = structuredClone(rest) as GameState;
  next.random = random;
  applyNamedOps(next, resolveOps(card, choice));
  return next.players.map((_, index) => netWorth(next, index));
}

/** Preview each player's total-wealth change if `card` were applied now. */
export function previewCardWealth(
  state: GameState,
  card: Card,
): CardWealthPreview {
  const befores = state.players.map((_, index) => netWorth(state, index));
  const choiceNeeded = hasChoice(card.ops);
  const choiceCompanies = choiceNeeded ? allowedChoices(card) : [null];

  const aftersPerChoice = choiceCompanies.map((choice) =>
    wealthAfter(state, card, choice),
  );

  const players: PlayerWealthPreview[] = state.players.map((player, index) => {
    const before = befores[index];
    const afterValues = aftersPerChoice.map((row) => row[index]);
    const afterMin = Math.min(...afterValues);
    const afterMax = Math.max(...afterValues);
    return {
      playerId: player.id,
      name: player.name,
      before,
      afterMin,
      afterMax,
      deltaMin: afterMin - before,
      deltaMax: afterMax - before,
    };
  });

  return { dependsOnChoice: choiceNeeded, players };
}
