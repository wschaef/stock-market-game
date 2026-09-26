import { describe, expect, it } from "vitest";
import { handFlyoutForcedOpen } from "./handFlyout";

describe("handFlyoutForcedOpen", () => {
  it("forces open when a human must play a hand card", () => {
    expect(
      handFlyoutForcedOpen({
        phase: "chooseHandCard",
        humanTurn: true,
      }),
    ).toBe(true);
  });

  it("does not force open on chooseTurn", () => {
    expect(
      handFlyoutForcedOpen({
        phase: "chooseTurn",
        humanTurn: true,
      }),
    ).toBe(false);
  });

  it("does not force open during optional trade", () => {
    expect(
      handFlyoutForcedOpen({
        phase: "optionalTrade",
        humanTurn: true,
      }),
    ).toBe(false);
  });

  it("does not force open while choosing a company", () => {
    expect(
      handFlyoutForcedOpen({
        phase: "chooseCompany",
        humanTurn: true,
      }),
    ).toBe(false);
  });

  it("does not force open on AI turns or game over", () => {
    expect(
      handFlyoutForcedOpen({
        phase: "chooseHandCard",
        humanTurn: false,
      }),
    ).toBe(false);
    expect(
      handFlyoutForcedOpen({
        phase: "gameOver",
        humanTurn: false,
      }),
    ).toBe(false);
  });
});
