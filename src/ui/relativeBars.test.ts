import { describe, expect, it } from "vitest";
import {
  PRICE_BOARD_MAX,
  PRICE_BOARD_MIN,
  PRICE_BOARD_STEP,
  priceBoardPercents,
  priceBoardTicks,
} from "./relativeBars";

describe("price board scale", () => {
  it("uses a 10–250 board with steps of 10", () => {
    expect(PRICE_BOARD_MIN).toBe(10);
    expect(PRICE_BOARD_MAX).toBe(250);
    expect(PRICE_BOARD_STEP).toBe(10);
  });

  it("maps 10 to 0% and 250 to 100%", () => {
    expect(
      priceBoardPercents({
        commerzbank: 10,
        bayer: 250,
        bmw: 130,
        bp: 100,
      }),
    ).toEqual({
      commerzbank: 0,
      bayer: 100,
      bmw: 50,
      bp: 37.5,
    });
  });

  it("clamps prices outside the board", () => {
    expect(
      priceBoardPercents({
        commerzbank: 0,
        bayer: 300,
        bmw: 100,
        bp: 100,
      }),
    ).toEqual({
      commerzbank: 0,
      bayer: 100,
      bmw: 37.5,
      bp: 37.5,
    });
  });

  it("lists tick marks every 10 from 10 through 250", () => {
    const ticks = priceBoardTicks();
    expect(ticks[0]).toBe(10);
    expect(ticks[ticks.length - 1]).toBe(250);
    expect(ticks).toHaveLength(25);
    expect(ticks.every((tick, i) => tick === 10 + i * 10)).toBe(true);
  });
});
