type StopDiscontinuityGlyphProps = {
  className?: string;
};

export default function StopDiscontinuityGlyph({
  className = "",
}: StopDiscontinuityGlyphProps) {
  return (
    <span
      className={`flex h-8 w-9 flex-col-reverse items-center justify-start gap-1 ${className}`}
      aria-hidden="true"
    >
      <i className="block h-1.5 w-7 rounded-sm border border-current/70 bg-current/35" />
      <i className="block h-1.5 w-5 rounded-sm border border-current/55 bg-current/25" />
      <i className="block h-1.5 w-3 rounded-sm border border-current/45 bg-current/15" />
    </span>
  );
}
