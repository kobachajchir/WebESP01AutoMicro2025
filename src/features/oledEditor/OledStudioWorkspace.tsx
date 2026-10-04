import { useCallback, useState } from "react";
import OledCommandPreview from "../../components/OledCommandPreview";
import { useSavedOledScreens } from "../../contexts/SavedOledScreensContext";
import LopakaLikeEditor from "./LopakaLikeEditor";
import OledCanvasTransferPanel from "./OledCanvasTransferPanel";
import { cloneDocument, createEmptyDocument } from "./document";
import type { EditorDocument } from "./types";

type OledStudioTab = "visualization" | "code" | "stream";

const OLED_STUDIO_TABS: ReadonlyArray<{
 id: OledStudioTab;
 label: string;
}> = [
 { id: "visualization", label: "Visualización" },
 { id: "code", label: "Código" },
 { id: "stream", label: "Enviar al OLED" },
];

export default function OledStudioWorkspace() {
 const { savedScreens, saveScreen, deleteScreen } = useSavedOledScreens();
 const [savedScreensOpen, setSavedScreensOpen] = useState(false);
 const [editorKey, setEditorKey] = useState(0);
 const [editorSeed, setEditorSeed] = useState<EditorDocument>(() =>
 createEmptyDocument(),
 );
 const [liveDocument, setLiveDocument] = useState<EditorDocument>(() =>
 createEmptyDocument(),
 );
 const [loadedScreenId, setLoadedScreenId] = useState<string | null>(null);
 const [activeTab, setActiveTab] = useState<OledStudioTab>("visualization");

 const handleDocumentChange = useCallback((document: EditorDocument) => {
 setLiveDocument(cloneDocument(document));
 }, []);

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
 setLiveDocument(cloneDocument(screen.document));
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

 const emptyDocument = createEmptyDocument();
 setEditorSeed(cloneDocument(emptyDocument));
 setLiveDocument(cloneDocument(emptyDocument));
 setEditorKey((current) => current + 1);
 };

 return (
 <div className="oled-studio-workspace flex flex-col gap-6">
 <div className="app-panel rounded-lg p-4">
 <div className="flex flex-wrap items-center justify-between gap-3">
 <div>
 <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ui-muted)]">
 Pantallas guardadas ({savedScreens.length})
 </div>
 </div>

 <button
 type="button"
 onClick={() => setSavedScreensOpen((current) => !current)}
 aria-label={savedScreensOpen ? "Cerrar pantallas guardadas" : "Abrir pantallas guardadas"}
 aria-expanded={savedScreensOpen}
 className="oled-saved-toggle flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
 >
 <span>{savedScreensOpen ? "Cerrar galería" : "Abrir galería"}</span>
 <ChevronToggleIcon open={savedScreensOpen} />
 </button>
 </div>

 {savedScreensOpen ? (
 savedScreens.length > 0 ? (
 <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
 {savedScreens.map((screen) => (
 <article
 key={screen.id}
 className="group relative overflow-hidden rounded-lg border border-[var(--ui-ring)] bg-[var(--ui-panel)] p-3"
 >
 <div className="mb-3 flex items-start justify-between gap-3">
 <div>
 <h3 className="text-sm font-bold text-[var(--ui-text)]">
 {screen.title}
 </h3>
 <p className="text-xs text-[var(--ui-muted)]">
 {new Date(screen.updatedAt).toLocaleString("es-AR")}
 </p>
 </div>
 {loadedScreenId === screen.id ? (
 <span className="oled-saved-active rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]">
 Activa
 </span>
 ) : null}
 </div>

 <div className="rounded-lg border border-[var(--ui-ring)] bg-[var(--ui-panel-strong)] p-2">
 <OledCommandPreview
 commands={screen.commands}
 className="mx-auto max-w-[320px]"
 />
 </div>

 <div className="oled-saved-overlay pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
 <div className="flex gap-3">
 <button
 type="button"
 onClick={() => handleLoadScreen(screen.id)}
 className="oled-saved-action rounded-lg px-4 py-2 text-sm font-semibold"
 >
 Cargar
 </button>
 <button
 type="button"
 onClick={() => handleDeleteScreen(screen.id)}
 className="oled-saved-action oled-saved-action--danger rounded-lg px-4 py-2 text-sm font-semibold"
 >
 Eliminar
 </button>
 </div>
 </div>
 </article>
 ))}
 </div>
 ) : (
 <div className="mt-4 rounded-lg border border-dashed border-[var(--ui-ring)] bg-[var(--ui-panel)] px-4 py-5 text-sm text-[var(--ui-muted)]">
 Todavía no hay pantallas guardadas. Diseña una pantalla y guárdala desde la barra de herramientas para verla aquí.
 </div>
 )
 ) : null}
 </div>

 <div className="app-panel-strong flex flex-col rounded-lg p-4">
 <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--ui-ring)] pb-4">
 <div
 role="tablist"
 aria-label="Secciones de OLED Studio"
 className="oled-studio-tablist"
 onKeyDown={(event) => {
   const index = OLED_STUDIO_TABS.findIndex(tab => tab.id === activeTab);
   const next = event.key === "ArrowRight" ? (index + 1) % OLED_STUDIO_TABS.length
     : event.key === "ArrowLeft" ? (index + OLED_STUDIO_TABS.length - 1) % OLED_STUDIO_TABS.length
     : event.key === "Home" ? 0 : event.key === "End" ? OLED_STUDIO_TABS.length - 1 : null;
   if (next === null) return;
   event.preventDefault();
   const tab = OLED_STUDIO_TABS[next];
   setActiveTab(tab.id);
   document.getElementById(`oled-studio-${tab.id}-tab`)?.focus();
 }}
 >
 {OLED_STUDIO_TABS.map((tab) => {
 const selected = activeTab === tab.id;
 const controls = tab.id === "stream"
 ? "oled-studio-stream-panel"
 : "oled-studio-editor-panel";

 return (
 <button
 key={tab.id}
 id={`oled-studio-${tab.id}-tab`}
 type="button"
 role="tab"
 aria-selected={selected}
 aria-controls={controls}
 tabIndex={selected ? 0 : -1}
 onClick={() => setActiveTab(tab.id)}
 className={`min-w-32 rounded-xl px-5 py-2.5 text-sm font-bold transition ${
 selected
 ? "oled-studio-tab--active"
 : "text-[var(--ui-muted)] hover:bg-[var(--ui-panel)] hover:text-[var(--ui-text)]"
 }`}
 >
 {tab.label}
 </button>
 );
 })}
 </div>

 <div className="flex flex-wrap items-center gap-2">
 {loadedScreenId ? (
 <span className="oled-saved-active rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
 Editando guardada
 </span>
 ) : null}
 <span className="rounded-full border border-[var(--ui-ring)] bg-[var(--ui-panel)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ui-muted)]">
 128x64 SSD1306
 </span>
 </div>
 </div>

 <div className="oled-studio-content">
 <div
 id="oled-studio-editor-panel"
 role="tabpanel"
 aria-labelledby={`oled-studio-${activeTab}-tab`}
 hidden={activeTab === "stream"}
 >
 <LopakaLikeEditor
 key={editorKey}
 activeView={activeTab === "code" ? "code" : "visualization"}
 initialDocument={editorSeed}
 onDocumentChange={handleDocumentChange}
 onSaveDocument={handleSaveDocument}
 onClearDocument={handleClearDocument}
 />
 </div>

 <div
 id="oled-studio-stream-panel"
 role="tabpanel"
 aria-labelledby="oled-studio-stream-tab"
 hidden={activeTab !== "stream"}
 >
 <OledCanvasTransferPanel document={liveDocument} />
 </div>
 </div>
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
