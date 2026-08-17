import {
  COMPANIES,
  SPLIT_ABOVE,
  WIPEOUT_BELOW,
  type Company,
  type GameEvent,
  type GameState,
  type NamedOp,
} from "./types";

function emptyShares(): Record<Company, number> {
  return { commerzbank: 0, bayer: 0, bmw: 0, bp: 0 };
}

export function zeroShares(): Record<Company, number> {
  return emptyShares();
}

export function applyCompanyTarget(
  state: GameState,
  company: Company,
  target: number,
): GameEvent[] {
  const events: GameEvent[] = [];
  const from = state.prices[company];

  if (target > SPLIT_ABOVE) {
    let remaining = target;
    let doubled = false;
    while (remaining > SPLIT_ABOVE) {
      for (const player of state.players) {
        player.shares[company] *= 2;
      }
      remaining = Math.floor(remaining / 2);
      doubled = true;
    }
    state.prices[company] = remaining;
    events.push({
      type: "split",
      company,
      from,
      target,
      newPrice: remaining,
      doubledShares: doubled,
    });
    return events;
  }

  if (target < WIPEOUT_BELOW) {
    for (const player of state.players) {
      player.shares[company] = 0;
    }
    state.prices[company] = 100;
    events.push({ type: "wipeout", company, from, target });
    return events;
  }

  state.prices[company] = target;
  if (from !== target) {
    events.push({ type: "priceChange", company, from, to: target });
  }
  return events;
}

export function targetFromOp(
  currentPrice: number,
  op: NamedOp,
): number {
  if (op.type === "delta") return currentPrice + op.amount;
  if (op.factor === 0.5) return Math.floor(currentPrice / 2);
  return currentPrice * 2;
}

export function applyNamedOps(state: GameState, ops: NamedOp[]): GameEvent[] {
  const events: GameEvent[] = [];
  for (const op of ops) {
    const target = targetFromOp(state.prices[op.company], op);
    events.push(...applyCompanyTarget(state, op.company, target));
  }
  return events;
}

export function netWorth(state: GameState, playerIndex: number): number {
  const player = state.players[playerIndex];
  let stocks = 0;
  for (const company of COMPANIES) {
    stocks += player.shares[company] * state.prices[company];
  }
  return player.cash + stocks;
}

export function ranking(
  state: GameState,
): Array<{ name: string; netWorth: number; tied: boolean }> {
  const rows = state.players.map((player, index) => ({
    name: player.name,
    netWorth: netWorth(state, index),
  }));
  rows.sort((a, b) => b.netWorth - a.netWorth);
  return rows.map((row) => ({
    ...row,
    tied: rows.filter((other) => other.netWorth === row.netWorth).length > 1,
  }));
}
