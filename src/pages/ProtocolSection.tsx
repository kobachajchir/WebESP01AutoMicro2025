import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Modal from "../components/modal";
import PageHeader from "../components/PageHeader";
import OledStudioWorkspace from "../features/oledEditor/OledStudioWorkspace";
import { BuilderColumn } from "../features/protocolStudio/components/BuilderColumn";
import { OutputsColumn } from "../features/protocolStudio/components/OutputsColumn";
import { ProtocolHelpModal } from "../features/protocolStudio/components/ProtocolHelpModal";
import { ProtocolHero } from "../features/protocolStudio/components/ProtocolHero";
import { TranslatorColumn } from "../features/protocolStudio/components/TranslatorColumn";
import { useProtocolStudioState } from "../features/protocolStudio/useProtocolStudioState";

type StudioView = "protocol" | "oled";

const SEGMENTED_TOGGLE_BUTTON_CLASS =
  "protocol-studio-toggle min-w-[140px] rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40";

export default function ProtocolSection() {
  const studio = useProtocolStudioState();
  const [searchParams, setSearchParams] = useSearchParams();
  const [openOledInfoModal, setOpenOledInfoModal] = useState(false);
  const [activeSection, setActiveSection] = useState<"builder" | "translator">(
    "builder",
  );
  const activeStudio: StudioView =
    searchParams.get("studio") === "oled" ? "oled" : "protocol";

  function handleValidateInTranslator() {
    setActiveSection("translator");
    studio.loadBuilderToTranslator();
  }

  function handleStudioChange(nextStudio: StudioView) {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (nextStudio === "protocol") {
      nextSearchParams.delete("studio");
    } else {
      nextSearchParams.set("studio", nextStudio);
    }

    setSearchParams(nextSearchParams, { replace: true });
  }

  return (
    <section className="protocol-dashboard-shell min-h-screen w-full text-slate-100">
      <div className="protocol-dashboard-frame mx-auto flex w-full max-w-[1900px] flex-col gap-6 p-6">
        <PageHeader
          className="app-page-header home-page-header"
          titleOverride="UNER Studio"
          setOpenInfoModal={
            activeStudio === "protocol"
              ? studio.setOpenInfoModal
              : setOpenOledInfoModal
          }
        />

        <div className="relative pt-7">
          <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2">
            <div className="protocol-studio-switcher pointer-events-auto flex items-center gap-1 rounded-full p-1">
              <button
                type="button"
                className={SEGMENTED_TOGGLE_BUTTON_CLASS}
                style={segmentedButtonStyle(activeStudio === "protocol")}
                onClick={() => handleStudioChange("protocol")}
              >
                Protocol Studio
              </button>
              <button
                type="button"
                className={SEGMENTED_TOGGLE_BUTTON_CLASS}
                style={segmentedButtonStyle(activeStudio === "oled")}
                onClick={() => handleStudioChange("oled")}
              >
                OLED Studio
              </button>
            </div>
          </div>

          <div className="protocol-studio-card app-panel-strong relative overflow-hidden px-5 pb-6 pt-14 md:px-7">
            {activeStudio === "protocol" ? (
              <div className="flex flex-col gap-6">
                <ProtocolHero
                  activeSection={activeSection}
                  onSectionChange={setActiveSection}
                />

                {activeSection === "builder" ? (
                  <div className="grid gap-6 xl:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)]">
                    <BuilderColumn
                      source={studio.source}
                      destination={studio.destination}
                      commandKey={studio.commandKey}
                      currentCommand={studio.currentCommand}
                      fieldValues={studio.fieldValues}
                      nonHexFields={studio.nonHexFields}
                      hexFields={studio.hexFields}
                      manualPayload={studio.manualPayload}
                      onSourceChange={studio.setSource}
                      onDestinationChange={studio.setDestination}
                      onCommandChange={studio.setCommandKey}
                      onFieldValueChange={studio.setFieldValue}
                      onManualPayloadChange={studio.setManualPayload}
                    />

                    <OutputsColumn
                      builderData={studio.builderState.data}
                      builderError={studio.builderState.error}
                      commandKey={studio.commandKey}
                      currentCommand={studio.currentCommand}
                      outputs={studio.outputs}
                      flashMessage={studio.flashMessage}
                      onCopyOutput={studio.copyOutput}
                      onValidateInTranslator={handleValidateInTranslator}
                    />
                  </div>
                ) : (
                  <div className="mx-auto w-full max-w-[1500px]">
                    <TranslatorColumn
                      translatorInput={studio.translatorInput}
                      translation={studio.translation}
                      scanResult={studio.scanResult}
                      translatorStatus={studio.translatorStatus}
                      scanResultsPlaceholder={studio.scanResultsPlaceholder}
                      streamPlaceholder={studio.streamPlaceholder}
                      streamSegments={studio.streamSegments}
                      onTranslatorInputChange={studio.setTranslatorInput}
                      onTranslate={() => studio.handleTranslate()}
                      onLoadBuilderToTranslator={studio.loadBuilderToTranslator}
                      onResetTranslator={studio.resetTranslator}
                    />
                  </div>
                )}
              </div>
            ) : (
              <OledStudioWorkspace />
            )}
          </div>
        </div>
      </div>

      <ProtocolHelpModal
        isOpen={studio.openInfoModal}
        onClose={() => studio.setOpenInfoModal(false)}
      />

      {openOledInfoModal ? (
        <Modal
          isOpen={openOledInfoModal}
          onClose={() => setOpenOledInfoModal(false)}
          closeOnOverlayClick={false}
        >
          <div className="flex flex-col gap-4">
            <div>
              <div className="app-kicker mb-3">Info</div>
              <h2 className="text-2xl font-black text-white">
                OLED Studio
              </h2>
            </div>

            <p className="text-sm leading-relaxed text-slate-300">
              Este espacio concentra el editor de pantallas OLED 128x64 dentro de
              UNER Studio. Desde aca puedes dibujar, maquetar, guardar pantallas
              en contexto y reutilizarlas despues en el visualizador global.
            </p>

            <ul className="space-y-2 text-sm text-slate-300">
              <li>
                <span className="font-semibold text-white">Galeria:</span> el
                dropdown superior muestra las pantallas guardadas y permite
                cargarlas o eliminarlas.
              </li>
              <li>
                <span className="font-semibold text-white">Editor:</span> el
                lienzo replica el flujo estilo Lopaka con herramientas,
                inspector, capas y preview fiel a 128x64.
              </li>
              <li>
                <span className="font-semibold text-white">Persistencia:</span>{" "}
                el boton de guardar actualiza el contexto compartido para poder
                reutilizar esas pantallas en otras partes de la app.
              </li>
              <li>
                <span className="font-semibold text-white">Integracion:</span>{" "}
                las pantallas guardadas ya aparecen tambien en la preview global
                del stream OLED y quedan listas para mockear su envio.
              </li>
            </ul>

            <div className="rounded-md border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
              <p className="m-0">
                <span className="font-semibold text-white">Tip:</span> el flujo
                mas comun es disenar, guardar, volver a cargar y luego probar el
                envio desde el visualizador global sin salir de UNER Studio.
              </p>
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

function segmentedButtonStyle(active: boolean) {
  return active
    ? {
        background: "var(--ui-accent)",
        color: "var(--ui-action-hover-ink)",
        boxShadow: "0 12px 28px rgba(34,211,238,0.28)",
      }
    : {
        background: "transparent",
        color: "var(--ui-text)",
      };
}
