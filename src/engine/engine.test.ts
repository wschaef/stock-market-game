import { describe, expect, it } from "vitest";
import { ACTION_CARDS, ALL_CARDS, RISK_CARDS } from "./catalog";
import { applyCompanyTarget, netWorth, ranking } from "./price";
import { identityShuffle, setupGame } from "./setup";
import { allowedChoices, reduce } from "./turn";
import {
  COMPANIES,
  type Card,
  type GameState,
  type Player,
} from "./types";

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
    phase: "chooseTurn",
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

const riskNoChoice: Card = {
  id: "risk-test",
  kind: "risk",
  title: "Risk test",
  text: "All +10",
  ops: COMPANIES.map((company) => ({
    type: "delta" as const,
    company,
    amount: 10,
  })),
};

const actionNoChoice: Card = {
  id: "p100-test",
  kind: "action",
  title: "+100 test",
  text: "",
  ops: [
    { type: "delta", company: "commerzbank", amount: 100 },
    { type: "delta", company: "bayer", amount: -20 },
    { type: "delta", company: "bmw", amount: -20 },
    { type: "delta", company: "bp", amount: -20 },
  ],
};

const actionWithChoice: Card = {
  id: "std-test",
  kind: "action",
  title: "+30 Commerzbank / -60 [?]",
  text: "",
  ops: [
    { type: "delta", company: "commerzbank", amount: 30 },
    { type: "deltaChoice", amount: -60 },
  ],
};

describe("catalog", () => {
  it("has 63 cards: 48 action and 15 risk", () => {
    expect(ACTION_CARDS).toHaveLength(48);
    expect(RISK_CARDS).toHaveLength(15);
    expect(ALL_CARDS).toHaveLength(63);
  });

  it("has two +100 copies per company with −10/−20/−30 choices", () => {
    const p100 = ACTION_CARDS.filter((card) => card.id.startsWith("p100-"));
    expect(p100).toHaveLength(8);
    for (const company of COMPANIES) {
      const copies = p100.filter((card) => card.id.startsWith(`p100-${company}-`));
      expect(copies).toHaveLength(2);
      for (const card of copies) {
        expect(card.ops[0]).toEqual({
          type: "delta",
          company,
          amount: 100,
        });
        expect(card.ops.slice(1)).toEqual([
          { type: "deltaChoice", amount: -10 },
          { type: "deltaChoice", amount: -20 },
          { type: "deltaChoice", amount: -30 },
        ]);
      }
    }
  });
});

describe("setup", () => {
  it("deals 4 action cards each and builds 9 action + 3 risk per player", () => {
    const state = setupGame(["Ada", "Bob"], identityShuffle);
    expect(state.players).toHaveLength(2);
    expect(state.players.every((p) => p.cash === 1000)).toBe(true);
    expect(state.players.every((p) => p.hand.length === 4)).toBe(true);
    expect(state.players.every((p) => p.hand.every((c) => c.kind === "action"))).toBe(
      true,
    );
    expect(state.drawPile).toHaveLength(24);
    const pileActions = state.drawPile.filter((c) => c.kind === "action");
    const pileRisks = state.drawPile.filter((c) => c.kind === "risk");
    expect(pileActions).toHaveLength(18);
    expect(pileRisks).toHaveLength(6);
    expect(state.unusedCards).toHaveLength(63 - 8 - 24);
    expect(state.phase).toBe("chooseTurn");
  });

  it("for 4 players puts all leftover actions in the pile (32) with 12 risks", () => {
    const state = setupGame(["Ada", "Bob", "Cara", "Dan"], identityShuffle);
    expect(state.players.every((p) => p.hand.length === 4)).toBe(true);
    const pileActions = state.drawPile.filter((c) => c.kind === "action");
    const pileRisks = state.drawPile.filter((c) => c.kind === "risk");
    expect(pileActions).toHaveLength(32);
    expect(pileRisks).toHaveLength(12);
    expect(state.drawPile).toHaveLength(44);
    expect(state.unusedCards.filter((c) => c.kind === "action")).toHaveLength(0);
    expect(state.unusedCards.filter((c) => c.kind === "risk")).toHaveLength(3);
  });
});

