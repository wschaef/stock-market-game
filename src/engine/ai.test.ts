import { describe, expect, it } from "vitest";
import {
  chanceScore,
  chooseIntent,
  handUpside,
  riskScore,
  strategyScore,
} from "./ai";
import { reduce } from "./turn";
import {
  type AiStrategy,
  type Card,
  type GameState,
  type Player,
} from "./types";

function emptyShares() {
  return { commerzbank: 0, bayer: 0, bmw: 0, bp: 0 };
}

function aiPlayer(
  name: string,
  strategy: AiStrategy,
  extra: Partial<Player> = {},
): Player {
  return {
    id: name,
    name,
    cash: 1000,
    shares: emptyShares(),
    hand: [],
    controller: "ai",
    strategy,
    ...extra,
  };
}

function humanPlayer(name: string, extra: Partial<Player> = {}): Player {
  return {
    id: name,
    name,
    cash: 1000,
    shares: emptyShares(),
    hand: [],
    controller: "human",
    strategy: null,
    ...extra,
  };
}

function testState(overrides: Partial<GameState> = {}): GameState {
  return {
    players: [aiPlayer("Bot", "middle"), humanPlayer("Ada")],
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
    log: [],
    random: () => 0,
    ...overrides,
  };
}

const riseBmw: Card = {
  id: "rise-bmw",
  kind: "action",
  title: "+100 BMW",
  text: "",
  ops: [
    { type: "delta", company: "bmw", amount: 100 },
    { type: "delta", company: "commerzbank", amount: -20 },
    { type: "delta", company: "bayer", amount: -20 },
    { type: "delta", company: "bp", amount: -20 },
  ],
};

const riseBayer: Card = {
  id: "rise-bayer",
  kind: "action",
  title: "+100 Bayer",
  text: "",
  ops: [
    { type: "delta", company: "bayer", amount: 100 },
    { type: "delta", company: "commerzbank", amount: -20 },
    { type: "delta", company: "bmw", amount: -20 },
    { type: "delta", company: "bp", amount: -20 },
  ],
};

const boostBmw: Card = {
  id: "boost-bmw",
  kind: "action",
  title: "+40 BMW",
  text: "",
  ops: [
    { type: "delta", company: "bmw", amount: 40 },
    { type: "delta", company: "commerzbank", amount: 0 },
    { type: "delta", company: "bayer", amount: 0 },
    { type: "delta", company: "bp", amount: 0 },
  ],
};

const crashBayer: Card = {
  id: "crash-bayer",
  kind: "action",
  title: "-80 Bayer / +10 BMW",
  text: "",
  ops: [
    { type: "delta", company: "bayer", amount: -80 },
    { type: "delta", company: "bmw", amount: 10 },
    { type: "delta", company: "commerzbank", amount: 0 },
    { type: "delta", company: "bp", amount: 0 },
  ],
};

const pumpBmw60: Card = {
  id: "pump-bmw-60",
  kind: "action",
  title: "+60 BMW",
  text: "",
  ops: [
    { type: "delta", company: "bmw", amount: 60 },
    { type: "delta", company: "commerzbank", amount: 0 },
    { type: "delta", company: "bayer", amount: 0 },
    { type: "delta", company: "bp", amount: 0 },
  ],
};

describe("trader brain features", () => {
  it("hand upside reads the best positive Δprice from the hand", () => {
    const state = testState({
      players: [
        aiPlayer("Bot", "middle", { hand: [pumpBmw60, riseBayer] }),
        humanPlayer("Ada"),
      ],
    });
    expect(handUpside(state, 0, "bmw")).toBe(60);
    expect(handUpside(state, 0, "bayer")).toBe(100);
  });

  it("lower price raises the cash leverage term in chance", () => {
    const hand = [pumpBmw60];
    const high = testState({
      prices: { commerzbank: 100, bayer: 100, bmw: 100, bp: 100 },
      players: [
        aiPlayer("Bot", "middle", { cash: 1000, hand, shares: emptyShares() }),
        humanPlayer("Ada"),
      ],
    });
    const low = testState({
      prices: { commerzbank: 100, bayer: 100, bmw: 20, bp: 100 },
      players: [
        aiPlayer("Bot", "middle", { cash: 1000, hand, shares: emptyShares() }),
        humanPlayer("Ada"),
      ],
    });
    expect(chanceScore(low, 0)).toBeGreaterThan(chanceScore(high, 0));
  });

  it("orphan low-price book is riskier than the same book with hand support", () => {
    const shares = { ...emptyShares(), bmw: 20 };
    const prices = { commerzbank: 100, bayer: 100, bmw: 20, bp: 100 };
    const orphan = testState({
      prices,
      players: [
        aiPlayer("Bot", "defensive", { cash: 600, shares, hand: [] }),
        humanPlayer("Ada"),
      ],
    });
    const supported = testState({
      prices,
      players: [
        aiPlayer("Bot", "defensive", {
          cash: 600,
          shares,
          hand: [pumpBmw60],
        }),
        humanPlayer("Ada"),
      ],
    });
    expect(riskScore(orphan, 0)).toBeGreaterThan(riskScore(supported, 0));
  });
});

