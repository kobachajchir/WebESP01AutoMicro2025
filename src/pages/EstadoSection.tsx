import { useEffect, useRef, useState } from "react";
import ThreeModelViewer from "../components/ThreeModelViewer";
import OrientationControls from "../components/OrientationControls";
import type { CameraRigHandle, PresetKey } from "../components/CameraRig";
import CameraRig from "../components/CameraRig";
import CameraPresetsPanel from "../components/CameraPresetsPanel";
import ToggleButton from "../components/toggleButton";
import PageHeader from "../components/PageHeader";
import RealtimeEulerPanel from "../components/RealTimeEulerPanel";
import MockEulerGenerator from "../components/MockEulerGenerator";
import Modal from "../components/modal";
import { UNER, UNERProtocol, type TelemetrySetRateParams } from "../api/UnerProtocol";
import { useWebSocket } from "../hooks/useWebSocket";
import { CMD, type U16 } from "../types/UnerProtocolCMDTypes";

export default function EstadoSection() {
  // @ts-ignore
  const { mockRaw, setSensorRefreshInterval, sensorRefreshInterval } = useWebSocket();
  const [e, setE] = useState({ yaw: 0, pitch: 0, roll: 0 });
  const [mockActive, setMockActive] = useState(false);
  const [mockMs, setMockMs] = useState(120);

  const [openSettingsModal, setOpenSettingsModal] = useState(false);
  const [openInfoModal, setOpenInfoModal] = useState(false);

  const base = import.meta.env.BASE_URL || "/";

  const rigRef = useRef<CameraRigHandle>(null);
  function handlePick(k: PresetKey) {
    setE({ yaw: 0, pitch: 0, roll: 0 });
    rigRef.current?.goTo(k);
  }

  const [isEmu, setIsEmu] = useState(false);

  const sensorValue = useRef<HTMLInputElement>(null);

  const [sensorSliderValue, setSensorSliderValue] = useState<number>(
    sensorRefreshInterval
  );

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
          setOpenSettingsModal={setOpenSettingsModal}
          setOpenInfoModal={setOpenInfoModal}
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
                onDeactivate={() => setMockActive(false)}
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
            <RealtimeEulerPanel
              eulerDeg={e}
              sensorIntervalTime={sensorRefreshInterval}
            />
          </div>
        </div>
      </div>
      {openInfoModal && (
        <Modal
          isOpen={openInfoModal}
          onClose={() => setOpenInfoModal(false)}
          closeOnOverlayClick={false}
        >
          <h2 className="text-2xl font-bold mb-4 text-slate-900">
            Visor 3D y Datos del MPU6050
          </h2>

          <p className="mb-3 text-black leading-relaxed">
            En esta sección podés visualizar el modelo 3D del vehículo, rotarlo
            según la orientación medida por el <strong>MPU6050</strong> y
            alternar entre un
            <strong> modo Real</strong> (datos del sensor) y un
            <strong> modo Emulado</strong> (sliders de yaw/pitch/roll). El visor
            usa <em>Three.js / React Three Fiber</em>, con fondo transparente y
            auto-encuadre del modelo.
          </p>

          <ul className="mb-4 space-y-2 text-black">
            <li>
              <span className="font-semibold">Modos:</span>{" "}
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-emerald-600 text-white ring-1 ring-emerald-500/20">
                Real
              </span>{" "}
              toma datos del MPU6050 (giroscopio+acelerómetro, filtrado
              complementario) y{" "}
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-indigo-500 text-white ring-1 ring-indigo-500/20">
                Emulado
              </span>{" "}
              habilita sliders para yaw/pitch/roll en grados.
            </li>

            <li>
              <span className="font-semibold">Orientación:</span> el modelo
              aplica Euler en orden <code>YXZ</code> (yaw→pitch→roll). Asegurate
              de mapear correctamente ejes del sensor con el chasis (marcar eje
              +X, +Y, +Z en el PCB).
            </li>

            <li>
              <span className="font-semibold">Cámara y controles:</span>{" "}
              OrbitControls con presets (Frente, Izq/Der, Arriba/Abajo, ISO). El
              visor auto-encuadra el modelo al cargar y mantiene el foco en el
              origen.
            </li>

            <li>
              <span className="font-semibold">Carga de modelo:</span> se soporta{" "}
              <code>.glb/.gltf</code> (opcional Draco). Ubicá el archivo en{" "}
              <code>public/models/</code>. El fondo del canvas es transparente
              para integrarlo con el resto de la UI.
            </li>

            <li>
              <span className="font-semibold">Datos en tiempo real:</span> el
              backend PC recibe paquetes del MPU6050 (ej. vía ESP‑01/WebSocket o
              Serial), publica
              <code> yaw/pitch/roll</code> en ° y los graficamos en una
              tabla/serie de tendencias (últimos N segundos).
            </li>

            <li>
              <span className="font-semibold">Calibración:</span> offset de
              giroscopio en reposo, nivelación inicial (pitch/roll) y ajuste de
              signo por eje. Guardar en EEPROM/LocalStorage.
            </li>
          </ul>

          <div className="rounded-xl bg-white/70 dark:bg-neutral-900/50 ring-1 ring-black/5 dark:ring-white/10 shadow-sm backdrop-blur p-3 text-xs text-black">
            <p className="m-0">
              <span className="font-semibold">Tip:</span> publicá los ángulos ya
              en grados. Si leés crudos <code>INT16</code> del giroscopio,
              escalá a°/s (LSB según el rango) y aplicá un filtro complementario
              típico:
              <code>
                {" "}
                angle = α·(angle + gyro·dt) + (1-α)·accAngle
              </code> con <code>α≈0.98</code> y <code>dt</code> en s. Frecuencia
              sugerida: <code>50-100&nbsp;Hz</code>. Limita jitter con una
              ventana móvil o <code>median</code> sobre 3-5 muestras.
            </p>
          </div>
        </Modal>
      )}
      {openSettingsModal && (
        <Modal
          isOpen={openSettingsModal}
          onClose={() => setOpenSettingsModal(false)}
          closeOnOverlayClick={false}
          containerClassnames="flex flex-col items-center justify-center"
        >
          <h2 className="text-2xl font-bold mb-4 text-slate-900 w-full">
            Configuracion
          </h2>
          <div className="flex w-full lg:w-2/3 flex-col gap-4 p-3 items-center justify-center rounded-lg bg-slate-600/80 border-slate-700">
            <div className="flex flex-col w-full items-center justify-center">
              <div className="flex flex-col lg:flex-row gap-3 w-full items-center justify-center">
                <div className="flex flex-col w-2/3 lg:w-1/2 items-center justify-center">
                  <p className="text-sm text-white">
                    Intervalo refresco de datos actual
                  </p>
                  <p className="text-sm text-white">
                    {sensorRefreshInterval}ms
                  </p>
                </div>
                <div className="flex flex-col ">
                  <input
                    id="sensor-slider"
                    type="range"
                    min={50}
                    max={10000}
                    step={50}
                    defaultValue={sensorRefreshInterval}
                    className="w-56 accent-cyan-400"
                    ref={sensorValue}
                    onInput={(e) => {
                      // Actualizar solo el texto del label
                      const label = document.querySelector(
                        'label[for="sensor-slider"]'
                      );
                      if (label) {
                        //@ts-ignore
                        label.textContent = `${e.target.value}ms`;
                      }
                    }}
                  />
                  <label htmlFor="sensor-slider" className="text-sm text-white">
                    {sensorRefreshInterval}ms
                  </label>
                </div>
              </div>
              <button
                onClick={() => {
                  if(sensorValue){
                    setSensorRefreshInterval(Number(sensorValue.current?.value)); // Usa el valor del estado
                  }
                }}
                className="mt-3 px-4 py-2 bg-cyan-400 text-slate-900 rounded hover:bg-cyan-300 transition-colors"
              >
                Enviar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
