import { useRef, useState } from "react";
import ThreeModelViewer from "../components/ThreeModelViewer";
import OrientationControls from "../components/OrientationControls";
import type { CameraRigHandle, PresetKey } from "../components/CameraRig";
import CameraRig from "../components/CameraRig";
import CameraPresetsPanel from "../components/CameraPresetsPanel";
import ToggleButton from "../components/toggleButton";
import PageHeader from "../components/PageHeader";
import RealtimeEulerPanel from "../components/RealTimeEulerPanel";
import MockEulerGenerator from "../components/MockEulerGenerator";

export default function EstadoSection() {
  // @ts-ignore
  const [e, setE] = useState({ yaw: 0, pitch: 0, roll: 0 });
  const [mockActive, setMockActive] = useState(true);
  const [mockMs, setMockMs] = useState(120);
  const base = import.meta.env.BASE_URL || "/";

  const rigRef = useRef<CameraRigHandle>(null);
  function handlePick(k: PresetKey) {
    setE({ yaw: 0, pitch: 0, roll: 0 });
    rigRef.current?.goTo(k);
  }

  const [isEmu, setIsEmu] = useState(false);

  return (
    <section
      data-active="true"
      className="min-h-screen w-full
                 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100
                 transition-[opacity,transform] duration-300
                 data-[active=true]:opacity-100 data-[active=true]:translate-y-0
                 data-[active=false]:opacity-0 data-[active=false]:translate-y-2"
    >
      <div className="flex flex-col gap-4 p-6 w-full mx-auto max-w-7xl">
        <PageHeader
          setOpenSettingsModal={() => {}}
          setOpenInfoModal={() => {}}
        />

        <div className="flex flex-col lg:flex-row gap-6 w-full h-[calc(100vh-7rem)] items-stretch justify-stretch">
          {/* Viewer */}
          <div
            className="order-2 lg:order-1 flex flex-col w-full h-1/2 lg:w-2/3 lg:h-full
                       rounded-2xl overflow-hidden shadow-sm backdrop-blur
                       transition-shadow duration-300 hover:shadow-md items-center justify-center"
          >
            {/* Presets de cámara (si usás este panel) */}
            <div
              className={
                mockActive ? "w-full opacity-50 pointer-events-none" : "w-full"
              }
            >
              <div
                className="w-full rounded-2xl shadow-sm backdrop-blur p-4
                          transition-[opacity,transform] duration-300
                          data-[state=open]:opacity-100 data-[state=open]:translate-y-0 data-[state=open]:scale-100
                          data-[state=closed]:opacity-0 data-[state=closed]:translate-y-2 data-[state=closed]:scale-95"
                data-state="open"
              >
                <CameraPresetsPanel onPick={handlePick} />
              </div>
            </div>
            <ThreeModelViewer
              modelUrl={`${base}models/AutoCompressedNORemesh.glb`}
              eulerDeg={e}
              allowControls
              classNames="w-full h-auto"
              background="#fafafa25"
              // ⬇️ inyectamos el rig (vive dentro del Canvas, puede usar hooks r3f)
              childrenInsideCanvas={<CameraRig ref={rigRef} />}
            />
          </div>

          {/* Panel derecho */}
          <div
            className="order-1 lg:order-2 w-full lg:w-1/3
                       flex flex-col gap-4
                       rounded-2xl p-4
                       bg-white/80 dark:bg-neutral-900/60
                       ring-1 ring-black/5 shadow-sm backdrop-blur
                       transition-shadow duration-300 hover:shadow-md"
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-sm font-medium text-slate-200">
                Modo emulación
              </span>
              <ToggleButton
                checked={isEmu}
                onChange={(checked) => setIsEmu(checked)}
                labels
                labelOn="Emulado"
                labelOff="Real"
                size="md"
              />
            </div>
            {/* Controles de orientación */}
            {!mockActive && (
              <OrientationControls eulerDeg={e} isEmu={isEmu} onChange={setE} />
            )}
            {isEmu && (
              <>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm font-medium text-slate-200">
                    Mock 3D
                  </span>
                  <button
                    type="button"
                    onClick={() => setMockActive((v) => !v)}
                    className={`inline-flex items-center justify-center gap-2
                rounded-xl px-3 py-1.5 text-xs font-medium
                transition-all duration-200 ring-1
                ${
                  mockActive
                    ? "bg-emerald-500/20 text-emerald-200 ring-emerald-400/40 hover:bg-emerald-500/30"
                    : "bg-white/10 text-slate-300 ring-white/10 hover:bg-white/20"
                }`}
                    aria-pressed={mockActive}
                  >
                    {mockActive ? "ON" : "OFF"}
                  </button>
                </div>
                <MockEulerGenerator
                  active={isEmu && mockActive}
                  ms={mockMs}
                  onMsChange={setMockMs}
                  onUpdate={(e) => setE(e)} // o useCallback si querés fijar la ref
                />
              </>
            )}
            {/* Inputs readonly que usan los valores leidos en tiempo real */}
            <RealtimeEulerPanel eulerDeg={e} />
          </div>
        </div>
      </div>
    </section>
  );
}
