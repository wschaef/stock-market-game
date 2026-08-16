import { describe, expect, it } from "vitest";
import type { Card } from "../engine/types";
import { cardEffectRows } from "./cardEffectRows";

describe("cardEffectRows", () => {
  it("maps named + choice multiplier into two rows", () => {
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
    expect(cardEffectRows(card)).toEqual([
      { kind: "scale", factor: 2, company: "bmw" },
      { kind: "scale", factor: 0.5, company: null },
    ]);
  });

  it("maps standard delta + choice into two rows", () => {
    const card: Card = {
      id: "std",
      kind: "action",
      title: "+40 Bayer / -50 [?]",
      text: "",
      ops: [
        { type: "delta", company: "bayer", amount: 40 },
        { type: "deltaChoice", amount: -50 },
      ],
    };
    expect(cardEffectRows(card)).toEqual([
      { kind: "delta", amount: 40, company: "bayer" },
      { kind: "delta", amount: -50, company: null },
    ]);
  });

  it("puts the positive effect before a leading negative op", () => {
    const card: Card = {
      id: "std-neg-first",
      kind: "action",
      title: "-30 BP / +60 [?]",
      text: "",
      ops: [
        { type: "delta", company: "bp", amount: -30 },
        { type: "deltaChoice", amount: 60 },
      ],
    };
    expect(cardEffectRows(card)).toEqual([
      { kind: "delta", amount: 60, company: null },
      { kind: "delta", amount: -30, company: "bp" },
    ]);
  });

  it("maps +100 style into +100 plus three [? ] penalty rows", () => {
    const card: Card = {
      id: "p100",
      kind: "action",
      title: "+100",
      text: "",
      ops: [
        { type: "delta", company: "bmw", amount: 100 },
        { type: "deltaChoice", amount: -10 },
        { type: "deltaChoice", amount: -20 },
        { type: "deltaChoice", amount: -30 },
      ],
    };
    expect(cardEffectRows(card)).toEqual([
      { kind: "delta", amount: 100, company: "bmw" },
      { kind: "delta", amount: -10, company: null },
      { kind: "delta", amount: -20, company: null },
      { kind: "delta", amount: -30, company: null },
    ]);
  });

  it("maps risk deltas into one row per company for strip rendering", () => {
    const card: Card = {
      id: "risk",
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
    const rows = cardEffectRows(card);
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.kind === "delta")).toBe(true);
  });
});
