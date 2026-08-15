import { useState } from "react";
import {
  COMPANY_LABEL,
  COMPANIES,
  allowedChoices,
  canTrade,
  ranking,
  reduce,
  setupGame,
  type Company,
  type GameState,
} from "./engine";
import { relativeBarPercents } from "./ui/relativeBars";

const COMPANY_TONE: Record<Company, string> = {
  commerzbank: "tone-commerzbank",
  bayer: "tone-bayer",
  bmw: "tone-bmw",
  bp: "tone-bp",
};

function eventText(state: GameState): string[] {
  return state.lastEvents.map((event) => {
    const name = COMPANY_LABEL[event.company];
    if (event.type === "split") {
      return `${name} split: target ${event.target} → ${event.newPrice}; shareholders’ shares doubled.`;
    }
    if (event.type === "wipeout") {
      return `${name} wipeout (target ${event.target}): shares lost, price reset to 100.`;
    }
    return `${name}: ${event.from} → ${event.to}`;
  });
}

function Setup({ onStart }: { onStart: (names: string[]) => void }) {
  const [count, setCount] = useState(2);
  const [names, setNames] = useState(["Ada", "Bob", "Chen", "Dia"]);
  return (
    <div className="shell setup-shell">
      <header className="brand-block">
        <p className="brand">Börsenspiel</p>
        <h1>Hotseat market</h1>
        <p className="lede">
          Draw or trade on one device. You cannot trade after an Action card —
          only after a Risk, or on a Trade-only turn.
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

      <div className="name-grid">
        {names.slice(0, count).map((name, i) => (
          <label className="field" key={i}>
            Player {i + 1}
            <input
              value={name}
              onChange={(e) => {
                const next = [...names];
                next[i] = e.target.value;
                setNames(next);
              }}
            />
          </label>
        ))}
      </div>

      <button type="button" className="cta" onClick={() => onStart(names.slice(0, count))}>
        Start game
      </button>
    </div>
  );
}

