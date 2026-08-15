import { useState } from "react";
import {
  COMPANY_LABEL,
  COMPANIES,
  allowedChoices,
  canTrade,
  ranking,
  reduce,
  setupGame,
  type GameState,
} from "./engine";

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

function Setup({
  onStart,
}: {
  onStart: (names: string[]) => void
}) {
  const [count, setCount] = useState(2);
  const [names, setNames] = useState(["Ada", "Bob", "Chen", "Dia"]);
  return (
    <div className="wrap">
      <h1>Stock Market Game</h1>
      <p>Hotseat Börsenspiel. Draw or trade. You cannot trade after playing an Action card — only after a Risk, or on a Trade-only turn.</p>
      <label>
        Players{" "}
        <select
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
        >
          <option value={2}>2</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
        </select>
      </label>
      <div className="panel">
        {names.slice(0, count).map((name, i) => (
          <p key={i}>
            <label>
              Player {i + 1}{" "}
              <input
                value={name}
                onChange={(e) => {
                  const next = [...names];
                  next[i] = e.target.value;
                  setNames(next);
                }}
              />
            </label>
          </p>
        ))}
      </div>
      <button type="button" onClick={() => onStart(names.slice(0, count))}>
        Start game
      </button>
    </div>
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

  function act(
    intent: Parameters<typeof reduce>[1],
  ) {
    const result = reduce(state, intent);
    setState(result.state);
  }

  const phaseHelp = {
    chooseTurn: `${player.name}: Draw a card, or Trade only (no draw).`,
    chooseHandCard: `${player.name}: play one of your 5 cards. You will not be able to trade after this.`,
    chooseCompany: `${player.name}: choose which company gets [?].`,
    optionalTrade: `${player.name}: buy and/or sell, then end the turn.`,
    gameOver: "Draw pile is empty. Highest net worth wins.",
  }[state.phase];

  return (
    <div className="wrap">
      <div className="row">
        <h1>Stock Market Game</h1>
        <button type="button" className="secondary" onClick={onReset}>
          New game
        </button>
      </div>

      <div className="market">
        {COMPANIES.map((company) => (
          <div className="price-card" key={company}>
            {COMPANY_LABEL[company]}
            <strong>{state.prices[company]}</strong>
            <small>Bank: {state.bankShares[company]}</small>
          </div>
        ))}
      </div>

      <p className="others">
        {others.map((p) => (
          <span key={p.id}>
            {p.name}: ${p.cash} ·{" "}
            {COMPANIES.map((c) => `${COMPANY_LABEL[c]} ${p.shares[c]}`).join(
              " · ",
            )}{" "}
          </span>
        ))}
      </p>

      <div className="panel">
        <h2>
          {player.name} · ${player.cash} · pile {state.drawPile.length}
        </h2>
        <p>
          {COMPANIES.map(
            (c) => `${COMPANY_LABEL[c]} ${player.shares[c]}`,
          ).join(" · ")}
        </p>
        <p>{phaseHelp}</p>
        {state.lastError ? <p className="error">{state.lastError}</p> : null}
        {eventText(state).map((line) => (
          <p className="event" key={line}>
            {line}
          </p>
        ))}
        {state.lastDrawn ? (
          <p>
            Last drawn: <strong>{state.lastDrawn.title}</strong>
            {state.lastDrawn.text ? ` — ${state.lastDrawn.text}` : ""}
          </p>
        ) : null}
      </div>

      {state.phase === "chooseTurn" ? (
        <div className="row">
          <button type="button" onClick={() => act({ type: "draw" })}>
            Draw
          </button>
          <button type="button" className="secondary" onClick={() => act({ type: "startTrade" })}>
            Trade only
          </button>
        </div>
      ) : null}

      {state.phase === "chooseHandCard" ? (
        <div className="hand">
          {player.hand.map((card) => (
            <button
              type="button"
              className="card"
              key={card.id}
              onClick={() => act({ type: "playCard", cardId: card.id })}
            >
              {card.title}
              <small>{card.text}</small>
            </button>
          ))}
        </div>
      ) : null}

      {state.phase === "chooseCompany" && state.pendingCard ? (
        <div>
          <p>
            {state.pendingCard.title}
            <br />
            <small>{state.pendingCard.text}</small>
          </p>
          <div className="row">
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
        </div>
      ) : null}

      {canTrade(state) ? (
        <div className="panel">
          <div className="row">
            <label>
              Quantity{" "}
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
            </label>
            <button type="button" onClick={() => act({ type: "endTrade" })}>
              End turn
            </button>
          </div>
          {COMPANIES.map((company) => (
            <p key={company} className="row">
              <span>
                {COMPANY_LABEL[company]} @ {state.prices[company]}
              </span>
              <button
                type="button"
                onClick={() =>
                  act({ type: "buy", company, quantity: qty })
                }
              >
                Buy
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  act({ type: "sell", company, quantity: qty })
                }
              >
                Sell
              </button>
            </p>
          ))}
        </div>
      ) : null}

      {state.phase === "gameOver" ? (
        <div className="panel">
          <h2>Game over</h2>
          <ol>
            {ranking(state).map((row) => (
              <li key={row.name}>
                {row.name}: ${row.netWorth}
                {row.tied ? " (tie)" : ""}
              </li>
            ))}
          </ol>
        </div>
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
