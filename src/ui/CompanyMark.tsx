import type { Company } from "../engine/types";
import { COMPANY_LABEL } from "../engine/types";
import logoBayer from "../assets/logos/bayer.svg";
import logoBmw from "../assets/logos/bmw.svg";
import logoBp from "../assets/logos/bp.svg";
import logoCommerzbank from "../assets/logos/commerzbank.svg";

const MARK: Record<
  Company,
  { className: string; abbr: string; logo: string }
> = {
  commerzbank: {
    className: "mark-commerzbank",
    abbr: "CBK",
    logo: logoCommerzbank,
  },
  bayer: {
    className: "mark-bayer",
    abbr: "BAYR",
    logo: logoBayer,
  },
  bmw: {
    className: "mark-bmw",
    abbr: "BMW",
    logo: logoBmw,
  },
  bp: {
    className: "mark-bp",
    abbr: "BP",
    logo: logoBp,
  },
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
      <img
        className="company-mark-logo"
        src={mark.logo}
        alt=""
        draggable={false}
      />
    </span>
  );
}