function MarketDiagram({
  state,
  qty,
  setQty,
  onBuy,
  onSell,
  onEndTrade,
}: {
  state: GameState
  qty: number
  setQty: (n: number) => void
  onBuy: (company: Company) => void
  onSell: (company: Company) => void
  onEndTrade: () => void
}) {
  const player = state.players[state.currentPlayerIndex];
  const bars = relativeBarPercents(state.prices);
  const trading = canTrade(state);

  return (
    <section className="market-panel" aria-label="Share prices">
      <div className="section-head">
        <h2>Share prices</h2>
        <p>Bar length shows each price relative to the highest.</p>
      </div>

      <ul className="price-diagram">
        {COMPANIES.map((company) => (
          <li className={`price-row ${COMPANY_TONE[company]}`} key={company}>
            <div className="price-meta">
              <span className="price-name">{COMPANY_LABEL[company]}</span>
              <span className="price-value">${state.prices[company]}</span>
            </div>
            <div className="bar-track" aria-hidden="true">
              <div
                className="bar-fill"
                style={{ width: `${bars[company]}%` }}
              />
            </div>
            <div className="price-stats">
              <span>You {player.shares[company]}</span>
              <span>Bank {state.bankShares[company]}</span>
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
        ))}
      </ul>

      {trading ? (
        <div className="trade-toolbar">
          <label className="field inline">
            Quantity
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
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
  onPlay,
}: {
  state: GameState
  onPlay: (cardId: string) => void
}) {
  const player = state.players[state.currentPlayerIndex];
  const playable = state.phase === "chooseHandCard";

  return (
    <section className="hand-panel" aria-label="Your cards">
      <div className="section-head">
        <h2>Your cards</h2>
        <p>
          {playable
            ? "Pick one card to play."
            : "Visible for your whole turn — playable after you draw an Action."}
        </p>
      </div>
      <div className={`hand ${playable ? "hand-playable" : "hand-readonly"}`}>
        {player.hand.map((card) =>
          playable ? (
            <button
              type="button"
              className="card"
              key={card.id}
              onClick={() => onPlay(card.id)}
            >
              <strong>{card.title}</strong>
              <small>{card.text}</small>
            </button>
          ) : (
            <article className="card" key={card.id}>
              <strong>{card.title}</strong>
              <small>{card.text}</small>
            </article>
          ),
        )}
      </div>
    </section>
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
  const player = state.players[state.currentPlayerIndex];
  const others = state.players.filter((_, i) => i !== state.currentPlayerIndex);

  function act(intent: Parameters<typeof reduce>[1]) {
    setState(reduce(state, intent).state);
  }

  const phaseHelp = {
    chooseTurn: "Draw a card, or Trade only (no draw).",
    chooseHandCard: "Play one of your five cards. You cannot trade after this.",
    chooseCompany: "Choose which company gets [?].",
    optionalTrade: "Buy and/or sell on the share rows, then end the turn.",
    gameOver: "Draw pile is empty. Highest net worth wins.",
  }[state.phase];

  return (
    <div className="shell board-shell">
      <header className="top-bar">
        <p className="brand">Börsenspiel</p>
        <button type="button" className="secondary" onClick={onReset}>
          New game
        </button>
      </header>

      {state.phase !== "gameOver" ? (
        <div className="turn-banner" role="status">
          <span className="turn-label">On turn</span>
          <strong className="turn-name">{player.name}</strong>
          <span className="turn-cash">${player.cash}</span>
          <span className="turn-pile">Pile {state.drawPile.length}</span>
        </div>
      ) : null}

      <p className="phase-help">{phaseHelp}</p>
      {state.lastError ? <p className="error">{state.lastError}</p> : null}
      {eventText(state).map((line) => (
        <p className="event" key={line}>
          {line}
        </p>
      ))}
      {state.lastDrawn ? (
        <p className="drawn">
          Last drawn: <strong>{state.lastDrawn.title}</strong>
          {state.lastDrawn.text ? ` — ${state.lastDrawn.text}` : ""}
        </p>
      ) : null}

      <MarketDiagram
        state={state}
        qty={qty}
        setQty={setQty}
        onBuy={(company) => act({ type: "buy", company, quantity: qty })}
        onSell={(company) => act({ type: "sell", company, quantity: qty })}
        onEndTrade={() => act({ type: "endTrade" })}
      />

      {state.phase !== "gameOver" ? (
        <Hand
          state={state}
          onPlay={(cardId) => act({ type: "playCard", cardId })}
        />
      ) : null}

      {state.phase === "chooseTurn" ? (
        <div className="action-row">
          <button type="button" className="cta" onClick={() => act({ type: "draw" })}>
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

      {state.phase === "chooseCompany" && state.pendingCard ? (
        <section className="picker-panel">
          <div className="section-head">
            <h2>{state.pendingCard.title}</h2>
            <p>{state.pendingCard.text}</p>
          </div>
          <div className="action-row">
            {allowedChoices(state.pendingCard).map((company) => (
              <button
                type="button"
                key={company}
                onClick={() => act({ type: "chooseCompany", company })}
              >
                {COMPANY_LABEL[company]}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {others.length > 0 && state.phase !== "gameOver" ? (
        <section className="others-panel" aria-label="Other players">
          <div className="section-head">
            <h2>Waiting</h2>
          </div>
          <ul className="others-list">
            {others.map((p) => (
              <li key={p.id}>
                <strong>{p.name}</strong>
                <span>${p.cash}</span>
                <span>
                  {COMPANIES.map(
                    (c) => `${COMPANY_LABEL[c]} ${p.shares[c]}`,
                  ).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
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
                <span>${row.netWorth}</span>
                {row.tied ? <em>tie</em> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

export function App() {
  const [state, setState] = useState<GameState | null>(null);

  if (!state) {
    return (
      <Setup
        onStart={(names) => {
          try {
            setState(setupGame(names));
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