describe("split and wipeout", () => {
  it("splits when target is above 250: price = floor(target/2), shareholder shares double", () => {
    const state = testState({
      prices: { commerzbank: 200, bayer: 100, bmw: 100, bp: 100 },
    });
    state.players[0].shares.commerzbank = 5;
    state.players[1].shares.commerzbank = 3;
    const events = applyCompanyTarget(state, "commerzbank", 300);
    expect(state.prices.commerzbank).toBe(150);
    expect(state.players[0].shares.commerzbank).toBe(10);
    expect(state.players[1].shares.commerzbank).toBe(6);
    expect(events[0]).toMatchObject({ type: "split", newPrice: 150, target: 300 });
  });

  it("does not split at exactly 250", () => {
    const state = testState();
    state.players[0].shares.bayer = 4;
    applyCompanyTarget(state, "bayer", 250);
    expect(state.prices.bayer).toBe(250);
    expect(state.players[0].shares.bayer).toBe(4);
  });

  it("wipes out when target is below 10: holdings gone, price 100", () => {
    const state = testState();
    state.players[0].shares.bayer = 8;
    state.players[1].shares.bayer = 20;
    const events = applyCompanyTarget(state, "bayer", 5);
    expect(state.prices.bayer).toBe(100);
    expect(state.players[0].shares.bayer).toBe(0);
    expect(state.players[1].shares.bayer).toBe(0);
    expect(events[0]).toMatchObject({ type: "wipeout", target: 5 });
  });

  it("does not wipe out at exactly 10", () => {
    const state = testState();
    state.players[0].shares.bp = 2;
    applyCompanyTarget(state, "bp", 10);
    expect(state.prices.bp).toBe(10);
    expect(state.players[0].shares.bp).toBe(2);
  });
});

