import { describe, expect, it } from "vitest";
import { AI_PACE, aiDelayMs } from "./aiPacing";

describe("aiDelayMs", () => {
  it("is slower than the previous pacing set", () => {
    expect(AI_PACE.think).toBeGreaterThan(280);
    expect(AI_PACE.other).toBeGreaterThan(450);
    expect(AI_PACE.buySell).toBeGreaterThan(550);
    expect(AI_PACE.draw).toBeGreaterThan(650);
    expect(AI_PACE.playOrChoose).toBeGreaterThan(700);
  });

  it("maps intents to the exported delays", () => {
    expect(aiDelayMs({ type: "buy", company: "bmw", quantity: 1 })).toBe(
      AI_PACE.buySell,
    );
    expect(aiDelayMs({ type: "sell", company: "bayer", quantity: 2 })).toBe(
      AI_PACE.buySell,
    );
    expect(aiDelayMs({ type: "playCard", cardId: "x" })).toBe(
      AI_PACE.playOrChoose,
    );
    expect(aiDelayMs({ type: "chooseCompany", company: "bp" })).toBe(
      AI_PACE.playOrChoose,
    );
    expect(aiDelayMs({ type: "draw" })).toBe(AI_PACE.draw);
    expect(aiDelayMs({ type: "endTrade" })).toBe(AI_PACE.other);
    expect(aiDelayMs({ type: "startTrade" })).toBe(AI_PACE.other);
  });
});
