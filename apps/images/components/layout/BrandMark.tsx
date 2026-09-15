type BrandMarkProps = { size?: number; className?: string };

export function BrandMark({ size = 40, className = "" }: BrandMarkProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="UtilFoundry mark" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="16" fill="#111c3d" />
      <path d="M19 18V33C19 41.8 24.4 47 32 47C39.6 47 45 41.8 45 33V18" fill="none" stroke="#f9a870" strokeWidth="5" strokeLinecap="round" />
      <path d="M17 52H47" fill="none" stroke="#f9a870" strokeWidth="5" strokeLinecap="round" />
      <path d="M49 10L51.4 15.6L57 18L51.4 20.4L49 26L46.6 20.4L41 18L46.6 15.6L49 10Z" fill="#f9a870" />
    </svg>
  );
}
