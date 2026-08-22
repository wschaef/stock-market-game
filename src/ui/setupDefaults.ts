import type { AiStrategy } from "../engine";
import { defaultPileCounts } from "../engine";

export const DEFAULT_PLAYER_COUNT = 4;

export type SeatDraft = {
  name: string
  controller: "human" | "ai"
  strategy: AiStrategy
};

export const DEFAULT_SEATS: SeatDraft[] = [
  { name: "Ada", controller: "human", strategy: "defensive" },
  { name: "Bot", controller: "ai", strategy: "defensive" },
  { name: "Chen", controller: "ai", strategy: "aggressive" },
  { name: "Dia", controller: "ai", strategy: "middle" },
];

export { defaultPileCounts };
