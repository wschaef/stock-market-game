import { describe, expect, it } from "vitest";
import {
  PRICE_BOARD_MAX,
  PRICE_BOARD_MIN,
  PRICE_BOARD_STEP,
  priceBoardFilledCount,
  priceBoardTicks,
} from "./relativeBars";

describe("price board scale", () => {
  it("uses a 10–250 board with steps of 10", () => {
    expect(PRICE_BOARD_MIN).toBe(10);
    expect(PRICE_BOARD_MAX).toBe(250);
    expect(PRICE_BOARD_STEP).toBe(10);
  });

  it("lists 25 piece ticks from 10 through 250", () => {
    const ticks = priceBoardTicks();
    expect(ticks[0]).toBe(10);
    expect(ticks[ticks.length - 1]).toBe(250);
    expect(ticks).toHaveLength(25);
  });

  it("fills one piece per $10 on the board", () => {
    expect(priceBoardFilledCount(10)).toBe(1);
    expect(priceBoardFilledCount(100)).toBe(10);
    expect(priceBoardFilledCount(250)).toBe(25);
  });

  it("clamps outside the board when counting pieces", () => {
    expect(priceBoardFilledCount(0)).toBe(1);
    expect(priceBoardFilledCount(300)).toBe(25);
  });
});
