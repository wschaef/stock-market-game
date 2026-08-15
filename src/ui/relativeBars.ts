import { COMPANIES, type Company } from "../engine";

/** Percent widths (0–100) so the highest price fills the diagram. */
export function relativeBarPercents(
  prices: Record<Company, number>,
): Record<Company, number> {
  const max = Math.max(...COMPANIES.map((company) => prices[company]));
  if (max <= 0) {
    return Object.fromEntries(COMPANIES.map((company) => [company, 0])) as Record<
      Company,
      number
    >;
  }
  return Object.fromEntries(
    COMPANIES.map((company) => [company, (prices[company] / max) * 100]),
  ) as Record<Company, number>;
}
