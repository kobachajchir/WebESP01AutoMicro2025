interface ProtocolHeroProps {
  activeSection: "builder" | "translator";
  onSectionChange: (section: "builder" | "translator") => void;
}
export function ProtocolHero({ activeSection, onSectionChange }: ProtocolHeroProps) {
  return (
    <section className="studio-workspace-heading">
      <div><span className="studio-eyebrow">UNER v2</span><h2>Protocol Studio</h2><p>Construye un paquete o interpreta una captura del protocolo.</p></div>
      <nav className="studio-segmented-control" aria-label="Herramientas del protocolo">
        <button type="button" aria-pressed={activeSection === "builder"} onClick={() => onSectionChange("builder")}>Constructor</button>
        <button type="button" aria-pressed={activeSection === "translator"} onClick={() => onSectionChange("translator")}>Traductor</button>
      </nav>
    </section>
  );
}
