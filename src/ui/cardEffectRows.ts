import type { Card, Company } from "../engine/types";

export type EffectRow =
  | { kind: "delta"; amount: number; company: Company | null }
  | { kind: "scale"; factor: 2 | 0.5; company: Company | null };

function rowRank(row: EffectRow): number {
  if (row.kind === "delta") {
    // Positive first (higher amount ranks earlier), then negatives.
    return -row.amount;
  }
  // 2× before ½
  return row.factor === 2 ? -1 : 1;
}

/** One display row per card op (named company or `[?]`), positives first. */
export function cardEffectRows(card: Card): EffectRow[] {
  const rows = card.ops.map((op): EffectRow => {
    if (op.type === "delta") {
      return { kind: "delta", amount: op.amount, company: op.company };
    }
    if (op.type === "scale") {
      return { kind: "scale", factor: op.factor, company: op.company };
    }
    if (op.type === "deltaChoice") {
      return { kind: "delta", amount: op.amount, company: null };
    }
    return { kind: "scale", factor: op.factor, company: null };
  });
  return [...rows].sort((a, b) => rowRank(a) - rowRank(b));
}
