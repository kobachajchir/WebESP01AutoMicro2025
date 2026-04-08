import { useState } from "react";
import PageHeader from "../components/PageHeader";
import { BuilderColumn } from "../features/protocolStudio/components/BuilderColumn";
import { OutputsColumn } from "../features/protocolStudio/components/OutputsColumn";
import { ProtocolHelpModal } from "../features/protocolStudio/components/ProtocolHelpModal";
import { ProtocolHero } from "../features/protocolStudio/components/ProtocolHero";
import { TranslatorColumn } from "../features/protocolStudio/components/TranslatorColumn";
import { useProtocolStudioState } from "../features/protocolStudio/useProtocolStudioState";

export default function ProtocolSection() {
  const studio = useProtocolStudioState();
  const [activeSection, setActiveSection] = useState<"builder" | "translator">("builder");

  function handleValidateInTranslator() {
    setActiveSection("translator");
    studio.loadBuilderToTranslator();
  }

  return (
    <section className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 p-6">
        <PageHeader setOpenInfoModal={studio.setOpenInfoModal} />
        <ProtocolHero activeSection={activeSection} onSectionChange={setActiveSection} />

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

      <ProtocolHelpModal isOpen={studio.openInfoModal} onClose={() => studio.setOpenInfoModal(false)} />
    </section>
  );
}
