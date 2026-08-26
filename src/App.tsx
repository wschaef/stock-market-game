import { useEffect, useRef, useState } from "react";
import {
  AI_STRATEGIES,
  AI_STRATEGY_LABEL,
  COMPANY_LABEL,
  COMPANIES,
  RISK_CARDS,
  allowedChoices,
  canTrade,
  chooseIntent,
  defaultPileCounts,
  maxOtherCardsForPlayers,
  netWorth,
  nextChoicePrompt,
  ranking,
  reduce,
  setupGame,
  type AiStrategy,
  type Card,
  type Company,
  type GameState,
  type Intent,
  type SeatConfig,
} from "./engine";
import { AI_PACE, aiDelayMs } from "./ui/aiPacing";
import { cardEffectRows } from "./ui/cardEffectRows";
import { CompanyMark } from "./ui/CompanyMark";
import { FlashOnChange } from "./ui/FlashOnChange";
import {
  handPresentation,
  type HandPresentation,
} from "./ui/handVisibility";
import { LastDrawnStrip } from "./ui/LastDrawnStrip";
import {
  previewCardWealth,
  type CardWealthPreview,
} from "./ui/previewCardWealth";
import {
  DEFAULT_PLAYER_COUNT,
  DEFAULT_SEATS,
  type SeatDraft,
} from "./ui/setupDefaults";
import {
  priceBoardFilledCount,
  priceBoardTicks,
  lastPriceSpan,
  pricePieceHighlight,
} from "./ui/relativeBars";

const COMPANY_TONE: Record<Company, string> = {
  commerzbank: "tone-commerzbank",
  bayer: "tone-bayer",
  bmw: "tone-bmw",
  bp: "tone-bp",
};

function formatMoney(value: number): string {
  return `$${value.toLocaleString("en-US")}`;
}

function formatDelta(min: number, max: number): string {
  const fmt = (n: number) => {
    const sign = n > 0 ? "+" : "";
    return `${sign}$${n.toLocaleString("en-US")}`;
  };
  if (min === max) return fmt(min);
  return `${fmt(min)}…${fmt(max)}`;
}

function eventText(state: GameState): string[] {
  return state.lastEvents.map((event) => {
    const name = COMPANY_LABEL[event.company];
    if (event.type === "split") {
      return `${name} split: target ${event.target} → ${event.newPrice}; shares doubled.`;
    }
    if (event.type === "wipeout") {
      return `${name} wipeout (target ${event.target}): shares lost, price reset to 100.`;
    }
    return `${name}: ${event.from} → ${event.to}`;
  });
}

function EffectMagnitude({
  row,
}: {
  row: ReturnType<typeof cardEffectRows>[number]
}) {
  if (row.kind === "scale") {
    return (
      <span className="effect-mag">
        {row.factor === 2 ? "2×" : "½"}
      </span>
    );
  }
  const sign = row.amount > 0 ? "+" : "";
  return (
    <span className={`effect-mag ${row.amount < 0 ? "neg" : "pos"}`}>
      {sign}
      {row.amount}
    </span>
  );
}

function EffectRows({ card }: { card: Card }) {
  const rows = cardEffectRows(card);
  if (card.kind === "risk") {
    return (
      <ul className="risk-strip" aria-label="Risk effects">
        {rows.map((row, index) =>
          row.kind === "delta" && row.company ? (
            <li key={`${row.company}-${index}`}>
              <CompanyMark company={row.company} size="sm" />
              <span
                className={`risk-delta ${row.amount < 0 ? "neg" : "pos"}`}
              >
                {row.amount > 0 ? "+" : ""}
                {row.amount}
              </span>
            </li>
          ) : null,
        )}
      </ul>
    );
  }

  return (
    <ul className="effect-rows">
      {rows.map((row, index) => (
        <li key={index} className="effect-row">
          {row.company ? (
            <CompanyMark company={row.company} size="sm" />
          ) : (
            <span className="choice-token" title="Choose a company">
              ?
            </span>
          )}
          <EffectMagnitude row={row} />
        </li>
      ))}
    </ul>
  );
}

