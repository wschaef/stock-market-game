import { applyNamedOps, netWorth } from "./price";
import { allowedChoices, reduce } from "./turn";
import {
  COMPANIES,
  type AiStrategy,
  type Card,
  type CardOp,
  type ChoiceOp,
  type Company,
  type GameState,
  type Intent,
  type NamedOp,
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

export const STRATEGY_WEIGHTS: Record<
  AiStrategy,
  { wW: number; wL: number; wC: number; wR: number }
> = {
  aggressive: { wW: 1.0, wL: 0.85, wC: 1.15, wR: 0.4 },
  middle: { wW: 1.0, wL: 0.4, wC: 0.85, wR: 0.95 },
  defensive: { wW: 1.0, wL: 0, wC: 0.5, wR: 1.55 },
};

function bestRivalWorth(state: GameState, self: number): number {
  let best = -Infinity;
  for (let i = 0; i < state.players.length; i++) {
    if (i === self) continue;
    best = Math.max(best, netWorth(state, i));
  }
  return best;
}

function bestRivalShares(
  state: GameState,
  self: number,
  company: Company,
): number {
  let best = 0;
  for (let i = 0; i < state.players.length; i++) {
    if (i === self) continue;
    best = Math.max(best, state.players[i].shares[company]);
  }
  return best;
}

function isChoice(op: CardOp): op is ChoiceOp {
  return op.type === "deltaChoice" || op.type === "scaleChoice";
}

function asNamed(op: ChoiceOp, company: Company): NamedOp {
  if (op.type === "deltaChoice") {
    return { type: "delta", company, amount: op.amount };
  }
  return { type: "scale", company, factor: op.factor };
}

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

function cloneForSim(state: GameState): GameState {
  const { random, ...rest } = state;
  const next = structuredClone(rest) as GameState;
  next.random = random;
  return next;
}

/** Max non-wipeout Δprice for `company` obtainable by playing any hand card. */
export function handUpside(
  state: GameState,
  self: number,
  company: Company,
): number {
  const hand = state.players[self].hand;
  let best = 0;
  for (const card of hand) {
    for (const ops of resolveOpsWays(card)) {
      const next = cloneForSim(state);
      const events = applyNamedOps(next, ops);
      if (events.some((e) => e.type === "wipeout" && e.company === company)) {
        continue;
      }
      const delta = next.prices[company] - state.prices[company];
      if (delta > best) best = delta;
    }
  }
  return best;
}

export function wipeoutHeat(price: number): number {
  return Math.min(1, Math.max(0, (40 - price) / 30));
}

export function chanceScore(
  state: GameState,
  self: number,
  options: { includeEntry?: boolean } = {},
): number {
  const includeEntry = options.includeEntry ?? true;
  const player = state.players[self];
  let chance = 0;
  for (const company of COMPANIES) {
    const p = Math.max(state.prices[company], 1);
    const s = player.shares[company];
    const r = bestRivalShares(state, self, company);
    const u = handUpside(state, self, company);
    // Scale holding synergy below full dollar Δ so it does not outweigh realized wealth
    // when choosing which card to play (remaining-hand option value).
    chance += 0.3 * s * u;
    // Share-lead synergy is also scaled: at 1.0 * (s−r) * U, unrealized option
    // value outweighs realizing the same Δ via playCard (Trade-only deferral).
    chance += 0.3 * Math.max(0, s - r) * u;
    // Entry leverage is for trade decisions; omit when scoring card plays so
    // deferred pumps do not beat immediately better plays.
    if (includeEntry) {
      chance += (player.cash / p) * u * 0.2;
    }
  }
  return chance;
}

export function riskScore(state: GameState, self: number): number {
  const player = state.players[self];
  const w = netWorth(state, self);
  let wipeoutExposure = 0;
  let maxPosition = 0;
  for (const company of COMPANIES) {
    const price = state.prices[company];
    const s = player.shares[company];
    const v = s * price;
    maxPosition = Math.max(maxPosition, v);
    const u = handUpside(state, self, company);
    const orphan = u > 0 ? 0.55 : 1.0;
    wipeoutExposure += v * wipeoutHeat(price) * orphan;
  }
  // Soft concentration — enough to discourage all-in, not enough to reject good pumps.
  const concentration = 0.35 * w * (maxPosition / Math.max(w, 1)) ** 2;
  const cashStarvation = Math.max(0, 0.08 * w - player.cash) * 2;
  return wipeoutExposure + concentration + cashStarvation;
}

export type ScoreOptions = {
  /** Include cash×leverage entry term (default true). Off for card-play scoring. */
  includeEntry?: boolean
};

/** Higher is better. Shared brain; strategy selects weights only. */
export function strategyScore(
  state: GameState,
  self: number,
  strategy: AiStrategy,
  options: ScoreOptions = {},
): number {
  const w = netWorth(state, self);
  const lead = w - bestRivalWorth(state, self);
  const chance = chanceScore(state, self, {
    includeEntry: options.includeEntry,
  });
  const risk = riskScore(state, self);
  const { wW, wL, wC, wR } = STRATEGY_WEIGHTS[strategy];
  return wW * w + wL * lead + wC * chance - wR * risk;
}

/** @deprecated Use strategyScore; kept as single-element vector for callers. */
export function strategyScoreVector(
  state: GameState,
  self: number,
  strategy: AiStrategy,
): number[] {
  return [strategyScore(state, self, strategy)];
}

function compareScores(a: number, b: number): number {
  if (a === b) return 0;
  return a > b ? 1 : -1;
}

function intentTieKey(intent: Intent): (string | number)[] {
  switch (intent.type) {
    case "playCard":
      return [INTENT_PREF.playCard, intent.cardId];
    case "chooseCompany":
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
      return av > bv ? 1 : -1;
    }
    const as = String(av);
    const bs = String(bv);
    if (as < bs) return 1;
    if (as > bs) return -1;
  }
  return 0;
}

