import { describe, expect, it } from "vitest";
import type { Card, GameState, Player } from "../engine/types";
import { COMPANIES } from "../engine/types";
import { previewCardWealth } from "./previewCardWealth";

function emptyShares() {
  return { commerzbank: 0, bayer: 0, bmw: 0, bp: 0 };
}

function testState(overrides: Partial<GameState> = {}): GameState {
  const player = (name: string, extra: Partial<Player> = {}): Player => ({
    id: name,
    name,
    cash: 1000,
    shares: emptyShares(),
    hand: [],
    controller: "human",
    strategy: null,
    ...extra,
  });
  return {
    players: [player("Ada"), player("Bob")],
    currentPlayerIndex: 0,
    prices: { commerzbank: 100, bayer: 100, bmw: 100, bp: 100 },
    drawPile: [],
    discardPile: [],
    unusedCards: [],
    phase: "chooseHandCard",
    pendingCard: null,
    lastEvents: [],
    lastDrawn: null,
    lastError: null,
    roundsTotal: 10,
    roundsCompleted: 0,
    log: [],
    random: () => 0,
    ...overrides,
  };
}

const namedRise: Card = {
  id: "named-rise",
  kind: "action",
  title: "+100 BMW | others -20",
  text: "",
  ops: [
    { type: "delta", company: "bmw", amount: 100 },
    { type: "delta", company: "commerzbank", amount: -20 },
    { type: "delta", company: "bayer", amount: -20 },
    { type: "delta", company: "bp", amount: -20 },
  ],
};

const choiceFall: Card = {
  id: "choice-fall",
  kind: "action",
  title: "+30 Commerzbank / -60 [?]",
  text: "",
  ops: [
    { type: "delta", company: "commerzbank", amount: 30 },
    { type: "deltaChoice", amount: -60 },
  ],
};

const doubleBmw: Card = {
  id: "mul-bmw",
  kind: "action",
  title: "2× BMW / ½ [?]",
  text: "",
  ops: [
    { type: "scale", company: "bmw", factor: 2 },
    { type: "scaleChoice", factor: 0.5 },
  ],
};

describe("previewCardWealth", () => {
  it("shows wealth rise for holders when a named company price rises", () => {
    const state = testState();
    state.players[0].shares.bmw = 2;
    state.players[1].shares.commerzbank = 5;

    const preview = previewCardWealth(state, namedRise);

    // Ada: BMW 100→200 (+200), others she doesn't hold
    expect(preview.players[0]).toMatchObject({
      playerId: "Ada",
      before: 1000 + 200,
      deltaMin: 200,
      deltaMax: 200,
    });
    expect(preview.players[0].afterMin).toBe(preview.players[0].afterMax);
    // Bob: CB 100→80 (−100)
    expect(preview.players[1].deltaMin).toBe(-100);
    expect(preview.players[1].deltaMax).toBe(-100);
    expect(preview.dependsOnChoice).toBe(false);
  });

  it("does not mutate the live game state", () => {
    const state = testState();
    state.players[0].shares.bmw = 3;
    const before = structuredClone({
      ...state,
      random: undefined,
    });
    previewCardWealth(state, namedRise);
    const after = structuredClone({
      ...state,
      random: undefined,
    });
    expect(after).toEqual(before);
  });

  it("returns min–max deltas across allowed [? ] choices", () => {
    const state = testState();
    // Ada holds Bayer only among choice targets
    state.players[0].shares.bayer = 1;
    state.players[0].shares.commerzbank = 0;

    const preview = previewCardWealth(state, choiceFall);
    expect(preview.dependsOnChoice).toBe(true);
    // Named +30 CB does nothing for Ada; choice −60 on Bayer → −60; on BMW/BP → 0
    expect(preview.players[0].deltaMin).toBe(-60);
    expect(preview.players[0].deltaMax).toBe(0);
  });

  it("accounts for split doubling shares in preview wealth", () => {
    const state = testState({
      prices: { commerzbank: 100, bayer: 100, bmw: 200, bp: 100 },
    });
    state.players[0].shares.bmw = 2;
    // 2× BMW → 400 → split to 200, shares 4; wealth from BMW: before 400, after 800
    const noChoiceDouble: Card = {
      id: "double-only",
      kind: "action",
      title: "2× BMW",
      text: "",
      ops: [{ type: "scale", company: "bmw", factor: 2 }],
    };
    const preview = previewCardWealth(state, noChoiceDouble);
    expect(preview.players[0].deltaMin).toBe(400);
    expect(preview.players[0].deltaMax).toBe(400);
  });

  it("accounts for wipeout clearing shares", () => {
    const state = testState({
      prices: { commerzbank: 100, bayer: 100, bmw: 20, bp: 100 },
    });
    state.players[0].shares.bmw = 4;
    // 20 + (−15) = 5 → wipeout
    const wipe: Card = {
      id: "wipe",
      kind: "action",
      title: "wipe bmw",
      text: "",
      ops: [{ type: "delta", company: "bmw", amount: -15 }],
    };
    const preview = previewCardWealth(state, wipe);
    // before: 1000 + 80; after wipe shares 0 price 100: 1000
    expect(preview.players[0].deltaMin).toBe(-80);
    expect(preview.players[0].deltaMax).toBe(-80);
  });

  it("includes scale choice range for multiplier cards", () => {
    const state = testState({
      prices: { commerzbank: 100, bayer: 120, bmw: 100, bp: 80 },
    });
    state.players[0].shares.bmw = 1;
    state.players[0].shares.bayer = 2;
    const preview = previewCardWealth(state, doubleBmw);
    expect(preview.dependsOnChoice).toBe(true);
    expect(preview.players[0].deltaMin).toBeLessThanOrEqual(
      preview.players[0].deltaMax,
    );
    expect(preview.players[0].deltaMin).not.toBe(preview.players[0].deltaMax);
  });

  it("spans permutations for +100 multi-penalty cards", () => {
    const p100: Card = {
      id: "p100-multi",
      kind: "action",
      title: "+100 CB",
      text: "",
      ops: [
        { type: "delta", company: "commerzbank", amount: 100 },
        { type: "deltaChoice", amount: -10 },
        { type: "deltaChoice", amount: -20 },
        { type: "deltaChoice", amount: -30 },
      ],
    };
    const state = testState();
    state.players[0].shares.bayer = 1;
    const preview = previewCardWealth(state, p100);
    expect(preview.dependsOnChoice).toBe(true);
    // Bayer can receive −10, −20, or −30 → wealth −10/−20/−30; named +100 unused
    expect(preview.players[0].deltaMin).toBe(-30);
    expect(preview.players[0].deltaMax).toBe(-10);
  });
});

describe("companies constant still four", () => {
  it("lists four companies", () => {
    expect(COMPANIES).toHaveLength(4);
  });
});
