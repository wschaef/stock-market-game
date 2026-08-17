import { describe, expect, it } from "vitest";
import type { GameEvent } from "../engine/types";
import {
  PRICE_BOARD_MAX,
  PRICE_BOARD_MIN,
  PRICE_BOARD_STEP,
  lastPriceSpan,
  priceBoardFilledCount,
  priceBoardTicks,
  pricePieceHighlight,
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

describe("pricePieceHighlight", () => {
  it("marks newly filled tiles when the price rises", () => {
    // $100 → 10 tiles; $140 → 14 tiles; indices 10–13 are new.
    expect(pricePieceHighlight(9, 100, 140)).toBeNull();
    expect(pricePieceHighlight(10, 100, 140)).toBe("gained");
    expect(pricePieceHighlight(13, 100, 140)).toBe("gained");
    expect(pricePieceHighlight(14, 100, 140)).toBeNull();
  });

  it("marks just-emptied tiles when the price falls", () => {
    // $100 → 10 tiles; $70 → 7 tiles; indices 7–9 were lost.
    expect(pricePieceHighlight(6, 100, 70)).toBeNull();
    expect(pricePieceHighlight(7, 100, 70)).toBe("lost");
    expect(pricePieceHighlight(9, 100, 70)).toBe("lost");
    expect(pricePieceHighlight(10, 100, 70)).toBeNull();
  });

  it("marks nothing when the board fill does not change", () => {
    expect(pricePieceHighlight(9, 100, 100)).toBeNull();
    expect(pricePieceHighlight(10, 100, 100)).toBeNull();
  });
});

describe("lastPriceSpan", () => {
  it("reads from/to on a priceChange", () => {
    const events: GameEvent[] = [
      { type: "priceChange", company: "bmw", from: 100, to: 140 },
    ];
    expect(lastPriceSpan(events, "bmw")).toEqual({ from: 100, to: 140 });
    expect(lastPriceSpan(events, "bayer")).toBeNull();
  });

  it("uses split from → newPrice", () => {
    const events: GameEvent[] = [
      {
        type: "split",
        company: "bp",
        from: 200,
        target: 300,
        newPrice: 150,
        doubledShares: true,
      },
    ];
    expect(lastPriceSpan(events, "bp")).toEqual({ from: 200, to: 150 });
  });

  it("uses wipeout from → 100", () => {
    const events: GameEvent[] = [
      { type: "wipeout", company: "bayer", from: 5, target: 5 },
    ];
    expect(lastPriceSpan(events, "bayer")).toEqual({ from: 5, to: 100 });
  });

  it("chains the first from and last to when a company has several events", () => {
    const events: GameEvent[] = [
      { type: "priceChange", company: "bmw", from: 100, to: 200 },
      {
        type: "split",
        company: "bmw",
        from: 200,
        target: 400,
        newPrice: 200,
        doubledShares: true,
      },
    ];
    expect(lastPriceSpan(events, "bmw")).toEqual({ from: 100, to: 200 });
  });
});
