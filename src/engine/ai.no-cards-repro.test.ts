/**
 * Temporary debug repro — drives many all-AI turns and summarizes intent mix.
 * Run: npx vitest run src/engine/ai.no-cards-repro.test.ts
 * Logs: /opt/cursor/logs/debug.log
 */
import { appendFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chooseIntent, drainAiDebugLogs } from "./ai";
import { setupGame } from "./setup";
import { allowedChoices, reduce } from "./turn";
import type { GameState, Intent } from "./types";

const DEBUG_LOG = "/opt/cursor/logs/debug.log";

function persistAiLogs(): void {
  const chunk = drainAiDebugLogs();
  if (chunk) appendFileSync(DEBUG_LOG, chunk);
}

function summaryLog(message: string, data: Record<string, unknown>) {
  persistAiLogs();
  appendFileSync(
    DEBUG_LOG,
    `${JSON.stringify({
      hypothesisId: "REPRO",
      location: "ai.no-cards-repro.test.ts",
      message,
      data,
      timestamp: Date.now(),
    })}\n`,
  );
}

function advanceHuman(state: GameState): GameState {
  const player = state.players[state.currentPlayerIndex];
  if (player.controller !== "human") return state;
  if (state.phase === "chooseTurn") {
    return reduce(state, { type: "startTrade" }).state;
  }
  if (state.phase === "optionalTrade") {
    return reduce(state, { type: "endTrade" }).state;
  }
  if (state.phase === "chooseHandCard" && player.hand[0]) {
    return reduce(state, { type: "playCard", cardId: player.hand[0].id }).state;
  }
  if (state.phase === "chooseCompany" && state.pendingCard) {
    const company = allowedChoices(state.pendingCard)[0];
    if (company) {
      return reduce(state, { type: "chooseCompany", company }).state;
    }
  }
  return state;
}

function runUntilGameOver(
  state: GameState,
  maxSteps: number,
): {
  steps: number;
  counts: Record<string, number>;
  throws: { step: number; phase: string; error: string }[];
  reduceFails: number;
  playCardSteps: number;
  startTradeOnChooseTurn: number;
  chooseTurnSteps: number;
  finalPhase: string;
} {
  const counts: Record<string, number> = {};
  const throws: { step: number; phase: string; error: string }[] = [];
  let reduceFails = 0;
  let playCardSteps = 0;
  let startTradeOnChooseTurn = 0;
  let chooseTurnSteps = 0;
  let cursor = state;
  let steps = 0;

  while (cursor.phase !== "gameOver" && steps < maxSteps) {
    const seat = cursor.players[cursor.currentPlayerIndex];
    if (seat.controller === "human") {
      const before = cursor;
      cursor = advanceHuman(cursor);
      if (cursor === before) break;
      steps += 1;
      continue;
    }

    const phaseBefore = cursor.phase;
    let intent: Intent;
    try {
      intent = chooseIntent(cursor);
    } catch (err) {
      throws.push({
        step: steps,
        phase: phaseBefore,
        error: err instanceof Error ? err.message : String(err),
      });
      summaryLog("chooseIntent threw", {
        step: steps,
        phase: phaseBefore,
        error: err instanceof Error ? err.message : String(err),
        handLen: seat.hand.length,
      });
      break;
    }

    counts[intent.type] = (counts[intent.type] ?? 0) + 1;
    if (intent.type === "playCard") playCardSteps += 1;
    if (phaseBefore === "chooseTurn") {
      chooseTurnSteps += 1;
      if (intent.type === "startTrade") startTradeOnChooseTurn += 1;
    }

    const applied = reduce(cursor, intent);
    if (!applied.ok) {
      reduceFails += 1;
      summaryLog("reduce failed", {
        step: steps,
        phase: phaseBefore,
        intent,
        lastError: applied.state.lastError,
      });
      break;
    }
    cursor = applied.state;
    steps += 1;
  }

  persistAiLogs();
  return {
    steps,
    counts,
    throws,
    reduceFails,
    playCardSteps,
    startTradeOnChooseTurn,
    chooseTurnSteps,
    finalPhase: cursor.phase,
  };
}

