import { describe, expect, it } from "vitest";
import type { Card, GameState, Player } from "../engine/types";
import {
  handPresentation,
  lastDrawnAnnouncement,
  viewingSeatIndex,
} from "./handVisibility";

function emptyShares() {
  return { commerzbank: 0, bayer: 0, bmw: 0, bp: 0 };
}

function player(
  name: string,
  extra: Partial<Player> = {},
): Player {
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

const adaAction: Card = {
  id: "ada-1",
  kind: "action",
  title: "+40 BMW / -50 [?]",
  text: "",
  ops: [
    { type: "delta", company: "bmw", amount: 40 },
    { type: "deltaChoice", amount: -50 },
  ],
};

const botAction: Card = {
  id: "bot-1",
  kind: "action",
  title: "+100 Bayer | others -20",
  text: "",
  ops: [
    { type: "delta", company: "bayer", amount: 100 },
    { type: "delta", company: "commerzbank", amount: -20 },
    { type: "delta", company: "bmw", amount: -20 },
    { type: "delta", company: "bp", amount: -20 },
  ],
};

const riskCard: Card = {
  id: "risk-1",
  kind: "risk",
  title: "Risk all +10",
  text: "",
  ops: [
    { type: "delta", company: "commerzbank", amount: 10 },
    { type: "delta", company: "bayer", amount: 10 },
    { type: "delta", company: "bmw", amount: 10 },
    { type: "delta", company: "bp", amount: 10 },
  ],
};

function testState(overrides: Partial<GameState> = {}): GameState {
  return {
    players: [player("Ada"), player("Bot")],
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

describe("viewingSeatIndex", () => {
  it("is the sole human even when an AI seat is on turn", () => {
    const state = testState({
      players: [
        player("Ada", { controller: "human", hand: [adaAction] }),
        player("Bot", {
          controller: "ai",
          strategy: "wealth",
          hand: [botAction],
        }),
      ],
      currentPlayerIndex: 1,
    });
    expect(viewingSeatIndex(state)).toBe(0);
  });

  it("is the current human in a hotseat game", () => {
    const state = testState({
      players: [
        player("Ada", { hand: [adaAction] }),
        player("Chen", { hand: [botAction] }),
      ],
      currentPlayerIndex: 1,
    });
    expect(viewingSeatIndex(state)).toBe(1);
  });

  it("is null during an AI turn when several humans share the device", () => {
    const state = testState({
      players: [
        player("Ada"),
        player("Bot", { controller: "ai", strategy: "punish" }),
        player("Chen"),
      ],
      currentPlayerIndex: 1,
    });
    expect(viewingSeatIndex(state)).toBe(null);
  });

  it("is null in an all-AI game", () => {
    const state = testState({
      players: [
        player("Bot", { controller: "ai", strategy: "wealth" }),
        player("Raider", { controller: "ai", strategy: "punish" }),
      ],
    });
    expect(viewingSeatIndex(state)).toBe(null);
  });
});

describe("handPresentation", () => {
  it("shows the human's own faces while the AI is on turn", () => {
    const state = testState({
      players: [
        player("Ada", { controller: "human", hand: [adaAction] }),
        player("Bot", {
          controller: "ai",
          strategy: "wealth",
          hand: [botAction],
        }),
      ],
      currentPlayerIndex: 1,
      phase: "chooseHandCard",
    });
    const view = handPresentation(state);
    expect(view).toMatchObject({
      mode: "faceUp",
      ownerName: "Ada",
      playable: false,
      label: "Your cards",
    });
    if (view.mode !== "faceUp") throw new Error("expected faces");
    expect(view.cards.map((card) => card.id)).toEqual(["ada-1"]);
  });

  it("makes the current human's cards playable in chooseHandCard", () => {
    const state = testState({
      players: [
        player("Ada", { hand: [adaAction] }),
        player("Bot", { controller: "ai", strategy: "wealth" }),
      ],
      currentPlayerIndex: 0,
      phase: "chooseHandCard",
    });
    const view = handPresentation(state);
    expect(view.mode).toBe("faceUp");
    if (view.mode !== "faceUp") throw new Error("expected faces");
    expect(view.playable).toBe(true);
  });

  it("hides the current AI hand when there is no single local human", () => {
    const state = testState({
      players: [
        player("Bot", {
          controller: "ai",
          strategy: "wealth",
          hand: [botAction, adaAction],
        }),
        player("Raider", { controller: "ai", strategy: "punish" }),
      ],
      currentPlayerIndex: 0,
    });
    expect(handPresentation(state)).toMatchObject({
      mode: "hidden",
      ownerName: "Bot",
      count: 2,
    });
  });
});

describe("lastDrawnAnnouncement", () => {
  it("names a Risk for everyone", () => {
    const state = testState({
      players: [
        player("Ada", { controller: "human" }),
        player("Bot", { controller: "ai", strategy: "wealth" }),
      ],
      currentPlayerIndex: 1,
      phase: "optionalTrade",
      lastDrawn: riskCard,
      lastEvents: [
        { type: "priceChange", company: "commerzbank", from: 100, to: 110 },
        { type: "priceChange", company: "bayer", from: 100, to: 110 },
        { type: "priceChange", company: "bmw", from: 100, to: 110 },
        { type: "priceChange", company: "bp", from: 100, to: 110 },
      ],
    });
    expect(lastDrawnAnnouncement(state)).toBe(
      "Last drawn: Risk all +10: Commerzbank +10 ($110), Bayer +10 ($110), BMW AG +10 ($110), BP +10 ($110)",
    );
  });

  it("hides an Action title when the owner is not the local viewer", () => {
    const state = testState({
      players: [
        player("Ada", { controller: "human" }),
        player("Bot", { controller: "ai", strategy: "wealth" }),
      ],
      currentPlayerIndex: 1,
      lastDrawn: botAction,
    });
    const text = lastDrawnAnnouncement(state);
    expect(text).toMatch(/action/i);
    expect(text).not.toContain(botAction.title);
  });

  it("names an Action drawn by the viewing human", () => {
    const state = testState({
      players: [
        player("Ada", { controller: "human" }),
        player("Bot", { controller: "ai", strategy: "wealth" }),
      ],
      currentPlayerIndex: 0,
      lastDrawn: adaAction,
    });
    expect(lastDrawnAnnouncement(state)).toContain(adaAction.title);
  });

  it("does not name a leftover Action after the drawer’s turn has passed", () => {
    const state = testState({
      players: [
        player("Ada", { controller: "human" }),
        player("Bot", { controller: "ai", strategy: "wealth" }),
      ],
      currentPlayerIndex: 0,
      phase: "chooseTurn",
      lastDrawn: botAction,
    });
    expect(lastDrawnAnnouncement(state)).toBeNull();
  });
});
