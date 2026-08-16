import type { Company } from "../engine/types";
import { COMPANY_LABEL } from "../engine/types";

const MARK: Record<
  Company,
  { className: string; abbr: string; logo: string; logoTone: "photo" | "glyph" }
> = {
  commerzbank: {
    className: "mark-commerzbank",
    abbr: "CBK",
    logo: "/logos/commerzbank.svg",
    logoTone: "glyph",
  },
  bayer: {
    className: "mark-bayer",
    abbr: "BAYR",
    logo: "/logos/bayer.svg",
    logoTone: "photo",
  },
  bmw: {
    className: "mark-bmw",
    abbr: "BMW",
    logo: "/logos/bmw.svg",
    logoTone: "photo",
  },
  bp: {
    className: "mark-bp",
    abbr: "BP",
    logo: "/logos/bp.svg",
    logoTone: "photo",
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
      className={`company-mark ${mark.className} size-${size} tone-${mark.logoTone}`}
      title={COMPANY_LABEL[company]}
      aria-label={COMPANY_LABEL[company]}
    >
      <img
        className="company-mark-logo"
        src={mark.logo}
        alt=""
        draggable={false}
      />
      <span className="company-mark-fallback" aria-hidden="true">
        {mark.abbr}
      </span>
    </span>
  );
}