describe("AI no-cards debug repro", () => {
  it("simulates all-AI games and records draw vs trade vs play mix", () => {
    writeFileSync(DEBUG_LOG, "");

    const strategies = ["aggressive", "middle", "defensive"] as const;
    const aggregates = {
      games: 0,
      totalSteps: 0,
      playCard: 0,
      startTrade: 0,
      draw: 0,
      chooseTurnTradeRate: [] as number[],
      gamesWithZeroPlayCard: 0,
      gamesWithThrow: 0,
      throws: [] as { step: number; phase: string; error: string }[],
    };

    // 1 seed × ≤40 steps is enough to distinguish Trade-only (H1) vs throw-freeze (H2).
    for (let seed = 0; seed < 1; seed++) {
      let n = 0;
      const random = () => {
        n = (n * 1664525 + 1013904223 + seed * 9973) >>> 0;
        return n / 0x100000000;
      };
      const state = setupGame({
        seats: [
          { name: "A", controller: "ai", strategy: strategies[seed % 3] },
          {
            name: "B",
            controller: "ai",
            strategy: strategies[(seed + 1) % 3],
          },
          {
            name: "C",
            controller: "ai",
            strategy: strategies[(seed + 2) % 3],
          },
        ],
        random,
        shuffle: (items) => {
          const copy = [...items];
          for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
          }
          return copy;
        },
      });

      const result = runUntilGameOver(state, 40);
      aggregates.games += 1;
      aggregates.totalSteps += result.steps;
      aggregates.playCard += result.counts.playCard ?? 0;
      aggregates.startTrade += result.counts.startTrade ?? 0;
      aggregates.draw += result.counts.draw ?? 0;
      if (result.chooseTurnSteps > 0) {
        aggregates.chooseTurnTradeRate.push(
          result.startTradeOnChooseTurn / result.chooseTurnSteps,
        );
      }
      if (result.playCardSteps === 0) aggregates.gamesWithZeroPlayCard += 1;
      if (result.throws.length > 0) {
        aggregates.gamesWithThrow += 1;
        aggregates.throws.push(...result.throws);
      }

      summaryLog("game finished", {
        seed,
        ...result,
        tradeRateOnChooseTurn:
          result.chooseTurnSteps > 0
            ? result.startTradeOnChooseTurn / result.chooseTurnSteps
            : null,
      });
    }

    const avgTradeRate =
      aggregates.chooseTurnTradeRate.reduce((a, b) => a + b, 0) /
      Math.max(aggregates.chooseTurnTradeRate.length, 1);

    summaryLog("aggregate", {
      ...aggregates,
      avgTradeRateOnChooseTurn: avgTradeRate,
      playCardPerGame: aggregates.playCard / aggregates.games,
      drawPerGame: aggregates.draw / aggregates.games,
      startTradePerGame: aggregates.startTrade / aggregates.games,
    });

    expect(aggregates.games).toBe(1);
    expect(aggregates.totalSteps).toBeGreaterThan(0);
  }, 90_000);

  it("repro: chooseTurn decisions with idle cash over several AI turns", () => {
    let n = 0;
    const random = () => {
      n = (n * 1664525 + 1013904223) >>> 0;
      return n / 0x100000000;
    };
    let state = setupGame({
      seats: [
        { name: "Bot", controller: "ai", strategy: "middle" },
        { name: "Ada", controller: "human", strategy: null },
      ],
      random,
      shuffle: (items) => {
        const copy = [...items];
        for (let i = copy.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
      },
    });

    const turnChoices: string[] = [];
    for (let i = 0; i < 40 && state.phase !== "gameOver"; i++) {
      const seat = state.players[state.currentPlayerIndex];
      if (seat.controller === "human") {
        state = advanceHuman(state);
        continue;
      }
      if (state.phase === "chooseTurn") {
        const intent = chooseIntent(state);
        turnChoices.push(intent.type);
      }
      try {
        const intent = chooseIntent(state);
        const next = reduce(state, intent);
        if (!next.ok) break;
        state = next.state;
      } catch (err) {
        summaryLog("idle-cash threw", {
          error: err instanceof Error ? err.message : String(err),
          phase: state.phase,
        });
        break;
      }
    }

    summaryLog("idle-cash turn choices", {
      turnChoices,
      tradeOnly:
        turnChoices.length > 0 && turnChoices.every((t) => t === "startTrade"),
      anyDraw: turnChoices.includes("draw"),
      tradeCount: turnChoices.filter((t) => t === "startTrade").length,
      drawCount: turnChoices.filter((t) => t === "draw").length,
    });

    expect(turnChoices.length).toBeGreaterThan(0);
  }, 60_000);
});
