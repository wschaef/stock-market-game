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