function CardFace({
  card,
  playable,
  previewActive,
  onPlay,
  onPreview,
}: {
  card: Card
  playable: boolean
  previewActive: boolean
  onPlay: (cardId: string) => void
  onPreview: (cardId: string | null) => void
}) {
  const body = (
    <>
      <EffectRows card={card} />
      <span className="card-kind">
        {card.kind === "risk" ? card.title : card.kind}
      </span>
    </>
  );

  const previewHandlers = playable
    ? {
        onMouseEnter: () => onPreview(card.id),
        onMouseLeave: () => onPreview(null),
        onFocus: () => onPreview(card.id),
        onBlur: () => onPreview(null),
      }
    : {};

  if (playable) {
    return (
      <button
        type="button"
        className={`card card-enter ${previewActive ? "card-previewing" : ""}`}
        onClick={() => onPlay(card.id)}
        aria-label={card.title}
        title={card.text}
        {...previewHandlers}
      >
        {body}
      </button>
    );
  }

  return (
    <article
      className="card card-enter"
      aria-label={card.title}
      title={card.text}
    >
      {body}
    </article>
  );
}

function CardBack({ index }: { index: number }) {
  return (
    <article
      className="card card-back card-enter"
      aria-label="Face-down card"
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <span className="card-back-mark" aria-hidden="true">
        B
      </span>
    </article>
  );
}

