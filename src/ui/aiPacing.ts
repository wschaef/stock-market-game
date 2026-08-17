import type { Intent } from "../engine/types";

/** Milliseconds between AI intents. Slower than the original 280/450/550/650/700 set. */
export const AI_PACE = {
  think: 500,
  other: 750,
  buySell: 900,
  draw: 1050,
  playOrChoose: 1150,
} as const;

export function aiDelayMs(intent: Intent): number {
  if (intent.type === "buy" || intent.type === "sell") return AI_PACE.buySell;
  if (intent.type === "playCard" || intent.type === "chooseCompany") {
    return AI_PACE.playOrChoose;
  }
  if (intent.type === "draw") return AI_PACE.draw;
  return AI_PACE.other;
}