type Scored = { intent: Intent; score: number };

function pickBest(candidates: Scored[]): Intent {
  if (candidates.length === 0) {
    throw new Error("AI has no legal intents");
  }
  let best = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i];
    const cmp = compareScores(c.score, best.score);
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

function scoreAfter(
  state: GameState,
  intent: Intent,
  strategy: AiStrategy,
  self: number,
): number | null {
  const result = reduce(state, intent);
  if (!result.ok) return null;
  return strategyScore(result.state, self, strategy, { includeEntry: true });
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

function simulateTradePlan(
  state: GameState,
  strategy: AiStrategy,
  self: number,
): GameState {
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
  return cursor;
}

/** Undeployed cash + hand upside in names we barely hold → buy before empty card plays. */
function idleCashDeployer(state: GameState, self: number): boolean {
  const player = state.players[self];
  const w = netWorth(state, self);
  if (player.cash / Math.max(w, 1) < 0.35) return false;
  for (const company of COMPANIES) {
    const upside = handUpside(state, self, company);
    if (upside <= 0) continue;
    const book = player.shares[company] * state.prices[company];
    if (book < w * 0.15) return true;
  }
  return false;
}

function tradePlanDeployed(
  before: GameState,
  after: GameState,
  self: number,
): boolean {
  const prev = before.players[self];
  const next = after.players[self];
  if (prev.cash !== next.cash) return true;
  for (const company of COMPANIES) {
    if (prev.shares[company] !== next.shares[company]) return true;
  }
  return false;
}

/** Best post-play strategy score / wealth from the current hand (lookahead). */
type HandPlayBest = { score: number; wealth: number };

function bestHandPlay(
  state: GameState,
  strategy: AiStrategy,
  self: number,
): HandPlayBest {
  const hand = state.players[self].hand;
  let best: HandPlayBest | null = null;
  for (const card of hand) {
    const outcome = scoreCardPlayOutcome(state, card, strategy, self);
    if (outcome === null) continue;
    if (
      best === null ||
      outcome.score > best.score ||
      (outcome.score === best.score && outcome.wealth > best.wealth)
    ) {
      best = outcome;
    }
  }
  if (best) return best;
  return {
    score: strategyScore(state, self, strategy, { includeEntry: false }),
    wealth: netWorth(state, self),
  };
}

function scoreThroughChoices(
  state: GameState,
  strategy: AiStrategy,
  self: number,
): number | null {
  const outcome = scoreThroughChoicesOutcome(state, strategy, self);
  return outcome?.score ?? null;
}

function scoreThroughChoicesOutcome(
  state: GameState,
  strategy: AiStrategy,
  self: number,
): HandPlayBest | null {
  if (state.phase !== "chooseCompany") {
    return {
      score: strategyScore(state, self, strategy, { includeEntry: false }),
      wealth: netWorth(state, self),
    };
  }
  const card = state.pendingCard;
  if (!card) return null;
  let best: HandPlayBest | null = null;
  for (const company of allowedChoices(card)) {
    const chosen = reduce(state, { type: "chooseCompany", company });
    if (!chosen.ok) continue;
    const outcome = scoreThroughChoicesOutcome(chosen.state, strategy, self);
    if (outcome === null) continue;
    if (
      best === null ||
      outcome.score > best.score ||
      (outcome.score === best.score && outcome.wealth > best.wealth)
    ) {
      best = outcome;
    }
  }
  return best;
}

function scoreCardPlay(
  state: GameState,
  card: Card,
  strategy: AiStrategy,
  self: number,
): number | null {
  return scoreCardPlayOutcome(state, card, strategy, self)?.score ?? null;
}

function scoreCardPlayOutcome(
  state: GameState,
  card: Card,
  strategy: AiStrategy,
  self: number,
): HandPlayBest | null {
  // chooseTurn scores Draw by simulating a hand play; reduce() only accepts
  // playCard in chooseHandCard, so lift the phase for lookahead only.
  let from = state;
  if (state.phase === "chooseTurn") {
    from = cloneForSim(state);
    from.phase = "chooseHandCard";
  }
  const played = reduce(from, { type: "playCard", cardId: card.id });
  if (!played.ok) return null;
  return scoreThroughChoicesOutcome(played.state, strategy, self);
}

function chooseTurnIntent(
  state: GameState,
  strategy: AiStrategy,
  self: number,
): Intent {
  const wealthNow = netWorth(state, self);
  const candidates: Scored[] = [];
  let drawPlay: HandPlayBest | null = null;
  let tradeWealth = wealthNow;
  let tradeScoreWithEntry = strategyScore(state, self, strategy, {
    includeEntry: true,
  });

  if (state.drawPile.length > 0) {
    drawPlay = bestHandPlay(state, strategy, self);
    candidates.push({ intent: { type: "draw" }, score: drawPlay.score });
  }

  const tradeStart = reduce(state, { type: "startTrade" });
  let afterTrade: GameState | null = null;
  if (tradeStart.ok) {
    afterTrade = simulateTradePlan(tradeStart.state, strategy, self);
    tradeWealth = netWorth(afterTrade, self);
    tradeScoreWithEntry = strategyScore(afterTrade, self, strategy, {
      includeEntry: true,
    });
    candidates.push({
      intent: { type: "startTrade" },
      score: strategyScore(afterTrade, self, strategy, { includeEntry: false }),
    });
  }

  const drawWealth = drawPlay?.wealth ?? wealthNow;
  const drawGain = drawWealth - wealthNow;
  const tradeGain = tradeWealth - wealthNow;

  // Realizing a hand play beats standing when it raises wealth at least as much as trading.
  if (drawGain > 0 && drawGain >= tradeGain) {
    return { type: "draw" };
  }

  // Deploy idle cash into hand-strong names when the trade plan actually buys/sells.
  if (
    afterTrade &&
    idleCashDeployer(state, self) &&
    tradePlanDeployed(state, afterTrade, self) &&
    tradeScoreWithEntry > (drawPlay?.score ?? tradeScoreWithEntry)
  ) {
    return { type: "startTrade" };
  }

  // Trade sessions that do not increase net worth are empty loops — draw instead.
  if (tradeGain <= 0 && state.drawPile.length > 0) {
    return { type: "draw" };
  }

  if (candidates.length === 0) {
    return { type: "startTrade" };
  }
  return pickBest(candidates);
}

function chooseHandCardIntent(
  state: GameState,
  strategy: AiStrategy,
  self: number,
): Intent {
  const hand = state.players[self].hand;
  const scored: Scored[] = [];
  for (const card of hand) {
    const score = scoreCardPlay(state, card, strategy, self);
    if (score === null) continue;
    scored.push({ intent: { type: "playCard", cardId: card.id }, score });
  }
  return pickBest(scored);
}

function chooseCompanyIntent(
  state: GameState,
  strategy: AiStrategy,
  self: number,
): Intent {
  const card = state.pendingCard;
  if (!card) throw new Error("AI expected a pending card");
  const scored: Scored[] = [];
  for (const company of allowedChoices(card)) {
    const chosen = reduce(state, { type: "chooseCompany", company });
    if (!chosen.ok) continue;
    const score = scoreThroughChoices(chosen.state, strategy, self);
    if (score === null) continue;
    scored.push({ intent: { type: "chooseCompany", company }, score });
  }
  return pickBest(scored);
}

function chooseTradeIntent(
  state: GameState,
  strategy: AiStrategy,
  self: number,
): Intent {
  const endScore = strategyScore(state, self, strategy, { includeEntry: true });
  const improving: Scored[] = [];
  for (const intent of enumerateTradeIntents(state)) {
    const score = scoreAfter(state, intent, strategy, self);
    if (score === null) continue;
    if (compareScores(score, endScore) > 0) {
      improving.push({ intent, score });
    }
  }
  if (improving.length > 0) return pickBest(improving);
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
  const strategy = player.strategy ?? "defensive";
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
