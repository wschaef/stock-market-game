import type { Card, GameState } from "../engine/types";
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
      <ul className="risk-strip last-drawn-effects" aria-label="Risk effects">
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
    <ul className="effect-rows last-drawn-effects" aria-label="Action effects">
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

export function LastDrawnStrip({ state }: { state: GameState }) {
  const view = lastDrawnView(state);
  if (!view.visible) return null;

  if (view.hidden) {
    return (
      <section className="last-drawn-panel last-drawn-panel-hidden" aria-live="polite">
        <span className="last-drawn-label">Last drawn</span>
        <p className="last-drawn-hidden">{view.message}</p>
      </section>
    );
  }

  const { card } = view;
  return (
    <section
      className="last-drawn-panel"
      aria-live="polite"
      aria-label={`Last drawn: ${card.title}`}
      title={card.text}
    >
      <span className="last-drawn-label">Last drawn</span>
      <DrawnEffectRows card={card} />
      <span className="card-kind last-drawn-kind">
        {card.kind === "risk" ? card.title : card.kind}
      </span>
    </section>
  );
}