function Setup({
  onStart,
}: {
  onStart: (
    seats: SeatConfig[],
    pile: { riskCards: number; otherCards: number },
  ) => void
}) {
  const [count, setCount] = useState(DEFAULT_PLAYER_COUNT);
  const initialPile = defaultPileCounts(DEFAULT_PLAYER_COUNT);
  const [riskCards, setRiskCards] = useState(initialPile.riskCards);
  const [otherCards, setOtherCards] = useState(initialPile.otherCards);
  const [seats, setSeats] = useState<SeatDraft[]>(DEFAULT_SEATS);

  const maxOther = maxOtherCardsForPlayers(count);
  const maxRisk = RISK_CARDS.length;
  const defaults = defaultPileCounts(count);

  function updateSeat(index: number, patch: Partial<SeatDraft>) {
    setSeats((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function setPlayerCount(nextCount: number) {
    setCount(nextCount);
    const defaults = defaultPileCounts(nextCount);
    setRiskCards(defaults.riskCards);
    setOtherCards(defaults.otherCards);
  }

  return (
    <div className="shell setup-shell">
      <header className="brand-block">
        <p className="brand">Börsenspiel</p>
        <h1>Hotseat market</h1>
        <p className="lede">
          Draw or trade on one device. Mix human and AI seats. You cannot trade
          after an Action card — only after a Risk, or on a Trade-only turn. The
          game ends when the draw pile is empty.
        </p>
      </header>

      <label className="field">
        Players
        <select
          value={count}
          onChange={(e) => setPlayerCount(Number(e.target.value))}
        >
          <option value={2}>2</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
        </select>
      </label>

      <label className="field">
        Risk cards
        <input
          type="number"
          min={0}
          max={maxRisk}
          value={riskCards}
          onChange={(e) =>
            setRiskCards(
              Math.min(
                maxRisk,
                Math.max(0, Number(e.target.value) || 0),
              ),
            )
          }
        />
        <span className="field-hint">
          In the draw pile (0–{maxRisk}; default {defaults.riskCards} for {count}{" "}
          players)
        </span>
      </label>

      <label className="field">
        Other cards
        <input
          type="number"
          min={0}
          max={maxOther}
          value={otherCards}
          onChange={(e) =>
            setOtherCards(
              Math.min(
                maxOther,
                Math.max(0, Number(e.target.value) || 0),
              ),
            )
          }
        />
        <span className="field-hint">
          Action cards in the draw pile (0–{maxOther}; default {defaults.otherCards}{" "}
          for {count} players)
        </span>
      </label>

      <div className="name-grid seat-grid">
        {seats.slice(0, count).map((seat, i) => (
          <div className="seat-card" key={i}>
            <label className="field">
              Player {i + 1}
              <input
                value={seat.name}
                onChange={(e) => updateSeat(i, { name: e.target.value })}
              />
            </label>
            <label className="field">
              Controller
              <select
                value={seat.controller}
                onChange={(e) =>
                  updateSeat(i, {
                    controller: e.target.value as "human" | "ai",
                  })
                }
              >
                <option value="human">Human</option>
                <option value="ai">AI</option>
              </select>
            </label>
            {seat.controller === "ai" ? (
              <label className="field">
                Strategy
                <select
                  value={seat.strategy}
                  onChange={(e) =>
                    updateSeat(i, {
                      strategy: e.target.value as AiStrategy,
                    })
                  }
                >
                  {AI_STRATEGIES.map((id) => (
                    <option key={id} value={id}>
                      {AI_STRATEGY_LABEL[id]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ))}
      </div>

      <button
        type="button"
        className="cta"
        onClick={() =>
          onStart(
            seats.slice(0, count).map((seat) => ({
              name: seat.name,
              controller: seat.controller,
              strategy: seat.controller === "ai" ? seat.strategy : null,
            })),
            { riskCards, otherCards },
          )
        }
      >
        Start game
      </button>
    </div>
  );
}

function Scoreboard({
  state,
  preview,
}: {
  state: GameState
  preview: CardWealthPreview | null
}) {
  const previewById = new Map(
    preview?.players.map((row) => [row.playerId, row]) ?? [],
  );

  return (
    <section className="scoreboard-panel" aria-label="Scoreboard">
      <div className="section-head">
        <h2>Players</h2>
        {preview?.dependsOnChoice ? (
          <p className="preview-note">Wealth range depends on [?]</p>
        ) : null}
      </div>
      <ul className="scoreboard">
        {state.players.map((player, index) => {
          const wealth = netWorth(state, index);
          const onTurn = index === state.currentPlayerIndex;
          const delta = previewById.get(player.id);
          return (
            <li
              key={player.id}
              className={`score-row ${onTurn ? "on-turn" : ""}`}
            >
              <div className="score-identity">
                {onTurn ? <span className="on-turn-pill">On turn</span> : null}
                <strong className="score-name">{player.name}</strong>
                {player.controller === "ai" ? (
                  <span className="ai-pill">
                    AI · {AI_STRATEGY_LABEL[player.strategy ?? "defensive"]}
                  </span>
                ) : null}
              </div>
              <div className="score-money">
                <FlashOnChange value={player.cash} className="score-cash">
                  Cash {formatMoney(player.cash)}
                </FlashOnChange>
                <FlashOnChange value={wealth} className="score-wealth">
                  {formatMoney(wealth)}
                  {delta ? (
                    <span
                      className={`wealth-delta ${
                        delta.deltaMax < 0
                          ? "neg"
                          : delta.deltaMin > 0
                            ? "pos"
                            : "mixed"
                      }`}
                    >
                      {formatDelta(delta.deltaMin, delta.deltaMax)}
                    </span>
                  ) : null}
                </FlashOnChange>
              </div>
              <ul className="score-shares">
                {COMPANIES.map((company) => {
                  const count = player.shares[company];
                  return (
                    <li
                      key={company}
                      className={count === 0 ? "dim" : undefined}
                    >
                      <CompanyMark company={company} size="sm" />
                      <FlashOnChange value={count}>
                        <span>{count}</span>
                      </FlashOnChange>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MarketDiagram({
  state,
  qty,
  setQty,
  humanControls,
  onBuy,
  onSell,
  onEndTrade,
}: {
  state: GameState
  qty: number
  setQty: (n: number) => void
  humanControls: boolean
  onBuy: (company: Company) => void
  onSell: (company: Company) => void
  onEndTrade: () => void
}) {
  const ticks = priceBoardTicks();
  const trading = canTrade(state) && humanControls;

  return (
    <section className="market-panel" aria-label="Share prices">
      <div className="section-head">
        <h2>Share prices</h2>
      </div>

      <ul className="price-diagram">
        {COMPANIES.map((company) => {
          const filled = priceBoardFilledCount(state.prices[company]);
          const span = lastPriceSpan(state.lastEvents, company);
          return (
            <li className={`price-row ${COMPANY_TONE[company]}`} key={company}>
              <div className="price-meta">
                <span className="price-identity">
                  <CompanyMark company={company} size="md" />
                </span>
                <FlashOnChange
                  value={state.prices[company]}
                  className="price-value"
                >
                  {formatMoney(state.prices[company])}
                </FlashOnChange>
              </div>
              <div
                className="bar-track"
                role="img"
                aria-label={`${COMPANY_LABEL[company]} at ${state.prices[company]}`}
              >
                {ticks.map((tick, index) => {
                  const change = span
                    ? pricePieceHighlight(index, span.from, span.to)
                    : null;
                  return (
                    <span
                      key={tick}
                      className={[
                        "piece",
                        index < filled ? "filled" : "",
                        change ?? "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      title={`$${tick}`}
                    />
                  );
                })}
              </div>
              {trading ? (
                <div className="share-trade">
                  <button type="button" onClick={() => onBuy(company)}>
                    Buy
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => onSell(company)}
                  >
                    Sell
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {trading ? (
        <div className="trade-toolbar">
          <label className="field inline">
            Quantity
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) =>
                setQty(Math.max(1, Number(e.target.value) || 1))
              }
            />
          </label>
          <button type="button" className="cta" onClick={onEndTrade}>
            End turn
          </button>
        </div>
      ) : null}
    </section>
  );
}

function Hand({
  presentation,
  previewCardId,
  onPlay,
  onPreview,
}: {
  presentation: HandPresentation
  previewCardId: string | null
  onPlay: (cardId: string) => void
  onPreview: (cardId: string | null) => void
}) {
  if (presentation.mode === "hidden") {
    return (
      <section
        className="hand-panel"
        aria-label={`${presentation.ownerName}'s cards, face down`}
      >
        <div className="section-head">
          <h2>{presentation.label}</h2>
          <p>Hidden from other players.</p>
        </div>
        <div className="hand hand-hidden">
          {Array.from({ length: presentation.count }, (_, index) => (
            <CardBack key={index} index={index} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="hand-panel" aria-label="Your cards">
      <div className="section-head">
        <h2>{presentation.label}</h2>
        {presentation.playable ? (
          <p>Hover a card to preview wealth changes. Click to play.</p>
        ) : (
          <p>Only you can see these cards.</p>
        )}
      </div>
      <div
        className={`hand ${presentation.playable ? "hand-playable" : "hand-readonly"}`}
      >
        {presentation.cards.map((card) => (
          <CardFace
            key={card.id}
            card={card}
            playable={presentation.playable}
            previewActive={previewCardId === card.id}
            onPlay={onPlay}
            onPreview={onPreview}
          />
        ))}
      </div>
    </section>
  );
}

function ActionLog({ entries }: { entries: GameState["log"] }) {
  return (
    <details className="action-log">
      <summary>Action log ({entries.length})</summary>
      <ol className="action-log-list">
        {[...entries].reverse().map((entry) => (
          <li key={entry.id}>{entry.text}</li>
        ))}
      </ol>
    </details>
  );
}

function Board({
  state,
  setState,
  onReset,
}: {
  state: GameState
  setState: (state: GameState) => void
  onReset: () => void
}) {
  const [qty, setQty] = useState(1);
  const [previewCardId, setPreviewCardId] = useState<string | null>(null);
  const player = state.players[state.currentPlayerIndex];
  const humanTurn = player.controller === "human" && state.phase !== "gameOver";
  const stateRef = useRef(state);
  stateRef.current = state;

  function act(intent: Intent) {
    setPreviewCardId(null);
    const result = reduce(stateRef.current, intent);
    setState(result.state);
  }

  useEffect(() => {
    if (state.phase === "gameOver") return;
    const current = state.players[state.currentPlayerIndex];
    if (current.controller !== "ai") return;

    let cancelled = false;
    let timer = 0;

    const step = () => {
      if (cancelled) return;
      const live = stateRef.current;
      if (live.phase === "gameOver") return;
      const seat = live.players[live.currentPlayerIndex];
      if (seat.controller !== "ai") return;
      try {
        const intent = chooseIntent(live);
        const delay = aiDelayMs(intent);
        timer = window.setTimeout(() => {
          if (cancelled) return;
          const result = reduce(stateRef.current, intent);
          // #region agent log
          if (!result.ok) {
            console.error(
              "[AI-DEBUG H6]",
              JSON.stringify({
                hypothesisId: "H6",
                location: "App.tsx:AI-step-reduce",
                message: "reduce failed after chooseIntent",
                data: {
                  intent,
                  phase: stateRef.current.phase,
                  lastError: result.state.lastError,
                },
                timestamp: Date.now(),
              }),
            );
          }
          // #endregion
          setState(result.state);
        }, delay);
      } catch (err) {
        // #region agent log
        console.error(
          "[AI-DEBUG H2]",
          JSON.stringify({
            hypothesisId: "H2",
            location: "App.tsx:AI-step-catch",
            message: "chooseIntent threw — AI turn frozen",
            data: {
              error: err instanceof Error ? err.message : String(err),
              phase: live.phase,
              handLen: seat.hand.length,
              drawPileLen: live.drawPile.length,
              player: seat.name,
            },
            timestamp: Date.now(),
          }),
        );
        // #endregion
        // Ignore transient AI errors; human can reset.
      }
    };

    timer = window.setTimeout(step, AI_PACE.think);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [state, setState]);

  const previewCard =
    previewCardId &&
    state.phase === "chooseHandCard" &&
    humanTurn
      ? player.hand.find((card) => card.id === previewCardId) ?? null
      : null;
  const preview = previewCard ? previewCardWealth(state, previewCard) : null;
  const cards = handPresentation(state);

  return (
    <div className="shell board-shell">
      <header className="top-bar">
        <p className="brand">Börsenspiel</p>
        <div className="top-meta">
          <span className="pile-chip" title="Cards left in draw pile">
            Pile {state.drawPile.length}
          </span>
          <button type="button" className="secondary" onClick={onReset}>
            New game
          </button>
        </div>
      </header>

      {state.phase !== "gameOver" ? (
        <div className="turn-banner" role="status" key={player.id}>
          <span className="turn-label">On turn</span>
          <strong className="turn-name">{player.name}</strong>
          {player.controller === "ai" ? (
            <span className="ai-pill">
              AI · {AI_STRATEGY_LABEL[player.strategy ?? "defensive"]}
            </span>
          ) : null}
          <FlashOnChange value={player.cash} className="turn-cash">
            {formatMoney(player.cash)}
          </FlashOnChange>
        </div>
      ) : null}

      {state.lastError ? <p className="error">{state.lastError}</p> : null}
      {eventText(state).map((line) => (
        <p className="event" key={line}>
          {line}
        </p>
      ))}

      <div className="board-grid">
        <MarketDiagram
          state={state}
          qty={qty}
          setQty={setQty}
          humanControls={humanTurn}
          onBuy={(company) => act({ type: "buy", company, quantity: qty })}
          onSell={(company) => act({ type: "sell", company, quantity: qty })}
          onEndTrade={() => act({ type: "endTrade" })}
        />
        <LastDrawnStrip state={state} />
        {state.phase !== "gameOver" ? (
          <Scoreboard state={state} preview={preview} />
        ) : null}
      </div>

      {state.phase === "chooseTurn" && humanTurn ? (
        <div className="action-row turn-actions">
          <button
            type="button"
            className="turn-btn turn-btn-play"
            disabled={state.drawPile.length === 0}
            onClick={() => act({ type: "draw" })}
          >
            <span className="turn-btn-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                <rect
                  x="5"
                  y="3"
                  width="11"
                  height="15"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  transform="rotate(-8 10.5 10.5)"
                />
                <rect
                  x="8"
                  y="5"
                  width="11"
                  height="15"
                  rx="2"
                  fill="currentColor"
                  fillOpacity="0.2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
            </span>
            Play Card
          </button>
          <button
            type="button"
            className="turn-btn turn-btn-trade"
            onClick={() => act({ type: "startTrade" })}
          >
            <span className="turn-btn-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                <path
                  d="M7 8h11l-2.5-2.5M17 16H6l2.5 2.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            Trade only
          </button>
        </div>
      ) : null}

      {state.phase === "chooseCompany" && state.pendingCard && humanTurn ? (
        <section className="picker-panel">
          <div className="section-head">
            <h2>{nextChoicePrompt(state.pendingCard)}</h2>
            <p>{state.pendingCard.text || state.pendingCard.title}</p>
          </div>
          <div className="action-row picker-row">
            {allowedChoices(state.pendingCard).map((company) => (
              <button
                type="button"
                key={company}
                className="picker-btn"
                onClick={() => act({ type: "chooseCompany", company })}
                aria-label={COMPANY_LABEL[company]}
              >
                <CompanyMark company={company} size="lg" />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {state.phase !== "gameOver" ? (
        <Hand
          presentation={cards}
          previewCardId={previewCardId}
          onPlay={(cardId) => act({ type: "playCard", cardId })}
          onPreview={setPreviewCardId}
        />
      ) : null}

      {state.phase === "gameOver" ? (
        <section className="game-over-panel">
          <div className="section-head">
            <h2>Game over</h2>
            <p>Highest net worth wins.</p>
          </div>
          <ol className="ranking">
            {ranking(state).map((row) => (
              <li key={row.name}>
                <strong>{row.name}</strong>
                <span>{formatMoney(row.netWorth)}</span>
                {row.tied ? <em>tie</em> : null}
              </li>
            ))}
          </ol>
          <Scoreboard state={state} preview={null} />
        </section>
      ) : null}

      <ActionLog entries={state.log} />
    </div>
  );
}

export function App() {
  const [state, setState] = useState<GameState | null>(null);

  if (!state) {
    return (
      <Setup
        onStart={(seats, pile) => {
          try {
            setState(
              setupGame({
                seats,
                riskCards: pile.riskCards,
                otherCards: pile.otherCards,
              }),
            );
          } catch (error) {
            alert(error instanceof Error ? error.message : "Could not start");
          }
        }}
      />
    );
  }

  return (
    <Board
      state={state}
      setState={setState}
      onReset={() => setState(null)}
    />
  );
}
