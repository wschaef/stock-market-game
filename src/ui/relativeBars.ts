import { COMPANIES, type Company } from "../engine";

/** Digital board scale: wipeout floor → split ceiling, in $10 steps. */
export const PRICE_BOARD_MIN = 10;
export const PRICE_BOARD_MAX = 250;
export const PRICE_BOARD_STEP = 10;

function clampToBoard(price: number): number {
  return Math.min(PRICE_BOARD_MAX, Math.max(PRICE_BOARD_MIN, price));
}

/** Percent widths (0–100) on the fixed 10–250 board scale. */
export function priceBoardPercents(
  prices: Record<Company, number>,
): Record<Company, number> {
  const span = PRICE_BOARD_MAX - PRICE_BOARD_MIN;
  return Object.fromEntries(
    COMPANIES.map((company) => {
      const clamped = clampToBoard(prices[company]);
      return [company, ((clamped - PRICE_BOARD_MIN) / span) * 100];
    }),
  ) as Record<Company, number>;
}

/** Tick values 10, 20, …, 250. */
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
