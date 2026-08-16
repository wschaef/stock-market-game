import { applyNamedOps, netWorth } from "../engine/price";
import { allowedChoices, hasChoice } from "../engine/turn";
import type {
  Card,
  CardOp,
  ChoiceOp,
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

function isChoice(op: CardOp): op is ChoiceOp {
  return op.type === "deltaChoice" || op.type === "scaleChoice";
}

function asNamed(op: ChoiceOp, company: Company): NamedOp {
  if (op.type === "deltaChoice") {
    return { type: "delta", company, amount: op.amount };
  }
  return { type: "scale", company, factor: op.factor };
}

/** Distinct company sequences of length `n` drawn from `pool` without reuse. */
function assignments(pool: Company[], n: number): Company[][] {
  if (n === 0) return [[]];
  if (n > pool.length) return [];
  const result: Company[][] = [];
  for (let i = 0; i < pool.length; i += 1) {
    const pick = pool[i];
    const rest = pool.filter((_, index) => index !== i);
    for (const tail of assignments(rest, n - 1)) {
      result.push([pick, ...tail]);
    }
  }
  return result;
}

function resolveOpsWays(card: Card): NamedOp[][] {
  const choiceOps = card.ops.filter(isChoice);
  if (choiceOps.length === 0) {
    return [card.ops as NamedOp[]];
  }
  const pool = allowedChoices(card);
  return assignments(pool, choiceOps.length).map((companies) => {
    let choiceIndex = 0;
    return card.ops.map((op) => {
      if (isChoice(op)) {
        const company = companies[choiceIndex];
        choiceIndex += 1;
        return asNamed(op, company);
      }
      return op;
    });
  });
}

function wealthAfter(state: GameState, ops: NamedOp[]): number[] {
  const next = structuredClone(state);
  applyNamedOps(next, ops);
  return next.players.map((_, index) => netWorth(next, index));
}

/** Preview each player's total-wealth change if `card` were applied now. */
export function previewCardWealth(
  state: GameState,
  card: Card,
): CardWealthPreview {
  const befores = state.players.map((_, index) => netWorth(state, index));
  const choiceNeeded = hasChoice(card.ops);
  const aftersPerChoice = resolveOpsWays(card).map((ops) =>
    wealthAfter(state, ops),
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
