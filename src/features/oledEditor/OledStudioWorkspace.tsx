import { useState } from "react";
import OledCommandPreview from "../../components/OledCommandPreview";
import { useSavedOledScreens } from "../../contexts/SavedOledScreensContext";
import LopakaLikeEditor from "./LopakaLikeEditor";
import { cloneDocument, createEmptyDocument } from "./document";
import type { EditorDocument } from "./types";

export default function OledStudioWorkspace() {
  const { savedScreens, saveScreen, deleteScreen } = useSavedOledScreens();
  const [savedScreensOpen, setSavedScreensOpen] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [editorSeed, setEditorSeed] = useState<EditorDocument>(() =>
    createEmptyDocument(),
  );
  const [loadedScreenId, setLoadedScreenId] = useState<string | null>(null);

  const handleSaveDocument = (document: EditorDocument) => {
    const nextId = saveScreen({
      id: loadedScreenId ?? undefined,
      document,
    });
    setLoadedScreenId(nextId);
  };

  const handleLoadScreen = (screenId: string) => {
    const screen = savedScreens.find((entry) => entry.id === screenId);
    if (!screen) {
      return;
    }

    setEditorSeed(cloneDocument(screen.document));
    setLoadedScreenId(screen.id);
    setEditorKey((current) => current + 1);
  };

  const handleDeleteScreen = (screenId: string) => {
    deleteScreen(screenId);
    if (loadedScreenId === screenId) {
      setLoadedScreenId(null);
    }
  };

  const handleClearDocument = () => {
    if (loadedScreenId) {
      setLoadedScreenId(null);
      return;
    }

    setEditorSeed(cloneDocument(createEmptyDocument()));
    setEditorKey((current) => current + 1);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[28px] border border-white/10 bg-slate-950/35 p-4 shadow-[0_28px_80px_rgba(2,6,23,0.45)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Pantallas guardadas ({savedScreens.length})
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSavedScreensOpen((current) => !current)}
            className="flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-400/15"
          >
            <ChevronToggleIcon open={savedScreensOpen} />
          </button>
        </div>

        {savedScreensOpen ? (
          savedScreens.length > 0 ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {savedScreens.map((screen) => (
                <article
                  key={screen.id}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50 p-3"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        {screen.title}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {new Date(screen.updatedAt).toLocaleString("es-AR")}
                      </p>
                    </div>
                    {loadedScreenId === screen.id ? (
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
                        Activa
                      </span>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-cyan-300/15 bg-slate-950/80 p-2">
                    <OledCommandPreview
                      commands={screen.commands}
                      className="mx-auto max-w-[320px]"
                    />
                  </div>

                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/78 opacity-0 transition duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleLoadScreen(screen.id)}
                        className="rounded-md border border-cyan-300/70 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400 hover:text-slate-950"
                      >
                        Cargar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteScreen(screen.id)}
                        className="rounded-md border border-rose-400/70 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500 hover:text-white"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-slate-950/35 px-4 py-5 text-sm text-slate-400">
              Todavia no hay pantallas guardadas. Usa el icono de guardar del
              editor para empezar a poblar la galeria.
            </div>
          )
        ) : null}
      </div>

      <div className="rounded-[32px] border border-white/10 bg-slate-950/30 p-4 shadow-[0_28px_80px_rgba(2,6,23,0.55)] backdrop-blur flex flex-col">
        <div className="flex flex-row items-center gap-2 flex-wrap">
          <h3 className="text-xl font-black text-white py-3">Visualizacion</h3>
          {loadedScreenId ? (
            <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
              Editando guardada
            </span>
          ) : null}
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            128x64 SSD1306
          </span>
        </div>
        <LopakaLikeEditor
          key={editorKey}
          initialDocument={editorSeed}
          onSaveDocument={handleSaveDocument}
          onClearDocument={handleClearDocument}
        />
      </div>
    </div>
  );
}

function ChevronToggleIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4 transition-transform duration-200"
      style={{
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
      }}
    >
      <path
        d="M6 8l4 4 4-4"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
