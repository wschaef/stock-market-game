import type { AiStrategy } from "../engine";
import { defaultPileCounts } from "../engine";

export const DEFAULT_PLAYER_COUNT = 4;

export type SeatDraft = {
  name: string
  controller: "human" | "ai"
  strategy: AiStrategy
};

export const DEFAULT_SEATS: SeatDraft[] = [
  { name: "Ada", controller: "human", strategy: "wealth" },
  { name: "Bot", controller: "ai", strategy: "wealth" },
  { name: "Chen", controller: "ai", strategy: "punish" },
  { name: "Dia", controller: "ai", strategy: "balanced" },
];

export { defaultPileCounts };