describe("draw and play", () => {
  it("adds an Action to hand and requires a play; trade is rejected", () => {
    const state = testState({
      drawPile: [actionNoChoice],
      players: [
        {
          id: "p1",
          name: "Ada",
          cash: 1000,
          shares: emptyShares(),
          hand: [actionWithChoice],
          controller: "human",
          strategy: null,
        },
        {
          id: "p2",
          name: "Bob",
          cash: 1000,
          shares: emptyShares(),
          hand: [],
          controller: "human",
          strategy: null,
        },
      ],
    });
    const drawn = reduce(state, { type: "draw" });
    expect(drawn.ok).toBe(true);
    expect(drawn.state.phase).toBe("chooseHandCard");
    expect(drawn.state.players[0].hand).toHaveLength(2);

    const traded = reduce(drawn.state, {
      type: "buy",
      company: "bmw",
      quantity: 1,
    });
    expect(traded.ok).toBe(false);
    expect(traded.error).toMatch(/cannot trade after playing an Action/i);
  });

  it("plays a Risk immediately and then allows trade", () => {
    const state = testState({ drawPile: [riskNoChoice] });
    const drawn = reduce(state, { type: "draw" });
    expect(drawn.ok).toBe(true);
    expect(drawn.state.phase).toBe("optionalTrade");
    expect(drawn.state.prices.commerzbank).toBe(110);
    const bought = reduce(drawn.state, {
      type: "buy",
      company: "commerzbank",
      quantity: 2,
    });
    expect(bought.ok).toBe(true);
    expect(bought.state.players[0].shares.commerzbank).toBe(2);
    expect(bought.state.players[0].cash).toBe(1000 - 220);
  });

  it("lets the player pick [?] as one of the other three companies", () => {
    const state = testState({
      phase: "chooseHandCard",
      drawPile: [riskNoChoice],
      players: [
        {
          id: "p1",
          name: "Ada",
          cash: 1000,
          shares: emptyShares(),
          hand: [actionWithChoice],
          controller: "human",
          strategy: null,
        },
        {
          id: "p2",
          name: "Bob",
          cash: 1000,
          shares: emptyShares(),
          hand: [],
          controller: "human",
          strategy: null,
        },
      ],
    });
    expect(allowedChoices(actionWithChoice)).toEqual(["bayer", "bmw", "bp"]);
    const played = reduce(state, { type: "playCard", cardId: "std-test" });
    expect(played.state.phase).toBe("chooseCompany");
    const same = reduce(played.state, {
      type: "chooseCompany",
      company: "commerzbank",
    });
    expect(same.ok).toBe(false);
    const picked = reduce(played.state, {
      type: "chooseCompany",
      company: "bmw",
    });
    expect(picked.ok).toBe(true);
    expect(picked.state.prices.commerzbank).toBe(130);
    expect(picked.state.prices.bmw).toBe(40);
    expect(picked.state.phase).toBe("chooseTurn");
    expect(picked.state.currentPlayerIndex).toBe(1);
  });

  it("assigns −10/−20/−30 on a +100 card across three distinct other companies", () => {
    const p100: Card = {
      id: "p100-play",
      kind: "action",
      title: "+100",
      text: "",
      ops: [
        { type: "delta", company: "commerzbank", amount: 100 },
        { type: "deltaChoice", amount: -10 },
        { type: "deltaChoice", amount: -20 },
        { type: "deltaChoice", amount: -30 },
      ],
    };
    const state = testState({
      phase: "chooseHandCard",
      drawPile: [riskNoChoice],
      players: [
        {
          id: "p1",
          name: "Ada",
          cash: 1000,
          shares: emptyShares(),
          hand: [p100],
          controller: "human",
          strategy: null,
        },
        {
          id: "p2",
          name: "Bob",
          cash: 1000,
          shares: emptyShares(),
          hand: [],
          controller: "human",
          strategy: null,
        },
      ],
    });
    const played = reduce(state, { type: "playCard", cardId: "p100-play" });
    expect(played.state.phase).toBe("chooseCompany");
    const first = reduce(played.state, { type: "chooseCompany", company: "bayer" });
    expect(first.ok).toBe(true);
    expect(first.state.phase).toBe("chooseCompany");
    expect(first.state.prices.commerzbank).toBe(100);
    const dup = reduce(first.state, { type: "chooseCompany", company: "bayer" });
    expect(dup.ok).toBe(false);
    const second = reduce(first.state, { type: "chooseCompany", company: "bmw" });
    expect(second.state.phase).toBe("chooseCompany");
    const third = reduce(second.state, { type: "chooseCompany", company: "bp" });
    expect(third.ok).toBe(true);
    expect(third.state.prices.commerzbank).toBe(200);
    expect(third.state.prices.bayer).toBe(90);
    expect(third.state.prices.bmw).toBe(80);
    expect(third.state.prices.bp).toBe(70);
    expect(third.state.phase).toBe("chooseTurn");
    expect(third.state.currentPlayerIndex).toBe(1);
  });

  it("rejects trade after a completed Action play", () => {
    const state = testState({
      phase: "chooseHandCard",
      drawPile: [riskNoChoice],
      players: [
        {
          id: "p1",
          name: "Ada",
          cash: 1000,
          shares: emptyShares(),
          hand: [actionNoChoice],
          controller: "human",
          strategy: null,
        },
        {
          id: "p2",
          name: "Bob",
          cash: 1000,
          shares: emptyShares(),
          hand: [],
          controller: "human",
          strategy: null,
        },
      ],
    });
    const played = reduce(state, { type: "playCard", cardId: "p100-test" });
    expect(played.ok).toBe(true);
    expect(played.state.phase).toBe("chooseTurn");
    expect(played.state.currentPlayerIndex).toBe(1);
    const traded = reduce(played.state, {
      type: "buy",
      company: "commerzbank",
      quantity: 1,
    });
    expect(traded.ok).toBe(false);
  });
});

