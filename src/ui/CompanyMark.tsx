import type { Company } from "../engine/types";
import { COMPANY_LABEL } from "../engine/types";

const MARK: Record<Company, { short: string; className: string }> = {
  commerzbank: { short: "C", className: "mark-commerzbank" },
  bayer: { short: "By", className: "mark-bayer" },
  bmw: { short: "BMW", className: "mark-bmw" },
  bp: { short: "BP", className: "mark-bp" },
};

export function CompanyMark({
  company,
  size = "md",
}: {
  company: Company
  size?: "sm" | "md" | "lg"
}) {
  const mark = MARK[company];
  return (
    <span
      className={`company-mark ${mark.className} size-${size}`}
      title={COMPANY_LABEL[company]}
      aria-label={COMPANY_LABEL[company]}
    >
      <span className="company-mark-text" aria-hidden="true">
        {mark.short}
      </span>
    </span>
  );
}
