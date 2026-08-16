import { netWorth } from "./price";
import { allowedChoices, reduce } from "./turn";
import {
  COMPANIES,
  type AiStrategy,
  type Card,
  type Company,
  type GameState,
  type Intent,
} from "./types";

const TRADE_STEP_CAP = 12;

const INTENT_PREF: Record<Intent["type"], number> = {
  endTrade: 0,
  sell: 1,
  buy: 2,
  chooseCompany: 3,
  playCard: 4,
  startTrade: 5,
  draw: 6,
};

function bestRivalWorth(state: GameState, self: number): number {
  let best = -Infinity;
  for (let i = 0; i < state.players.length; i++) {
    if (i === self) continue;
    best = Math.max(best, netWorth(state, i));
  }
  return best;
}

/** Lexicographic score vector; higher is better at the first differing component. */
export function strategyScoreVector(
  state: GameState,
  self: number,
  strategy: AiStrategy,
): number[] {
  const w = netWorth(state, self);
  const rival = bestRivalWorth(state, self);
  const lead = w - rival;
  if (strategy === "wealth") return [w, lead];
  if (strategy === "punish") return [lead, -rival, w];
  return [w - 0.5 * rival];
}

function compareVectors(a: number[], b: number[]): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av > bv ? 1 : -1;
  }
  return 0;
}

function intentTieKey(intent: Intent): (string | number)[] {
  switch (intent.type) {
    case "playCard":
      // Lower card id preferred (string compare inverted in compareTieKeys).
      return [INTENT_PREF.playCard, intent.cardId];
    case "chooseCompany":
      // Lower company index preferred.
      return [INTENT_PREF.chooseCompany, -COMPANIES.indexOf(intent.company)];
    case "buy":
      return [
        INTENT_PREF.buy,
        -COMPANIES.indexOf(intent.company),
        intent.quantity,
      ];
    case "sell":
      return [
        INTENT_PREF.sell,
        -COMPANIES.indexOf(intent.company),
        intent.quantity,
      ];
    default:
      return [INTENT_PREF[intent.type]];
  }
}

function compareTieKeys(a: Intent, b: Intent): number {
  const ak = intentTieKey(a);
  const bk = intentTieKey(b);
  const n = Math.max(ak.length, bk.length);
  for (let i = 0; i < n; i++) {
    const av = ak[i] ?? 0;
    const bv = bk[i] ?? 0;
    if (av === bv) continue;
    if (typeof av === "number" && typeof bv === "number") {
      // Higher key wins (INTENT_PREF; negated company index; larger qty).
      return av > bv ? 1 : -1;
    }
    const as = String(av);
    const bs = String(bv);
    if (as < bs) return 1; // lower card id preferred
    if (as > bs) return -1;
  }
  return 0;
}

type Scored = { intent: Intent; vector: number[] };

function pickBest(candidates: Scored[]): Intent {
  if (candidates.length === 0) {
    throw new Error("AI has no legal intents");
  }
  let best = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i];
    const cmp = compareVectors(c.vector, best.vector);
    if (cmp > 0) {
      best = c;
      continue;
    }
    if (cmp === 0 && compareTieKeys(c.intent, best.intent) > 0) {
      best = c;
    }
  }
  return best.intent;
}

function scoreAfter(state: GameState, intent: Intent, strategy: AiStrategy, self: number): number[] | null {
  const result = reduce(state, intent);
  if (!result.ok) return null;
  return strategyScoreVector(result.state, self, strategy);
}

function uniquePositive(values: number[]): number[] {
  return [...new Set(values.filter((v) => v > 0))];
}

function tradeQuantityCandidates(
  state: GameState,
  company: Company,
  side: "buy" | "sell",
): number[] {
  const player = state.players[state.currentPlayerIndex];
  const price = state.prices[company];
  if (side === "buy") {
    if (price <= 0) return [];
    const maxAffordable = Math.floor(player.cash / price);
    return uniquePositive([
      1,
      Math.floor(maxAffordable / 2),
      maxAffordable,
    ]);
  }
  const held = player.shares[company];
  return uniquePositive([1, Math.floor(held / 2), held]);
}

function enumerateTradeIntents(state: GameState): Intent[] {
  const intents: Intent[] = [];
  for (const company of COMPANIES) {
    for (const quantity of tradeQuantityCandidates(state, company, "buy")) {
      intents.push({ type: "buy", company, quantity });
    }
    for (const quantity of tradeQuantityCandidates(state, company, "sell")) {
      intents.push({ type: "sell", company, quantity });
    }
  }
  return intents;
}

function simulateTradePlanScore(
  state: GameState,
  strategy: AiStrategy,
  self: number,
): number[] {
  let cursor = state;
  for (let step = 0; step < TRADE_STEP_CAP; step++) {
    if (cursor.phase !== "optionalTrade") break;
    const intent = chooseTradeIntent(cursor, strategy, self);
    if (intent.type === "endTrade") break;
    const applied = reduce(cursor, intent);
    if (!applied.ok) break;
    cursor = applied.state;
  }
  if (cursor.phase === "optionalTrade") {
    const ended = reduce(cursor, { type: "endTrade" });
    if (ended.ok) cursor = ended.state;
  }
  return strategyScoreVector(cursor, self, strategy);
}

