/** Small inline glyphs for the option tiles, drawn to match the reference exactly. */

type GlyphProps = { size?: number };

function Box({ size = 22, dash, width = 1.8, rx = 2, round = false }: GlyphProps & { dash?: string; width?: number; rx?: number; round?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx={rx} stroke="currentColor" strokeWidth={width} strokeDasharray={dash} strokeLinecap={round ? "round" : "butt"} />
    </svg>
  );
}

export const SolidBox = (props: GlyphProps) => <Box {...props} />;
export const DashedBox = (props: GlyphProps) => <Box {...props} dash="4 3" />;
export const DottedBox = (props: GlyphProps) => <Box {...props} dash="0.01 3.6" width={2.4} round />;

export function DoubleBox({ size = 22 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="5.5" y="5.5" width="13" height="13" rx="1.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export const SquareCorner = (props: GlyphProps) => <Box {...props} rx={0} />;
export const RoundedCorner = (props: GlyphProps) => <Box {...props} rx={6} />;

export function CircleCorner({ size = 22 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function TopCorners({ size = 22 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3.5 20.5V9.5a6 6 0 0 1 6-6h5a6 6 0 0 1 6 6v11" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 20.5h17" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function BottomCorners({ size = 22 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M20.5 3.5v11a6 6 0 0 1-6 6h-5a6 6 0 0 1-6-6v-11" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 3.5h17" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function CustomCorners({ size = 22 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3.5 9.5a6 6 0 0 1 6-6h11v11a6 6 0 0 1-6 6h-11v-11Z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/** A tiny mountain thumbnail, tinted to hint at each grayscale conversion mode. */
export function PhotoSwatch({ size = 26, from, to }: GlyphProps & { from: string; to: string }) {
  const id = `sw-${from.replace(/[^a-z0-9]/gi, "")}-${to.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width={size} height={size * 0.78} viewBox="0 0 32 25" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="32" height="25" rx="3" fill={`url(#${id})`} />
      <path d="M4 20l7.5-9 5 6 4-4.5L28 20H4Z" fill="rgba(255,255,255,.82)" />
      <circle cx="9" cy="7" r="2.4" fill="rgba(255,255,255,.9)" />
    </svg>
  );
}

export function PortraitPage({ size = 20 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="6.5" y="3" width="11" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function LandscapePage({ size = 20 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="6.5" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
