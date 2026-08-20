import { describe, expect, it } from "vitest";
import { DEFAULT_ROUNDS } from "../engine";
import { DEFAULT_PLAYER_COUNT, DEFAULT_SEATS } from "./setupDefaults";

describe("start-game defaults", () => {
  it("opens a 4-seat table: human, AI defensive, AI aggressive, AI middle", () => {
    expect(DEFAULT_PLAYER_COUNT).toBe(4);
    expect(DEFAULT_SEATS.slice(0, DEFAULT_PLAYER_COUNT)).toEqual([
      { name: "Ada", controller: "human", strategy: "defensive" },
      { name: "Bot", controller: "ai", strategy: "defensive" },
      { name: "Chen", controller: "ai", strategy: "aggressive" },
      { name: "Dia", controller: "ai", strategy: "middle" },
    ]);
  });

  it("defaults to 15 rounds", () => {
    expect(DEFAULT_ROUNDS).toBe(15);
  });
});
