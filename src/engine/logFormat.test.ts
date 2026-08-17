import { describe, expect, it } from "vitest";
import type { Card, GameEvent } from "./types";
import {
  formatCardOps,
  formatRiskHeadline,
  formatTradeLine,
} from "./logFormat";

describe("formatCardOps", () => {
  it("keeps [?] until the choice op is bound", () => {
    const card: Card = {
      id: "std",
      kind: "action",
      title: "+30 Commerzbank / -60 [?]",
      text: "",
      ops: [
        { type: "delta", company: "commerzbank", amount: 30 },
        { type: "deltaChoice", amount: -60 },
      ],
    };
    expect(formatCardOps(card)).toBe("+30 Commerzbank / -60 [?]");
  });

  it("replaces [?] with the selected company once bound", () => {
    const card: Card = {
      id: "std-bound",
      kind: "action",
      title: "+30 Commerzbank / -60 [?]",
      text: "",
      ops: [
        { type: "delta", company: "commerzbank", amount: 30 },
        { type: "delta", company: "bmw", amount: -60 },
      ],
    };
    expect(formatCardOps(card)).toBe("+30 Commerzbank / -60 BMW AG");
    expect(formatCardOps(card)).not.toContain("?");
  });

  it("names each +100 penalty company after they are assigned", () => {
    const card: Card = {
      id: "p100-bound",
      kind: "action",
      title: "+100 Commerzbank | −10/−20/−30 [?]",
      text: "",
      ops: [
        { type: "delta", company: "commerzbank", amount: 100 },
        { type: "delta", company: "bayer", amount: -10 },
        { type: "delta", company: "bmw", amount: -20 },
        { type: "delta", company: "bp", amount: -30 },
      ],
    };
    expect(formatCardOps(card)).toBe(
      "+100 Commerzbank / -10 Bayer / -20 BMW AG / -30 BP",
    );
  });

  it("formats multiplier ops with 2× and ½", () => {
    const card: Card = {
      id: "mul",
      kind: "action",
      title: "2× BMW / ½ [?]",
      text: "",
      ops: [
        { type: "scale", company: "bmw", factor: 2 },
        { type: "scaleChoice", factor: 0.5 },
      ],
    };
    expect(formatCardOps(card)).toBe("2× BMW AG / ½ [?]");
  });
});

describe("formatTradeLine", () => {
  it("includes price and cash total on a buy", () => {
    expect(
      formatTradeLine({
        actor: "Ada",
        company: "bmw",
        bought: 2,
        sold: 0,
        price: 110,
      }),
    ).toBe("Ada buys 2 BMW AG at $110 ($220)");
  });

  it("includes price and cash total on a sell", () => {
    expect(
      formatTradeLine({
        actor: "Ada",
        company: "bayer",
        bought: 0,
        sold: 3,
        price: 80,
      }),
    ).toBe("Ada sells 3 Bayer at $80 ($240)");
  });

  it("combines buy and sell of the same share on one line", () => {
    expect(
      formatTradeLine({
        actor: "Ada",
        company: "bmw",
        bought: 2,
        sold: 1,
        price: 100,
      }),
    ).toBe("Ada buys 2 / sells 1 BMW AG at $100 (buy $200, sell $100)");
  });
});

describe("formatRiskHeadline", () => {
  it("lists each company delta and resulting price", () => {
    const card: Card = {
      id: "risk-1",
      kind: "risk",
      title: "Risk 1",
      text: "",
      ops: [
        { type: "delta", company: "commerzbank", amount: 40 },
        { type: "delta", company: "bayer", amount: 20 },
        { type: "delta", company: "bmw", amount: -20 },
        { type: "delta", company: "bp", amount: -20 },
      ],
    };
    const events: GameEvent[] = [
      { type: "priceChange", company: "commerzbank", from: 100, to: 140 },
      { type: "priceChange", company: "bayer", from: 100, to: 120 },
      { type: "priceChange", company: "bmw", from: 100, to: 80 },
      { type: "priceChange", company: "bp", from: 100, to: 80 },
    ];
    expect(formatRiskHeadline(card, events)).toBe(
      "Risk 1: Commerzbank +40 ($140), Bayer +20 ($120), BMW AG -20 ($80), BP -20 ($80)",
    );
  });

  it("calls out split and wipeout instead of a plain price", () => {
    const card: Card = {
      id: "risk-x",
      kind: "risk",
      title: "Risk 14",
      text: "",
      ops: [
        { type: "delta", company: "bmw", amount: 90 },
        { type: "delta", company: "bayer", amount: -95 },
      ],
    };
    const events: GameEvent[] = [
      {
        type: "split",
        company: "bmw",
        from: 200,
        target: 290,
        newPrice: 145,
        doubledShares: true,
      },
      { type: "wipeout", company: "bayer", from: 100, target: 5 },
    ];
    expect(formatRiskHeadline(card, events)).toBe(
      "Risk 14: BMW AG +90 split $200 → $145 (shares doubled), Bayer -95 wipeout → $100 (shares lost)",
    );
  });
});
