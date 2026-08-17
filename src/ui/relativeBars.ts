import type { Company, GameEvent } from "../engine/types";

/** Digital board scale: wipeout floor → split ceiling, in $10 steps. */
export const PRICE_BOARD_MIN = 10;
export const PRICE_BOARD_MAX = 250;
export const PRICE_BOARD_STEP = 10;

function clampToBoard(price: number): number {
  return Math.min(PRICE_BOARD_MAX, Math.max(PRICE_BOARD_MIN, price));
}

/** Tick values 10, 20, …, 250 (25 pieces). */
export function priceBoardTicks(): number[] {
  const ticks: number[] = [];
  for (
    let value = PRICE_BOARD_MIN;
    value <= PRICE_BOARD_MAX;
    value += PRICE_BOARD_STEP
  ) {
    ticks.push(value);
  }
  return ticks;
}

/** How many $10 pieces are filled for this price (1 at $10 … 25 at $250). */
export function priceBoardFilledCount(price: number): number {
  return Math.round(clampToBoard(price) / PRICE_BOARD_STEP);
}

export type PieceHighlight = "gained" | "lost";

function eventTo(event: GameEvent): number {
  if (event.type === "priceChange") return event.to;
  if (event.type === "split") return event.newPrice;
  return 100;
}

/** Net price before/after this turn’s events for one company. */
export function lastPriceSpan(
  events: GameEvent[],
  company: Company,
): { from: number; to: number } | null {
  const relevant = events.filter((event) => event.company === company);
  if (relevant.length === 0) return null;
  return {
    from: relevant[0].from,
    to: eventTo(relevant[relevant.length - 1]),
  };
}

/** Whether this $10 tile was filled or emptied by a from→to price move. */
export function pricePieceHighlight(
  pieceIndex: number,
  fromPrice: number,
  toPrice: number,
): PieceHighlight | null {
  const wasFilled = pieceIndex < priceBoardFilledCount(fromPrice);
  const isFilled = pieceIndex < priceBoardFilledCount(toPrice);
  if (isFilled && !wasFilled) return "gained";
  if (!isFilled && wasFilled) return "lost";
  return null;
}
