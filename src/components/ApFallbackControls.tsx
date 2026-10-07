import type { ApFallbackController } from "../hooks/useApFallback";

export default function ApFallbackControls({ control, disabled = false }: {
  control: ApFallbackController;
  disabled?: boolean;
}) {
  const { policy, pending, connected, toggle, statusText } = control;
  return <button type="button" className="wifi-ap-fallback-toggle"
    data-state={!policy ? "unknown" : policy.enabled ? "enabled" : "disabled"}
    aria-pressed={policy ? policy.enabled : undefined}
    aria-label={policy ? `${policy.enabled ? "Desactivar" : "Activar"} AP fallback` : "AP fallback sin confirmar"}
    title={statusText} disabled={disabled || !connected || pending || !policy}
    onClick={() => { void toggle(); }}>
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0M9 15a5 5 0 0 1 6 0" /><circle cx="12" cy="19" r="1" fill="currentColor" />
    </svg>
    <span>{pending ? "AP fallback · Consultando…" : !policy ? "AP fallback sin confirmar" : `AP fallback ${policy.enabled ? "activado" : "desactivado"}`}</span>
  </button>;
}
