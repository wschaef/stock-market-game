import {
  COMPANIES,
  COMPANY_LABEL,
  type Card,
  type Company,
  type NamedOp,
} from "./types";

function buildActionCards(): Card[] {
  const cards: Card[] = [];

  for (const company of COMPANIES) {
    const label = COMPANY_LABEL[company];
    for (const plus of [30, 40, 50, 60] as const) {
      const minus = 90 - plus;
      cards.push({
        id: `std-${company}-p${plus}`,
        kind: "action",
        title: `+${plus} ${label} / -${minus} [?]`,
        text: `${label} rises by ${plus}. Choose another company to fall by ${minus}.`,
        ops: [
          { type: "delta", company, amount: plus },
          { type: "deltaChoice", amount: -minus },
        ],
      });
      cards.push({
        id: `std-${company}-m${plus}`,
        kind: "action",
        title: `-${plus} ${label} / +${minus} [?]`,
        text: `${label} falls by ${plus}. Choose another company to rise by ${minus}.`,
        ops: [
          { type: "delta", company, amount: -plus },
          { type: "deltaChoice", amount: minus },
        ],
      });
    }

    cards.push({
      id: `mul-${company}-2x`,
      kind: "action",
      title: `2× ${label} / ½ [?]`,
      text: `${label} price doubles. Choose another company to halve.`,
      ops: [
        { type: "scale", company, factor: 2 },
        { type: "scaleChoice", factor: 0.5 },
      ],
    });
    cards.push({
      id: `mul-${company}-half`,
      kind: "action",
      title: `½ ${label} / 2× [?]`,
      text: `${label} price halves. Choose another company to double.`,
      ops: [
        { type: "scale", company, factor: 0.5 },
        { type: "scaleChoice", factor: 2 },
      ],
    });

    for (const copy of [1, 2] as const) {
      cards.push({
        id: `p100-${company}-${copy}`,
        kind: "action",
        title: `+100 ${label} | −10/−20/−30 [?]`,
        text: `${label} jumps +100. Assign −10, −20, and −30 to the other three companies (each once).`,
        ops: [
          { type: "delta", company, amount: 100 },
          { type: "deltaChoice", amount: -10 },
          { type: "deltaChoice", amount: -20 },
          { type: "deltaChoice", amount: -30 },
        ],
      });
    }
  }

  return cards;
}

const RISK_SPECS: Array<{
  n: number
  deltas: Partial<Record<Company, number>>
  text: string
}> = [
  {
    n: 1,
    deltas: { commerzbank: 40, bayer: 20, bmw: -20, bp: -20 },
    text: "The domestic economy shows encouraging trends. However, the export economy suffers from exchange rate changes. Currency significantly revalued.",
  },
  {
    n: 2,
    deltas: { commerzbank: 50, bayer: 80, bmw: 20, bp: -20 },
    text: "Inflation among trading partner countries shows clear upward trends. Threat of uncontrollable inflation compared to foreign markets.",
  },
  {
    n: 3,
    deltas: { commerzbank: 40, bayer: 50, bp: -90, bmw: -90 },
    text: "Consequences of manifold international power crises. Events of unpredictable magnitude with completely uncertain outcomes.",
  },
  {
    n: 4,
    deltas: { commerzbank: -50, bayer: 20, bp: 10, bmw: 60 },
    text: "The value of the $ falls against all major currencies. Export goods become slightly more expensive. Sales rise for companies in the export region.",
  },
  {
    n: 5,
    deltas: { commerzbank: -30, bayer: -20, bmw: -20, bp: -30 },
    text: "Public sector borrowing increases sharply. Credit institutions tighten loan terms for industrial companies, making profit reinvestment harder.",
  },
  {
    n: 6,
    deltas: { commerzbank: 40, bayer: 60, bmw: 20, bp: -70 },
    text: "Recent economic figures show no signs of recovery.",
  },
  {
    n: 7,
    deltas: { commerzbank: 60, bayer: 60, bmw: 40, bp: -20 },
    text: "Domestic companies benefit from tax relief. Generates solid earnings and satisfying dividends.",
  },
  {
    n: 8,
    deltas: { bp: 80, bayer: 80, bmw: 60, commerzbank: -60 },
    text: "Bayer presents a groundbreaking new development for the automotive industry to the public.",
  },
  {
    n: 9,
    deltas: { commerzbank: 80, bp: 50, bayer: 50, bmw: 50 },
    text: "BMW announces the expansion of its location network in Europe.",
  },
  {
    n: 10,
    deltas: { commerzbank: -10, bp: -10, bayer: 50, bmw: -80 },
    text: "During an industry crisis, double taxation on shares for an automotive company is halted.",
  },
  {
    n: 11,
    deltas: { commerzbank: -20, bayer: -50 },
    text: "The value of the $ rises against all major trading partner currencies, making export goods more expensive for foreign markets.",
  },
  {
    n: 12,
    deltas: { commerzbank: 80, bayer: 80 },
    text: "Commerzbank announces a capital increase with highly favorable subscription rights.",
  },
  {
    n: 13,
    deltas: { commerzbank: -50, bayer: -90, bp: 60, bmw: -60 },
    text: "Oil-exporting countries decide on a significant price increase.",
  },
  {
    n: 14,
    deltas: { bp: 90, bayer: 90, bmw: 90, commerzbank: 90 },
    text: "A peace treaty is finally signed in a severe military conflict.",
  },
  {
    n: 15,
    deltas: { commerzbank: -80, bayer: -80, bp: -80, bmw: -80 },
    text: "Increasing capacity utilization with low returns. Operational changes lead to an unproductive investment period.",
  },
];

function buildRiskCards(): Card[] {
  return RISK_SPECS.map((spec) => ({
    id: `risk-${spec.n}`,
    kind: "risk" as const,
    title: `Risk ${spec.n}`,
    text: spec.text,
    ops: COMPANIES.filter((c) => spec.deltas[c] !== undefined).map(
      (company) =>
        ({
          type: "delta" as const,
          company,
          amount: spec.deltas[company] as number,
        }) satisfies NamedOp,
    ),
  }));
}

export const ACTION_CARDS: Card[] = buildActionCards();
export const RISK_CARDS: Card[] = buildRiskCards();
export const ALL_CARDS: Card[] = [...ACTION_CARDS, ...RISK_CARDS];

export function cardById(id: string): Card {
  const card = ALL_CARDS.find((c) => c.id === id);
  if (!card) throw new Error(`Unknown card: ${id}`);
  return card;
}
