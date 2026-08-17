export const COMPANIES = ["commerzbank", "bayer", "bmw", "bp"] as const;
export type Company = (typeof COMPANIES)[number];

export const COMPANY_LABEL: Record<Company, string> = {
  commerzbank: "Commerzbank",
  bayer: "Bayer",
  bmw: "BMW AG",
  bp: "BP",
};

export const STARTING_PRICE = 100;
export const STARTING_CASH = 1000;
export const STARTING_HAND = 4;
export const ACTIONS_PER_PLAYER_IN_PILE = 9;
export const RISKS_PER_PLAYER_IN_PILE = 3;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const SPLIT_ABOVE = 250;
export const WIPEOUT_BELOW = 10;
export const DEFAULT_ROUNDS = 10;
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 50;

export const AI_STRATEGIES = ["wealth", "punish", "balanced"] as const;
export type AiStrategy = (typeof AI_STRATEGIES)[number];

export const AI_STRATEGY_LABEL: Record<AiStrategy, string> = {
  wealth: "Investor",
  punish: "Raider",
  balanced: "Mixed",
};

export type PlayerController = "human" | "ai";

export type NamedOp =
  | { type: "delta"; company: Company; amount: number }
  | { type: "scale"; company: Company; factor: 2 | 0.5 };

export type ChoiceOp =
  | { type: "deltaChoice"; amount: number }
  | { type: "scaleChoice"; factor: 2 | 0.5 };

export type CardOp = NamedOp | ChoiceOp;

export type Card = {
  id: string
  kind: "risk" | "action"
  title: string
  text: string
  ops: CardOp[]
};

export type Player = {
  id: string
  name: string
  cash: number
  shares: Record<Company, number>
  hand: Card[]
  controller: PlayerController
  strategy: AiStrategy | null
};

export type Phase =
  | "chooseTurn"
  | "chooseHandCard"
  | "chooseCompany"
  | "optionalTrade"
  | "gameOver";

export type GameEvent =
  | {
      type: "split"
      company: Company
      from: number
      target: number
      newPrice: number
      doubledShares: boolean
    }
  | { type: "wipeout"; company: Company; from: number; target: number }
  | { type: "priceChange"; company: Company; from: number; to: number };

export type TradeLog = {
  actor: string
  company: Company
  bought: number
  sold: number
  price: number
};

export type GameLogEntry = {
  id: number
  text: string
  trade?: TradeLog
  play?: { actor: string }
};

export type RandomFn = () => number;

export type GameState = {
  players: Player[]
  currentPlayerIndex: number
  prices: Record<Company, number>
  drawPile: Card[]
  discardPile: Card[]
  unusedCards: Card[]
  phase: Phase
  pendingCard: Card | null
  lastEvents: GameEvent[]
  lastDrawn: Card | null
  lastError: string | null
  roundsTotal: number
  roundsCompleted: number
  log: GameLogEntry[]
  random: RandomFn
};

export type Intent =
  | { type: "draw" }
  | { type: "startTrade" }
  | { type: "playCard"; cardId: string }
  | { type: "chooseCompany"; company: Company }
  | { type: "buy"; company: Company; quantity: number }
  | { type: "sell"; company: Company; quantity: number }
  | { type: "endTrade" };

export type SeatConfig = {
  name: string
  controller: PlayerController
  strategy?: AiStrategy | null
};
