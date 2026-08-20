import { formatCardOps, formatRiskHeadline, formatTradeLine } from "./logFormat";
import { applyNamedOps } from "./price";
import {
  COMPANIES,
  type Card,
  type CardOp,
  type ChoiceOp,
  type Company,
  type GameState,
  type Intent,
  type NamedOp,
} from "./types";

export type ReduceResult = {
  ok: boolean
  state: GameState
  error?: string
};

function cloneState(state: GameState): GameState {
  const { random, ...rest } = state;
  const next = structuredClone(rest) as GameState;
  next.random = random;
  return next;
}

function fail(state: GameState, error: string): ReduceResult {
  const next = cloneState(state);
  next.lastError = error;
  return { ok: false, state: next, error };
}

function currentPlayer(state: GameState) {
  return state.players[state.currentPlayerIndex];
}

export function hasChoice(ops: CardOp[]): boolean {
  return ops.some((op) => op.type === "deltaChoice" || op.type === "scaleChoice");
}

export function namedCompanies(card: Card): Company[] {
  return card.ops.flatMap((op) =>
    op.type === "delta" || op.type === "scale" ? [op.company] : [],
  );
}

export function allowedChoices(card: Card): Company[] {
  const taken = new Set(namedCompanies(card));
  return COMPANIES.filter((company) => !taken.has(company));
}

export function nextChoiceOp(card: Card): ChoiceOp | null {
  for (const op of card.ops) {
    if (op.type === "deltaChoice" || op.type === "scaleChoice") {
      return op;
    }
  }
  return null;
}

/** Human-readable prompt for the next unbound `[?]` on a pending card. */
export function nextChoicePrompt(card: Card): string {
  const op = nextChoiceOp(card);
  if (!op) return "Choose company";
  if (op.type === "deltaChoice") {
    const label = op.amount > 0 ? `+${op.amount}` : `${op.amount}`;
    return `Choose company for ${label}`;
  }
  const label = op.factor === 2 ? "2×" : "½";
  return `Choose company for ${label}`;
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

/** Bind the next choice op to `company`; returns error string on failure. */
export function bindNextChoice(card: Card, company: Company): Card | string {
  if (!nextChoiceOp(card)) {
    return "No company choice left on this card.";
  }
  if (!allowedChoices(card).includes(company)) {
    return "Pick a different company than the ones already on the card.";
  }
  let replaced = false;
  const ops = card.ops.map((op) => {
    if (
      !replaced &&
      (op.type === "deltaChoice" || op.type === "scaleChoice")
    ) {
      replaced = true;
      return asNamed(op, company);
    }
    return op;
  });
  return { ...card, ops };
}

export function insertAtRandom(
  pile: Card[],
  card: Card,
  random: () => number,
): number {
  const index = Math.floor(random() * (pile.length + 1));
  pile.splice(index, 0, card);
  return index;
}

function nextLogId(state: GameState): number {
  return state.log.reduce((max, entry) => Math.max(max, entry.id), -1) + 1;
}

function appendLog(state: GameState, text: string): void {
  state.log.push({ id: nextLogId(state), text });
}

function appendPlayLog(state: GameState, actor: string, card: Card): void {
  state.log.push({
    id: nextLogId(state),
    text: `${actor} plays ${formatCardOps(card)}`,
    play: { actor },
  });
}

function updatePlayLog(state: GameState, actor: string, card: Card): void {
  const text = `${actor} plays ${formatCardOps(card)}`;
  for (let i = state.log.length - 1; i >= 0; i -= 1) {
    if (state.log[i].play?.actor === actor) {
      state.log[i] = { ...state.log[i], text, play: { actor } };
      return;
    }
  }
  appendPlayLog(state, actor, card);
}

function findSessionTradeIndex(
  state: GameState,
  actor: string,
  company: Company,
): number {
  for (let i = state.log.length - 1; i >= 0; i -= 1) {
    const entry = state.log[i];
    if (!entry.trade) return -1;
    if (entry.trade.actor === actor && entry.trade.company === company) {
      return i;
    }
  }
  return -1;
}

function upsertTradeLog(
  state: GameState,
  company: Company,
  side: "buy" | "sell",
  quantity: number,
): void {
  const actor = currentPlayer(state).name;
  const price = state.prices[company];
  const index = findSessionTradeIndex(state, actor, company);
  const prev = index >= 0 ? state.log[index].trade : undefined;
  const trade = {
    actor,
    company,
    bought: (prev?.bought ?? 0) + (side === "buy" ? quantity : 0),
    sold: (prev?.sold ?? 0) + (side === "sell" ? quantity : 0),
    price: prev?.price ?? price,
  };
  const text = formatTradeLine(trade);
  if (index >= 0) {
    const [entry] = state.log.splice(index, 1);
    entry.trade = trade;
    entry.text = text;
    state.log.push(entry);
    return;
  }
  state.log.push({ id: nextLogId(state), text, trade });
}

function advanceTurn(state: GameState): void {
  state.pendingCard = null;
  const finishedIndex = state.currentPlayerIndex;
  const completedRound = finishedIndex === state.players.length - 1;
  if (completedRound) {
    state.roundsCompleted += 1;
    appendLog(
      state,
      `Round ${state.roundsCompleted} of ${state.roundsTotal} complete`,
    );
    if (state.roundsCompleted >= state.roundsTotal) {
      state.phase = "gameOver";
      appendLog(state, "Game over");
      return;
    }
  }
  state.currentPlayerIndex =
    (state.currentPlayerIndex + 1) % state.players.length;
  state.phase = "chooseTurn";
  const next = currentPlayer(state);
  appendLog(
    state,
    `Turn → ${next.name}${next.controller === "ai" ? ` (AI ${next.strategy ?? "defensive"})` : ""}`,
  );
}

/** Apply a fully-bound card and recycle it into the draw pile. */
function applyResolvedCard(state: GameState, card: Card): void {
  if (hasChoice(card.ops)) {
    throw new Error("Card still has unbound company choices.");
  }
  state.lastEvents = applyNamedOps(state, card.ops as NamedOp[]);
  insertAtRandom(state.drawPile, card, state.random);
  state.pendingCard = null;
}

function requirePhase(state: GameState, ...phases: GameState["phase"][]): string | null {
  if (!phases.includes(state.phase)) {
    return `Cannot do that during ${state.phase}.`;
  }
  return null;
}

function trade(state: GameState, company: Company, quantity: number, side: "buy" | "sell"): string | null {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return "Quantity must be a positive integer.";
  }
  const player = currentPlayer(state);
  const price = state.prices[company];
  const cost = price * quantity;
  if (side === "buy") {
    if (cost > player.cash) {
      return "Not enough cash.";
    }
    player.cash -= cost;
    player.shares[company] += quantity;
    return null;
  }
  if (quantity > player.shares[company]) {
    return "You do not hold that many shares.";
  }
  player.shares[company] -= quantity;
  player.cash += cost;
  return null;
}

