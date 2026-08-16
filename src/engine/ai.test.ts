import { describe, expect, it } from "vitest";
import { chooseIntent } from "./ai";
import { reduce } from "./turn";
import {
  type Card,
  type GameState,
  type Player,
} from "./types";

function emptyShares() {
  return { commerzbank: 0, bayer: 0, bmw: 0, bp: 0 };
}

function aiPlayer(
  name: string,
  strategy: "wealth" | "punish" | "balanced",
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
    players: [aiPlayer("Bot", "wealth"), humanPlayer("Ada")],
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

describe("AI strategies", () => {
  it("Investor picks the card that raises own net worth more", () => {
    const state = testState({
      phase: "chooseHandCard",
      players: [
        aiPlayer("Bot", "wealth", {
          hand: [riseBmw, riseBayer],
          shares: { ...emptyShares(), bmw: 10 },
        }),
        humanPlayer("Ada", { shares: { ...emptyShares(), bayer: 10 } }),
      ],
    });
    expect(chooseIntent(state)).toEqual({ type: "playCard", cardId: "rise-bmw" });
  });

  it("Raider prefers hurting the rival lead over a smaller selfish gain", () => {
    const state = testState({
      phase: "chooseHandCard",
      players: [
        aiPlayer("Bot", "punish", {
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

  it("Mixed can differ from pure Investor when rival damage matters", () => {
    const basePlayers = [
      aiPlayer("Bot", "balanced", {
        cash: 1000,
        hand: [boostBmw, crashBayer],
        shares: { ...emptyShares(), bmw: 1 },
      }),
      humanPlayer("Ada", {
        cash: 1000,
        shares: { ...emptyShares(), bayer: 50 },
      }),
    ] as Player[];

    const mixed = chooseIntent(
      testState({ phase: "chooseHandCard", players: basePlayers }),
    );
    const wealth = chooseIntent(
      testState({
        phase: "chooseHandCard",
        players: [
          { ...basePlayers[0], strategy: "wealth" },
          basePlayers[1],
        ],
      }),
    );
    const punish = chooseIntent(
      testState({
        phase: "chooseHandCard",
        players: [
          { ...basePlayers[0], strategy: "punish" },
          basePlayers[1],
        ],
      }),
    );
    expect(punish).toEqual({ type: "playCard", cardId: "crash-bayer" });
    expect(wealth).toEqual({ type: "playCard", cardId: "boost-bmw" });
    expect(mixed).toEqual({ type: "playCard", cardId: "crash-bayer" });
  });

  it("is deterministic for the same state and strategy", () => {
    const state = testState({
      phase: "chooseHandCard",
      players: [
        aiPlayer("Bot", "wealth", {
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
      players: [
        aiPlayer("Bot", "wealth", {
          cash: 1000,
          shares: emptyShares(),
        }),
        humanPlayer("Ada"),
      ],
    });
    const first = chooseIntent(state);
    expect(first.type).toBe("buy");
    const bought = reduce(state, first);
    expect(bought.ok).toBe(true);
    state = bought.state;
    // Keep applying until endTrade or step cap
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
        aiPlayer("Bot", "wealth", { cash: 1000 }),
        humanPlayer("Ada"),
      ],
    });
    expect(chooseIntent(state)).toEqual({ type: "startTrade" });
  });
});
