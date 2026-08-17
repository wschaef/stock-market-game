import { useEffect, useRef, useState, type ReactNode } from "react";

export function FlashOnChange({
  value,
  className = "",
  children,
}: {
  value: string | number
  className?: string
  children: ReactNode
}) {
  const previous = useRef(value);
  const [tone, setTone] = useState<"pos" | "neg" | "">("");

  useEffect(() => {
    if (previous.current === value) return;
    let next: "pos" | "neg" | "" = "";
    if (typeof value === "number" && typeof previous.current === "number") {
      next = value > previous.current ? "pos" : "neg";
    } else {
      next = "pos";
    }
    previous.current = value;
    setTone(next);
  }, [value]);

  return (
    <span
      className={[className, tone ? `value-flash value-flash-${tone}` : ""]
        .filter(Boolean)
        .join(" ")}
      onAnimationEnd={() => setTone("")}
    >
      {children}
    </span>
  );
}
