interface ProtocolHeroProps {
  activeSection: "builder" | "translator";
  onSectionChange: (section: "builder" | "translator") => void;
}

export function ProtocolHero({ activeSection, onSectionChange }: ProtocolHeroProps) {
  return (
    <section className="app-panel overflow-hidden p-4">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-4">
          <div className="app-kicker">
            UNER v2
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black uppercase tracking-tight text-white md:text-4xl">
              Creador y analizador del protocolo
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
              Alterna entre la creacion del comando y el traductor con escaneo de bloques. Puedes construir un frame, copiarlo o enviarlo a validar sin salir de la seccion.
            </p>
          </div>
        </div>

        <nav className="app-panel-strong flex w-full flex-col gap-3 p-3 xl:w-auto xl:min-w-[26rem]">
          <div className="text-[10px] uppercase tracking-[0.24em] text-slate-200">Navegacion interna</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onSectionChange("builder")}
              className={`rounded-2xl border px-4 py-3 text-left transition-all duration-300 ${
                activeSection === "builder"
                  ? "border-cyan-400/40 bg-cyan-500/15 text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,0.2)]"
                  : "border-white/10 bg-slate-950/50 text-slate-300 hover:border-cyan-400/30 hover:text-white"
              }`}
            >
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-200">Crear comando</div>
              <div className="mt-2 text-lg font-bold text-cyan-200">Builder</div>
              <p className="mt-2 text-sm text-slate-400">Arma el frame, revisa checksum y prepara las salidas para copiar o validar.</p>
            </button>

            <button
              type="button"
              onClick={() => onSectionChange("translator")}
              className={`rounded-2xl border px-4 py-3 text-left transition-all duration-300 ${
                activeSection === "translator"
                  ? "border-violet-400/40 bg-violet-500/15 text-white shadow-[inset_0_0_0_1px_rgba(167,139,250,0.2)]"
                  : "border-white/10 bg-slate-950/50 text-slate-300 hover:border-violet-400/30 hover:text-white"
              }`}
            >
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-200">Traducir y escanear</div>
              <div className="mt-2 text-lg font-bold text-violet-200">Traductor + Escaner</div>
              <p className="mt-2 text-sm text-slate-400">Pega frames, arrays o bloques completos para validar, interpretar y separar bytes fuera de frame.</p>
            </button>
          </div>
        </nav>
      </div>
    </section>
  );
}
