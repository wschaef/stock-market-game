import type { Card, Company } from "../engine/types";

export type EffectRow =
  | { kind: "delta"; amount: number; company: Company | null }
  | { kind: "scale"; factor: 2 | 0.5; company: Company | null };

/** One display row per card op (named company or `[?]`). */
export function cardEffectRows(card: Card): EffectRow[] {
  return card.ops.map((op) => {
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
}
