import logo from "../assets/LogoDashboardV2.webp";

export default function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`home-brand-glyph app-brand-mark ${className}`.trim()}>
      <img src={logo} alt="AutoMicro" width={96} height={64} decoding="async" />
    </span>
  );
}
