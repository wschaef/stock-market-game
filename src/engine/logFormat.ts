import {
  COMPANY_LABEL,
  type Card,
  type CardOp,
  type Company,
  type GameEvent,
  type TradeLog,
} from "./types";

export function formatLogMoney(value: number): string {
  return `$${value.toLocaleString("en-US")}`;
}

function signedDelta(amount: number): string {
  return amount > 0 ? `+${amount}` : `${amount}`;
}

function formatOp(op: CardOp): string {
  if (op.type === "delta") {
    return `${signedDelta(op.amount)} ${COMPANY_LABEL[op.company]}`;
  }
  if (op.type === "scale") {
    const mag = op.factor === 2 ? "2×" : "½";
    return `${mag} ${COMPANY_LABEL[op.company]}`;
  }
  if (op.type === "deltaChoice") {
    return `${signedDelta(op.amount)} [?]`;
  }
  return `${op.factor === 2 ? "2×" : "½"} [?]`;
}

/** Human-readable card ops, with `[?]` only for still-unbound choices. */
export function formatCardOps(card: Card): string {
  return card.ops.map(formatOp).join(" / ");
}

export function formatTradeLine(trade: TradeLog): string {
  const label = COMPANY_LABEL[trade.company];
  const at = `at ${formatLogMoney(trade.price)}`;
  if (trade.bought > 0 && trade.sold > 0) {
    return `${trade.actor} buys ${trade.bought} / sells ${trade.sold} ${label} ${at} (buy ${formatLogMoney(trade.bought * trade.price)}, sell ${formatLogMoney(trade.sold * trade.price)})`;
  }
  if (trade.bought > 0) {
    return `${trade.actor} buys ${trade.bought} ${label} ${at} (${formatLogMoney(trade.bought * trade.price)})`;
  }
  return `${trade.actor} sells ${trade.sold} ${label} ${at} (${formatLogMoney(trade.sold * trade.price)})`;
}

function lastEventFor(
  events: GameEvent[],
  company: Company,
): GameEvent | undefined {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].company === company) return events[i];
  }
  return undefined;
}

function formatRiskOp(op: CardOp, events: GameEvent[]): string {
  if (op.type !== "delta") {
    return formatOp(op);
  }
  const label = COMPANY_LABEL[op.company];
  const mag = signedDelta(op.amount);
  const event = lastEventFor(events, op.company);
  if (!event) return `${label} ${mag}`;
  if (event.type === "split") {
    return `${label} ${mag} split ${formatLogMoney(event.from)} → ${formatLogMoney(event.newPrice)} (shares doubled)`;
  }
  if (event.type === "wipeout") {
    return `${label} ${mag} wipeout → $100 (shares lost)`;
  }
  return `${label} ${mag} (${formatLogMoney(event.to)})`;
}

/** Title plus per-company outcome, e.g. `Risk 1: Commerzbank +40 ($140), …`. */
export function formatRiskHeadline(card: Card, events: GameEvent[]): string {
  const effects = card.ops.map((op) => formatRiskOp(op, events)).join(", ");
  return `${card.title}: ${effects}`;
}