export function reduce(state: GameState, intent: Intent): ReduceResult {
  const next = cloneState(state);
  next.lastError = null;

  switch (intent.type) {
    case "draw": {
      const phaseError = requirePhase(next, "chooseTurn");
      if (phaseError) return fail(state, phaseError);
      if (next.drawPile.length === 0) {
        return fail(state, "Draw pile is empty. Choose Trade only.");
      }
      const card = next.drawPile.shift();
      if (!card) return fail(state, "Draw pile is empty.");
      next.lastDrawn = card;
      next.lastEvents = [];
      if (card.kind === "risk") {
        applyResolvedCard(next, card);
        appendLog(
          next,
          `${currentPlayer(next).name} draws ${formatRiskHeadline(card, next.lastEvents)}`,
        );
        next.phase = "optionalTrade";
        return { ok: true, state: next };
      }
      currentPlayer(next).hand.push(card);
      appendLog(next, `${currentPlayer(next).name} draws an Action`);
      next.phase = "chooseHandCard";
      return { ok: true, state: next };
    }
    case "startTrade": {
      const phaseError = requirePhase(next, "chooseTurn");
      if (phaseError) return fail(state, phaseError);
      next.lastEvents = [];
      next.lastDrawn = null;
      appendLog(next, `${currentPlayer(next).name} starts trade`);
      next.phase = "optionalTrade";
      return { ok: true, state: next };
    }
    case "playCard": {
      const phaseError = requirePhase(next, "chooseHandCard");
      if (phaseError) return fail(state, phaseError);
      const player = currentPlayer(next);
      const index = player.hand.findIndex((card) => card.id === intent.cardId);
      if (index < 0) return fail(state, "That card is not in your hand.");
      const [card] = player.hand.splice(index, 1);
      appendPlayLog(next, player.name, card);
      if (hasChoice(card.ops)) {
        next.pendingCard = structuredClone(card);
        next.phase = "chooseCompany";
        return { ok: true, state: next };
      }
      applyResolvedCard(next, card);
      advanceTurn(next);
      return { ok: true, state: next };
    }
    case "chooseCompany": {
      const phaseError = requirePhase(next, "chooseCompany");
      if (phaseError) return fail(state, phaseError);
      const card = next.pendingCard;
      if (!card) return fail(state, "No card waiting for a company choice.");
      const bound = bindNextChoice(card, intent.company);
      if (typeof bound === "string") return fail(state, bound);
      updatePlayLog(next, currentPlayer(next).name, bound);
      if (hasChoice(bound.ops)) {
        next.pendingCard = bound;
        next.phase = "chooseCompany";
        return { ok: true, state: next };
      }
      applyResolvedCard(next, bound);
      advanceTurn(next);
      return { ok: true, state: next };
    }
    case "buy":
    case "sell": {
      const phaseError = requirePhase(next, "optionalTrade");
      if (phaseError) {
        if (next.phase === "chooseHandCard" || next.phase === "chooseCompany") {
          return fail(
            state,
            "You cannot trade after playing an Action card. Trade only on a Trade-only turn or after a Risk.",
          );
        }
        return fail(state, phaseError);
      }
      const tradeError = trade(
        next,
        intent.company,
        intent.quantity,
        intent.type,
      );
      if (tradeError) return fail(state, tradeError);
      upsertTradeLog(next, intent.company, intent.type, intent.quantity);
      return { ok: true, state: next };
    }
    case "endTrade": {
      const phaseError = requirePhase(next, "optionalTrade");
      if (phaseError) return fail(state, phaseError);
      appendLog(next, `${currentPlayer(next).name} ends trade`);
      advanceTurn(next);
      return { ok: true, state: next };
    }
    default: {
      const _never: never = intent;
      return fail(state, `Unknown intent: ${JSON.stringify(_never)}`);
    }
  }
}

export function canTrade(state: GameState): boolean {
  return state.phase === "optionalTrade";
}
