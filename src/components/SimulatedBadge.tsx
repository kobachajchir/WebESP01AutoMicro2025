export default function SimulatedBadge({ description }: { description: string }) {
  return (
    <span className="sensor-simulated-badge" title={description} aria-label={`Simulado: ${description}`}>
      <span aria-hidden="true" />
      Simulado
    </span>
  );
}
