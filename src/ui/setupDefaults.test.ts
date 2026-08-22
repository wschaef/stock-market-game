import { describe, expect, it } from "vitest";
import { defaultPileCounts, DEFAULT_PLAYER_COUNT, DEFAULT_SEATS } from "./setupDefaults";

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

  it("scales risk and other pile defaults by player count", () => {
    expect(defaultPileCounts(2)).toEqual({ riskCards: 6, otherCards: 18 });
    expect(defaultPileCounts(3)).toEqual({ riskCards: 9, otherCards: 27 });
    expect(defaultPileCounts(DEFAULT_PLAYER_COUNT)).toEqual({
      riskCards: 12,
      otherCards: 32,
    });
  });
});
