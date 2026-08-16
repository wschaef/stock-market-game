import { useEffect, useRef, useState } from "react";
import {
  AI_STRATEGIES,
  AI_STRATEGY_LABEL,
  COMPANY_LABEL,
  COMPANIES,
  DEFAULT_ROUNDS,
  MAX_ROUNDS,
  MIN_ROUNDS,
  allowedChoices,
  canTrade,
  chooseIntent,
  netWorth,
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
import { cardEffectRows } from "./ui/cardEffectRows";
import { CompanyMark } from "./ui/CompanyMark";
import {
  previewCardWealth,
  type CardWealthPreview,
} from "./ui/previewCardWealth";
import {
  priceBoardFilledCount,
  priceBoardTicks,
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
          <EffectMagnitude row={row} />
          {row.company ? (
            <CompanyMark company={row.company} size="sm" />
          ) : (
            <span className="choice-token" title="Choose a company">
              ?
            </span>
          )}
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
      <span className="card-kind">{card.kind}</span>
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
        className={`card ${previewActive ? "card-previewing" : ""}`}
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
    <article className="card" aria-label={card.title} title={card.text}>
      {body}
    </article>
  );
}

type SeatDraft = {
  name: string
  controller: "human" | "ai"
  strategy: AiStrategy
};

function Setup({
  onStart,
}: {
  onStart: (seats: SeatConfig[], roundsTotal: number) => void
}) {
  const [count, setCount] = useState(2);
  const [rounds, setRounds] = useState(DEFAULT_ROUNDS);
  const [seats, setSeats] = useState<SeatDraft[]>([
    { name: "Ada", controller: "human", strategy: "wealth" },
    { name: "Bot", controller: "ai", strategy: "wealth" },
    { name: "Chen", controller: "human", strategy: "punish" },
    { name: "Dia", controller: "ai", strategy: "balanced" },
  ]);

  function updateSeat(index: number, patch: Partial<SeatDraft>) {
    setSeats((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  return (
    <div className="shell setup-shell">
      <header className="brand-block">
        <p className="brand">Börsenspiel</p>
        <h1>Hotseat market</h1>
        <p className="lede">
          Draw or trade on one device. Mix human and AI seats. You cannot trade
          after an Action card — only after a Risk, or on a Trade-only turn.
        </p>
      </header>

      <label className="field">
        Players
        <select
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
        >
          <option value={2}>2</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
        </select>
      </label>

      <label className="field">
        Rounds
        <input
          type="number"
          min={MIN_ROUNDS}
          max={MAX_ROUNDS}
          value={rounds}
          onChange={(e) =>
            setRounds(
              Math.min(
                MAX_ROUNDS,
                Math.max(MIN_ROUNDS, Number(e.target.value) || MIN_ROUNDS),
              ),
            )
          }
        />
        <span className="field-hint">
          One round = each seat takes one turn ({MIN_ROUNDS}–{MAX_ROUNDS})
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
            rounds,
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
                    AI · {AI_STRATEGY_LABEL[player.strategy ?? "wealth"]}
                  </span>
                ) : null}
              </div>
              <div className="score-money">
                <span className="score-cash">
                  Cash {formatMoney(player.cash)}
                </span>
                <span className="score-wealth">
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
                </span>
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
                      <span>{count}</span>
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
          return (
            <li className={`price-row ${COMPANY_TONE[company]}`} key={company}>
              <div className="price-meta">
                <span className="price-identity">
                  <CompanyMark company={company} size="md" />
                </span>
                <span className="price-value">
                  {formatMoney(state.prices[company])}
                </span>
              </div>
              <div
                className="bar-track"
                role="img"
                aria-label={`${COMPANY_LABEL[company]} at ${state.prices[company]}`}
              >
                {ticks.map((tick, index) => (
                  <span
                    key={tick}
                    className={index < filled ? "piece filled" : "piece"}
                    title={`$${tick}`}
                  />
                ))}
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
  state,
  previewCardId,
  playable,
  onPlay,
  onPreview,
}: {
  state: GameState
  previewCardId: string | null
  playable: boolean
  onPlay: (cardId: string) => void
  onPreview: (cardId: string | null) => void
}) {
  const player = state.players[state.currentPlayerIndex];

  return (
    <section className="hand-panel" aria-label="Your cards">
      <div className="section-head">
        <h2>{playable ? "Your cards" : `${player.name}'s cards`}</h2>
        {playable ? (
          <p>Hover a card to preview wealth changes. Click to play.</p>
        ) : null}
      </div>
      <div className={`hand ${playable ? "hand-playable" : "hand-readonly"}`}>
        {player.hand.map((card) => (
          <CardFace
            key={card.id}
            card={card}
            playable={playable}
            previewActive={previewCardId === card.id}
            onPlay={onPlay}
            onPreview={onPreview}
          />
        ))}
      </div>
    </section>
  );
}

function aiDelayMs(intent: Intent): number {
  if (intent.type === "buy" || intent.type === "sell") return 550;
  if (intent.type === "playCard" || intent.type === "chooseCompany") return 700;
  if (intent.type === "draw") return 650;
  return 450;
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
          setState(result.state);
        }, delay);
      } catch {
        // Ignore transient AI errors; human can reset.
      }
    };

    timer = window.setTimeout(step, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [state, setState]);

  const previewCard =
    previewCardId && state.phase === "chooseHandCard" && humanTurn
      ? player.hand.find((card) => card.id === previewCardId) ?? null
      : null;
  const preview = previewCard ? previewCardWealth(state, previewCard) : null;

  return (
    <div className="shell board-shell">
      <header className="top-bar">
        <p className="brand">Börsenspiel</p>
        <div className="top-meta">
          <span className="pile-chip" title="Cards left in draw pile">
            Pile {state.drawPile.length}
          </span>
          <span className="pile-chip" title="Rounds completed of total">
            Round {Math.min(state.roundsCompleted + 1, state.roundsTotal)} /{" "}
            {state.roundsTotal}
          </span>
          <button type="button" className="secondary" onClick={onReset}>
            New game
          </button>
        </div>
      </header>

      {state.phase !== "gameOver" ? (
        <div className="turn-banner" role="status">
          <span className="turn-label">On turn</span>
          <strong className="turn-name">{player.name}</strong>
          {player.controller === "ai" ? (
            <span className="ai-pill">
              AI · {AI_STRATEGY_LABEL[player.strategy ?? "wealth"]}
            </span>
          ) : null}
          <span className="turn-cash">{formatMoney(player.cash)}</span>
        </div>
      ) : null}

      {state.lastError ? <p className="error">{state.lastError}</p> : null}
      {eventText(state).map((line) => (
        <p className="event" key={line}>
          {line}
        </p>
      ))}
      {state.lastDrawn ? (
        <p className="drawn">
          Last drawn: <strong>{state.lastDrawn.title}</strong>
        </p>
      ) : null}

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
        {state.phase !== "gameOver" ? (
          <Scoreboard state={state} preview={preview} />
        ) : null}
      </div>

      {state.phase === "chooseTurn" && humanTurn ? (
        <div className="action-row turn-actions">
          <button
            type="button"
            className="cta"
            disabled={state.drawPile.length === 0}
            onClick={() => act({ type: "draw" })}
          >
            Draw
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => act({ type: "startTrade" })}
          >
            Trade only
          </button>
        </div>
      ) : null}

      {state.phase === "chooseCompany" && state.pendingCard && humanTurn ? (
        <section className="picker-panel">
          <div className="section-head">
            <h2>Choose company</h2>
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
          state={state}
          previewCardId={previewCardId}
          playable={state.phase === "chooseHandCard" && humanTurn}
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
        onStart={(seats, roundsTotal) => {
          try {
            setState(setupGame({ seats, roundsTotal }));
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
