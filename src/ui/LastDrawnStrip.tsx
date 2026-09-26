import type { Card, Company, GameEvent, GameState } from "../engine/types";
import { COMPANY_LABEL } from "../engine/types";
import { lastDrawnView } from "./handVisibility";
import { CompanyMark } from "./CompanyMark";
import { cardEffectRows } from "./cardEffectRows";

function EffectMagnitude({
  row,
}: {
  row: ReturnType<typeof cardEffectRows>[number];
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

function DrawnEffectRows({ card }: { card: Card }) {
  const rows = cardEffectRows(card);
  if (card.kind === "risk") {
    return (
      <ul className="risk-strip play-feed-effects" aria-label="Risk effects">
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
    <ul className="effect-rows play-feed-effects" aria-label="Action effects">
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

function EventRow({ event }: { event: GameEvent }) {
  const company = event.company as Company;
  if (event.type === "split") {
    return (
      <li className="play-feed-event play-feed-event-split">
        <CompanyMark company={company} size="sm" />
        <div className="play-feed-event-body">
          <strong className="play-feed-event-kind">Split</strong>
          <span className="play-feed-event-detail">
            {event.target} → {event.newPrice}
            {event.doubledShares ? " · shares ×2" : ""}
          </span>
        </div>
      </li>
    );
  }
  if (event.type === "wipeout") {
    return (
      <li className="play-feed-event play-feed-event-wipeout">
        <CompanyMark company={company} size="sm" />
        <div className="play-feed-event-body">
          <strong className="play-feed-event-kind">Wipeout</strong>
          <span className="play-feed-event-detail">
            target {event.target} · shares lost · reset $100
          </span>
        </div>
      </li>
    );
  }
  const up = event.to > event.from;
  const down = event.to < event.from;
  return (
    <li className={`play-feed-event ${up ? "pos" : down ? "neg" : ""}`}>
      <CompanyMark company={company} size="sm" />
      <div className="play-feed-event-body">
        <strong className="play-feed-event-kind">{COMPANY_LABEL[company]}</strong>
        <span className="play-feed-event-detail play-feed-price-move">
          ${event.from} → ${event.to}
        </span>
      </div>
    </li>
  );
}

/** Card + price outcomes for the latest play, shown under Holdings. */
export function PlayFeed({ state }: { state: GameState }) {
  const view = lastDrawnView(state);
  const events = state.lastEvents;
  const hasCard = view.visible;
  const hasEvents = events.length > 0;
  if (!hasCard && !hasEvents) return null;

  return (
    <section className="play-feed-panel" aria-live="polite" aria-label="Play feed">
      <div className="section-head">
        <h2>Play feed</h2>
      </div>

      {hasCard ? (
        view.hidden ? (
          <div className="play-feed-card play-feed-card-hidden">
            <span className="play-feed-label">Drawn</span>
            <p className="play-feed-hidden">{view.message}</p>
          </div>
        ) : (
          <div
            className="play-feed-card"
            title={view.card.text}
            aria-label={`Drawn: ${view.card.title}`}
          >
            <span className="play-feed-label">Drawn</span>
            <DrawnEffectRows card={view.card} />
            {view.card.kind === "risk" ? (
              <span className="card-kind play-feed-kind">{view.card.title}</span>
            ) : null}
          </div>
        )
      ) : null}

      {hasEvents ? (
        <div className="play-feed-results">
          <span className="play-feed-label">Market</span>
          <ul className="play-feed-events">
            {events.map((event, index) => (
              <EventRow
                key={`${event.company}-${event.type}-${index}`}
                event={event}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
