/* ==================================================================
   GdgLogo — the only way the official GDG marks enter the DOM.

   Nothing in this component redraws, recolours, skews, rotates or
   animates the artwork. It picks a file and gives it a box with the
   right clear space. See public/brand/gdg/README.md for provenance and
   the usage rules this enforces.

   variant
     "lockup"          full-colour lockup, light backgrounds only
     "lockup-reversed" reversed lockup, for saturated/dark blocks
     "mark"            square official icon, transparent
     "mark-plate"      square icon on a white plate, for colour blocks
   ================================================================== */

export type GdgLogoVariant = "lockup" | "lockup-reversed" | "mark" | "mark-plate";

const SRC: Record<GdgLogoVariant, string> = {
  lockup: "/brand/gdg/gdg-lockup-1line-black.svg",
  "lockup-reversed": "/brand/gdg/gdg-mark-dark.svg",
  mark: "/brand/gdg/icons/icon-192.png",
  "mark-plate": "/brand/gdg/icons/icon-192.png",
};

/** Aspect ratios are baked in so width/height are always explicit. */
const RATIO: Record<GdgLogoVariant, number> = {
  lockup: 3003 / 300,
  "lockup-reversed": 3003 / 300,
  mark: 1,
  "mark-plate": 1,
};

const ALT = "Google Developer Groups";

export default function GdgLogo({
  variant = "lockup",
  size,
  alt,
  className,
  /** Clear space multiplier around the logo, in multiples of its height. */
  clear = 0.25,
}: {
  variant?: GdgLogoVariant;
  /** Width in px for lockups, edge length in px for marks. */
  size: number;
  /** Omit for decorative placements (renders alt="" and aria-hidden). */
  alt?: string;
  className?: string;
  clear?: number;
}) {
  const ratio = RATIO[variant];
  const width = size;
  const height = Math.round(size / ratio);
  const decorative = alt === "";
  const label = decorative ? "" : (alt ?? ALT);
  const pad = Math.round(height * clear);
  const plate = variant === "mark-plate";

  return (
    <span
      className={`gdg-logo${plate ? " gdg-logo-plate" : ""}${className ? ` ${className}` : ""}`}
      style={{
        padding: pad,
        // Exposed so tests and the audit can assert the clear space.
        ["--gdg-clear" as string]: `${pad}px`,
      }}
    >
      <img
        src={SRC[variant]}
        width={width}
        height={height}
        alt={label}
        aria-hidden={decorative ? true : undefined}
        decoding="async"
        draggable={false}
      />
    </span>
  );
}