describe("AI strategies", () => {
  it("Defensive picks the card that raises own net worth more", () => {
    const state = testState({
      phase: "chooseHandCard",
      players: [
        aiPlayer("Bot", "defensive", {
          hand: [riseBmw, riseBayer],
          shares: { ...emptyShares(), bmw: 10 },
        }),
        humanPlayer("Ada", { shares: { ...emptyShares(), bayer: 10 } }),
      ],
    });
    expect(chooseIntent(state)).toEqual({ type: "playCard", cardId: "rise-bmw" });
  });

  it("Aggressive prefers hurting the rival lead over a smaller selfish gain", () => {
    const state = testState({
      phase: "chooseHandCard",
      players: [
        aiPlayer("Bot", "aggressive", {
          cash: 1000,
          hand: [boostBmw, crashBayer],
          shares: { ...emptyShares(), bmw: 1 },
        }),
        humanPlayer("Ada", {
          cash: 1000,
          shares: { ...emptyShares(), bayer: 50 },
        }),
      ],
    });
    expect(chooseIntent(state)).toEqual({
      type: "playCard",
      cardId: "crash-bayer",
    });
  });

  it("Middle can prefer rival damage when lead weight still matters", () => {
    const basePlayers = [
      aiPlayer("Bot", "middle", {
        cash: 1000,
        hand: [boostBmw, crashBayer],
        shares: { ...emptyShares(), bmw: 1 },
      }),
      humanPlayer("Ada", {
        cash: 1000,
        shares: { ...emptyShares(), bayer: 50 },
      }),
    ] as Player[];

    const middle = chooseIntent(
      testState({ phase: "chooseHandCard", players: basePlayers }),
    );
    const defensive = chooseIntent(
      testState({
        phase: "chooseHandCard",
        players: [
          { ...basePlayers[0], strategy: "defensive" },
          basePlayers[1],
        ],
      }),
    );
    const aggressive = chooseIntent(
      testState({
        phase: "chooseHandCard",
        players: [
          { ...basePlayers[0], strategy: "aggressive" },
          basePlayers[1],
        ],
      }),
    );
    expect(aggressive).toEqual({ type: "playCard", cardId: "crash-bayer" });
    expect(defensive).toEqual({ type: "playCard", cardId: "boost-bmw" });
    expect(middle).toEqual({ type: "playCard", cardId: "crash-bayer" });
  });

  it("buys toward a hand-strong company instead of ending trade with zero shares", () => {
    const state = testState({
      phase: "optionalTrade",
      players: [
        aiPlayer("Bot", "middle", {
          cash: 1000,
          shares: emptyShares(),
          hand: [pumpBmw60],
        }),
        humanPlayer("Ada"),
      ],
    });
    const first = chooseIntent(state);
    expect(first).toEqual({ type: "buy", company: "bmw", quantity: expect.any(Number) });
    if (first.type === "buy") {
      expect(first.quantity).toBeGreaterThan(0);
    }
  });

  it("Aggressive buys into a low-price name when the hand has strong upside", () => {
    const state = testState({
      phase: "optionalTrade",
      prices: { commerzbank: 100, bayer: 100, bmw: 20, bp: 100 },
      players: [
        aiPlayer("Bot", "aggressive", {
          cash: 1000,
          shares: emptyShares(),
          hand: [pumpBmw60],
        }),
        humanPlayer("Ada"),
      ],
    });
    const intent = chooseIntent(state);
    expect(intent).toEqual({
      type: "buy",
      company: "bmw",
      quantity: expect.any(Number),
    });
  });

  it("Defensive does not all-in a hot low-price name without hand support", () => {
    const state = testState({
      phase: "optionalTrade",
      prices: { commerzbank: 100, bayer: 100, bmw: 20, bp: 100 },
      players: [
        aiPlayer("Bot", "defensive", {
          cash: 1000,
          shares: emptyShares(),
          hand: [riseBayer],
        }),
        humanPlayer("Ada"),
      ],
    });
    const intent = chooseIntent(state);
    if (intent.type === "buy" && intent.company === "bmw") {
      const maxAffordable = Math.floor(1000 / 20);
      expect(intent.quantity).toBeLessThan(maxAffordable);
    } else {
      expect(intent.type === "endTrade" || intent.type === "buy").toBe(true);
      if (intent.type === "buy") {
        expect(intent.company).not.toBe("bmw");
      }
    }
  });

  it("Middle splits from Aggressive and Defensive on a hot low-price trade", () => {
    const prices = { commerzbank: 100, bayer: 100, bmw: 20, bp: 100 };
    const mk = (strategy: AiStrategy) =>
      testState({
        phase: "optionalTrade",
        prices,
        players: [
          aiPlayer("Bot", strategy, {
            cash: 400,
            shares: emptyShares(),
            hand: [pumpBmw60],
          }),
          humanPlayer("Ada", { cash: 1000, shares: emptyShares() }),
        ],
      });

    const aggressive = chooseIntent(mk("aggressive"));
    const defensive = chooseIntent(mk("defensive"));
    const middle = chooseIntent(mk("middle"));

    expect(aggressive.type).toBe("buy");
    if (aggressive.type === "buy") expect(aggressive.company).toBe("bmw");

    // Defensive is more cautious on size or may buy less / elsewhere / end.
    const defensiveBmwQty =
      defensive.type === "buy" && defensive.company === "bmw"
        ? defensive.quantity
        : 0;
    const aggressiveBmwQty =
      aggressive.type === "buy" && aggressive.company === "bmw"
        ? aggressive.quantity
        : 0;
    expect(defensiveBmwQty).toBeLessThan(aggressiveBmwQty);

    const middleBmwQty =
      middle.type === "buy" && middle.company === "bmw" ? middle.quantity : 0;
    expect(middleBmwQty).toBeGreaterThanOrEqual(defensiveBmwQty);
    expect(middleBmwQty).toBeLessThanOrEqual(aggressiveBmwQty);
  });

  it("is deterministic for the same state and strategy", () => {
    const state = testState({
      phase: "chooseHandCard",
      players: [
        aiPlayer("Bot", "defensive", {
          hand: [riseBmw, riseBayer],
          shares: { ...emptyShares(), bmw: 5, bayer: 5 },
        }),
        humanPlayer("Ada"),
      ],
    });
    const a = chooseIntent(state);
    const b = chooseIntent(state);
    expect(a).toEqual(b);
  });

  it("can buy then endTrade on a trade phase", () => {
    let state = testState({
      phase: "optionalTrade",
      drawPile: [
        {
          id: "still-in-pile",
          kind: "action",
          title: "filler",
          text: "",
          ops: [{ type: "delta", company: "bmw", amount: 0 }],
        },
      ],
      players: [
        aiPlayer("Bot", "middle", {
          cash: 1000,
          shares: emptyShares(),
          hand: [pumpBmw60],
        }),
        humanPlayer("Ada"),
      ],
    });
    const first = chooseIntent(state);
    expect(first.type).toBe("buy");
    const bought = reduce(state, first);
    expect(bought.ok).toBe(true);
    state = bought.state;
    let guard = 0;
    while (state.phase === "optionalTrade" && guard < 20) {
      const intent = chooseIntent(state);
      const next = reduce(state, intent);
      expect(next.ok).toBe(true);
      state = next.state;
      if (intent.type === "endTrade") break;
      guard += 1;
    }
    expect(state.phase).toBe("chooseTurn");
  });

  it("chooses Trade when the draw pile is empty", () => {
    const state = testState({
      phase: "chooseTurn",
      drawPile: [],
      players: [
        aiPlayer("Bot", "defensive", { cash: 1000 }),
        humanPlayer("Ada"),
      ],
    });
    expect(chooseIntent(state)).toEqual({ type: "startTrade" });
  });

  it("prefers Trade over Draw when cash is idle and the hand pumps a name", () => {
    const state = testState({
      phase: "chooseTurn",
      drawPile: [riseBmw],
      players: [
        aiPlayer("Bot", "middle", {
          cash: 1000,
          shares: emptyShares(),
          hand: [pumpBmw60, riseBayer, boostBmw, crashBayer],
        }),
        humanPlayer("Ada"),
      ],
    });
    expect(chooseIntent(state)).toEqual({ type: "startTrade" });
  });

  it("prefers Draw when already positioned in hand-pumped names and cash is low", () => {
    const state = testState({
      phase: "chooseTurn",
      drawPile: [riseBmw],
      prices: { commerzbank: 100, bayer: 100, bmw: 100, bp: 100 },
      players: [
        aiPlayer("Bot", "middle", {
          // No spare cash to deploy; book already matches BMW pumps only.
          cash: 50,
          shares: { ...emptyShares(), bmw: 10 },
          hand: [pumpBmw60, boostBmw],
        }),
        humanPlayer("Ada"),
      ],
    });
    expect(chooseIntent(state)).toEqual({ type: "draw" });
  });

  it("after buying into a pump name, later turns draw and play a card", () => {
    let state = testState({
      phase: "chooseTurn",
      drawPile: [riseBmw, boostBmw, pumpBmw60],
      players: [
        aiPlayer("Bot", "middle", {
          cash: 1000,
          shares: emptyShares(),
          // Single-name pump hand so Trade deploys into BMW, then Draw realizes.
          hand: [pumpBmw60, boostBmw, pumpBmw60, boostBmw].map((c, i) => ({
            ...c,
            id: `${c.id}-${i}`,
          })),
        }),
        humanPlayer("Ada"),
      ],
    });

    // Turn 1: deploy idle cash (Trade), then leave trade.
    expect(chooseIntent(state)).toEqual({ type: "startTrade" });
    state = reduce(state, { type: "startTrade" }).state;
    let guard = 0;
    while (state.phase === "optionalTrade" && guard < 20) {
      const intent = chooseIntent(state);
      const next = reduce(state, intent);
      expect(next.ok).toBe(true);
      state = next.state;
      if (intent.type === "endTrade") break;
      guard += 1;
    }
    expect(state.players[0].shares.bmw).toBeGreaterThan(0);
    expect(state.phase).toBe("chooseTurn");

    // Human passes.
    state = {
      ...state,
      currentPlayerIndex: 1,
      phase: "chooseTurn",
    };
    state = reduce(state, { type: "startTrade" }).state;
    state = reduce(state, { type: "endTrade" }).state;
    expect(state.currentPlayerIndex).toBe(0);
    expect(state.phase).toBe("chooseTurn");

    // Turn 2+: must leave Trade-only and eventually play a hand card.
    let sawDraw = false;
    let sawPlay = false;
    guard = 0;
    while (!sawPlay && state.phase !== "gameOver" && guard < 30) {
      if (state.currentPlayerIndex !== 0) {
        if (state.phase === "chooseTurn") {
          state = reduce(state, { type: "startTrade" }).state;
        } else if (state.phase === "optionalTrade") {
          state = reduce(state, { type: "endTrade" }).state;
        } else {
          break;
        }
        guard += 1;
        continue;
      }
      const intent = chooseIntent(state);
      if (intent.type === "draw") sawDraw = true;
      if (intent.type === "playCard") sawPlay = true;
      const next = reduce(state, intent);
      expect(next.ok).toBe(true);
      state = next.state;
      guard += 1;
    }
    expect(sawDraw).toBe(true);
    expect(sawPlay).toBe(true);
  });

  it("scores Aggressive hotter than Defensive on the same leveraged book", () => {
    const state = testState({
      prices: { commerzbank: 100, bayer: 100, bmw: 20, bp: 100 },
      players: [
        aiPlayer("Bot", "aggressive", {
          cash: 200,
          shares: { ...emptyShares(), bmw: 30 },
          hand: [pumpBmw60],
        }),
        humanPlayer("Ada"),
      ],
    });
    const agg = strategyScore(state, 0, "aggressive");
    const def = strategyScore(
      {
        ...state,
        players: [{ ...state.players[0], strategy: "defensive" }, state.players[1]],
      },
      0,
      "defensive",
    );
    // Same features; different weights — aggressive weights chance higher / risk lower.
    expect(agg).toBeGreaterThan(def);
  });
});