describe("trade validation", () => {
  it("rejects overspend and oversell, but allows unlimited share supply", () => {
    const state = testState({ phase: "optionalTrade" });
    state.players[0].cash = 50;
    state.prices.bmw = 100;
    expect(
      reduce(state, { type: "buy", company: "bmw", quantity: 1 }).ok,
    ).toBe(false);

    const rich = testState({ phase: "optionalTrade" });
    rich.players[0].cash = 50_000;
    const bulk = reduce(rich, { type: "buy", company: "bmw", quantity: 100 });
    expect(bulk.ok).toBe(true);
    expect(bulk.state.players[0].shares.bmw).toBe(100);

    const holder = testState({ phase: "optionalTrade" });
    expect(
      reduce(holder, { type: "sell", company: "bmw", quantity: 1 }).error,
    ).toMatch(/do not hold/i);
  });
});

describe("scoring and end", () => {
  it("scores cash plus shares times prices", () => {
    const state = testState({
      prices: { commerzbank: 120, bayer: 80, bmw: 10, bp: 100 },
    });
    state.players[0].cash = 400;
    state.players[0].shares.commerzbank = 2;
    state.players[0].shares.bayer = 1;
    expect(netWorth(state, 0)).toBe(400 + 240 + 80);
  });

  it("ends after the configured number of full table rounds", () => {
    const state = testState({
      roundsTotal: 1,
      phase: "optionalTrade",
      players: [
        {
          id: "p1",
          name: "Ada",
          cash: 1000,
          shares: emptyShares(),
          hand: [],
          controller: "human",
          strategy: null,
        },
        {
          id: "p2",
          name: "Bob",
          cash: 500,
          shares: emptyShares(),
          hand: [],
          controller: "human",
          strategy: null,
        },
      ],
    });
    const afterAda = reduce(state, { type: "endTrade" });
    expect(afterAda.state.phase).toBe("chooseTurn");
    expect(afterAda.state.currentPlayerIndex).toBe(1);
    expect(afterAda.state.roundsCompleted).toBe(0);

    const bobTrade = reduce(afterAda.state, { type: "startTrade" });
    expect(bobTrade.ok).toBe(true);
    const afterBob = reduce(bobTrade.state, { type: "endTrade" });
    expect(afterBob.state.roundsCompleted).toBe(1);
    expect(afterBob.state.phase).toBe("gameOver");
    const board = ranking(afterBob.state);
    expect(board[0].name).toBe("Ada");
    expect(board[0].netWorth).toBeGreaterThan(board[1].netWorth);
  });

  it("rejects draw when the pile is empty", () => {
    const state = testState({ drawPile: [] });
    const drawn = reduce(state, { type: "draw" });
    expect(drawn.ok).toBe(false);
    expect(drawn.error).toMatch(/empty/i);
  });
});

describe("card recycle", () => {
  it("re-inserts a played Action at a random draw-pile index", () => {
    const other: Card = {
      id: "other",
      kind: "action",
      title: "other",
      text: "",
      ops: [{ type: "delta", company: "bmw", amount: 10 }],
    };
    // random → 0.99 ⇒ insert index = floor(0.99 * 2) = 1 among 1 remaining + slot
    const state = testState({
      phase: "chooseHandCard",
      drawPile: [other],
      random: () => 0.99,
      players: [
        {
          id: "p1",
          name: "Ada",
          cash: 1000,
          shares: emptyShares(),
          hand: [actionNoChoice],
          controller: "human",
          strategy: null,
        },
        {
          id: "p2",
          name: "Bob",
          cash: 1000,
          shares: emptyShares(),
          hand: [],
          controller: "human",
          strategy: null,
        },
      ],
    });
    const played = reduce(state, { type: "playCard", cardId: "p100-test" });
    expect(played.ok).toBe(true);
    expect(played.state.discardPile).toHaveLength(0);
    expect(played.state.drawPile).toHaveLength(2);
    expect(played.state.drawPile.map((c) => c.id)).toEqual([
      "other",
      "p100-test",
    ]);
  });

  it("re-inserts a resolved Risk into the draw pile", () => {
    const state = testState({
      drawPile: [riskNoChoice],
      random: () => 0,
    });
    const drawn = reduce(state, { type: "draw" });
    expect(drawn.ok).toBe(true);
    expect(drawn.state.phase).toBe("optionalTrade");
    expect(drawn.state.drawPile.map((c) => c.id)).toEqual(["risk-test"]);
  });
});