function bestHandPlayScore(
  state: GameState,
  strategy: AiStrategy,
  self: number,
): number[] {
  const hand = state.players[self].hand;
  let best: number[] | null = null;
  for (const card of hand) {
    const vector = scoreCardPlay(state, card, strategy, self);
    if (!vector) continue;
    if (!best || compareVectors(vector, best) > 0) best = vector;
  }
  return best ?? strategyScoreVector(state, self, strategy);
}

function scoreThroughChoices(
  state: GameState,
  strategy: AiStrategy,
  self: number,
): number[] | null {
  if (state.phase !== "chooseCompany") {
    return strategyScoreVector(state, self, strategy);
  }
  const card = state.pendingCard;
  if (!card) return null;
  let best: number[] | null = null;
  for (const company of allowedChoices(card)) {
    const chosen = reduce(state, { type: "chooseCompany", company });
    if (!chosen.ok) continue;
    const vector = scoreThroughChoices(chosen.state, strategy, self);
    if (!vector) continue;
    if (!best || compareVectors(vector, best) > 0) best = vector;
  }
  return best;
}

function scoreCardPlay(
  state: GameState,
  card: Card,
  strategy: AiStrategy,
  self: number,
): number[] | null {
  const played = reduce(state, { type: "playCard", cardId: card.id });
  if (!played.ok) return null;
  return scoreThroughChoices(played.state, strategy, self);
}

function chooseTurnIntent(state: GameState, strategy: AiStrategy, self: number): Intent {
  const candidates: Scored[] = [];

  if (state.drawPile.length > 0) {
    // Non-cheating Draw heuristic: value of best play among current hand cards.
    const drawVec = bestHandPlayScore(state, strategy, self);
    candidates.push({ intent: { type: "draw" }, vector: drawVec });
  }

  const tradeStart = reduce(state, { type: "startTrade" });
  if (tradeStart.ok) {
    const tradeVec = simulateTradePlanScore(tradeStart.state, strategy, self);
    candidates.push({ intent: { type: "startTrade" }, vector: tradeVec });
  }

  if (candidates.length === 0) {
    return { type: "startTrade" };
  }
  return pickBest(candidates);
}

function chooseHandCardIntent(state: GameState, strategy: AiStrategy, self: number): Intent {
  const hand = state.players[self].hand;
  const scored: Scored[] = [];
  for (const card of hand) {
    const vector = scoreCardPlay(state, card, strategy, self);
    if (!vector) continue;
    scored.push({ intent: { type: "playCard", cardId: card.id }, vector });
  }
  return pickBest(scored);
}

function chooseCompanyIntent(state: GameState, strategy: AiStrategy, self: number): Intent {
  const card = state.pendingCard;
  if (!card) throw new Error("AI expected a pending card");
  const scored: Scored[] = [];
  for (const company of allowedChoices(card)) {
    const chosen = reduce(state, { type: "chooseCompany", company });
    if (!chosen.ok) continue;
    const vector = scoreThroughChoices(chosen.state, strategy, self);
    if (!vector) continue;
    scored.push({ intent: { type: "chooseCompany", company }, vector });
  }
  return pickBest(scored);
}

function chooseTradeIntent(state: GameState, strategy: AiStrategy, self: number): Intent {
  const endVec = strategyScoreVector(state, self, strategy);
  const improving: Scored[] = [];
  const neutralBuys: Scored[] = [];
  for (const intent of enumerateTradeIntents(state)) {
    const vector = scoreAfter(state, intent, strategy, self);
    if (!vector) continue;
    const cmp = compareVectors(vector, endVec);
    if (cmp > 0) improving.push({ intent, vector });
    else if (cmp === 0 && intent.type === "buy") {
      neutralBuys.push({ intent, vector });
    }
  }
  if (improving.length > 0) return pickBest(improving);
  // Fair-price buys leave net worth unchanged; still deploy cash deterministically.
  if (neutralBuys.length > 0) return pickBest(neutralBuys);
  return { type: "endTrade" };
}

/**
 * Pick the next intent for the current AI seat.
 * Call repeatedly until the seat’s turn advances or the game ends.
 */
export function chooseIntent(state: GameState): Intent {
  if (state.phase === "gameOver") {
    throw new Error("Game is over");
  }
  const player = state.players[state.currentPlayerIndex];
  if (player.controller !== "ai") {
    throw new Error("Current player is not AI");
  }
  const strategy = player.strategy ?? "wealth";
  const self = state.currentPlayerIndex;

  switch (state.phase) {
    case "chooseTurn":
      return chooseTurnIntent(state, strategy, self);
    case "chooseHandCard":
      return chooseHandCardIntent(state, strategy, self);
    case "chooseCompany":
      return chooseCompanyIntent(state, strategy, self);
    case "optionalTrade":
      return chooseTradeIntent(state, strategy, self);
    default: {
      const _never: never = state.phase;
      throw new Error(`No AI policy for phase ${_never}`);
    }
  }
}
