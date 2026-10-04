import { Component, useCallback, useState, type ReactNode } from "react";
import { Canvas, type CanvasProps } from "@react-three/fiber";
import * as THREE from "three";
import AppLoadingScreen from "./AppLoadingScreen";

type RendererFactory = Extract<NonNullable<CanvasProps["gl"]>, (defaults: never) => unknown>;
type RendererDefaults = Parameters<RendererFactory>[0];
class RendererBoundary extends Component<{ children: ReactNode; onError: (message: string) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError(error.message); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function WebGLCanvas({
  children,
  dpr = [1, 1.5],
  ...props
}: Omit<CanvasProps, "gl">) {
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const createRenderer = useCallback((defaults: RendererDefaults) => {
    const canvas = defaults.canvas as HTMLCanvasElement;
    let driverMessage = "";
    let context: WebGL2RenderingContext | null = null;
    const onCreationError = (event: Event) => {
      driverMessage = (event as WebGLContextEvent).statusMessage;
    };
    canvas.addEventListener("webglcontextcreationerror", onCreationError);

    try {
      // Fiber pide high-performance por defecto. Dejar elegir al navegador
      // evita exigir una GPU dedicada; el segundo perfil reduce requisitos.
      const profiles: WebGLContextAttributes[] = [
        {
          alpha: true,
          depth: true,
          stencil: false,
          antialias: true,
          premultipliedAlpha: true,
          preserveDrawingBuffer: false,
          powerPreference: "default",
          failIfMajorPerformanceCaveat: false,
        },
        {
          alpha: true,
          depth: true,
          stencil: false,
          antialias: false,
          premultipliedAlpha: true,
          preserveDrawingBuffer: false,
          powerPreference: "low-power",
          failIfMajorPerformanceCaveat: false,
        },
      ];
      let selectedProfile = profiles[0];
      for (const profile of profiles) {
        context = canvas.getContext("webgl2", profile);
        if (context) {
          selectedProfile = profile;
          break;
        }
      }

      // Three r179 necesita WebGL 2. No crear el renderer si el navegador
      // rechaza ambos perfiles; el contexto exitoso se reutiliza, sin sondeo
      // en otro canvas ni contextos adicionales.
      if (!context) {
        throw new Error(driverMessage || "WebGL 2 no está disponible en este navegador.");
      }

      return new THREE.WebGLRenderer({
        ...defaults,
        ...selectedProfile,
        canvas,
        context,
      });
    } catch (cause) {
      const message = driverMessage || (cause instanceof Error ? cause.message : String(cause));
      console.error("[WebGL][Visor 3D] No se pudo inicializar el renderer", message);
      context?.getExtension("WEBGL_lose_context")?.loseContext();
      // A synchronous factory matches the installed Fiber API. The outer
      // boundary turns renderer initialization failures into the existing retry UI.
      throw new Error(message);
    } finally {
      canvas.removeEventListener("webglcontextcreationerror", onCreationError);
    }
  }, []);

  if (error) {
    const disabled = /GL_(?:VENDOR|RENDERER)\s*=\s*Disabled|WebGL.*disabled|disabled.*WebGL/i.test(error);
    return (
      <div className="relative h-full w-full overflow-hidden" style={{ minHeight: "inherit" }}>
        <AppLoadingScreen
          label={disabled ? "WebGL está deshabilitado en el navegador" : "No se pudo iniciar la vista 3D"}
          className="model-loading-screen"
          showSpinner={false}
        >
          <p className="max-w-sm text-center text-xs text-[var(--ui-text-muted)]">
            La vista 3D necesita WebGL 2. Activá la aceleración gráfica en
            Configuración → Sistema de Chrome o Edge y reiniciá el navegador.
          </p>
          <p className="max-w-sm text-center text-xs text-[var(--ui-text-muted)]">
            Si estás usando un navegador integrado, abrí esta misma dirección
            en Chrome o Edge. Si el problema continúa, actualizá el controlador
            de la tarjeta gráfica.
          </p>
          <details className="pointer-events-auto w-full text-xs text-[var(--ui-text-muted)]">
            <summary className="cursor-pointer">Detalle del navegador</summary>
            <p className="mt-2 max-h-24 overflow-auto break-words text-left">{error}</p>
          </details>
          <button
            type="button"
            className="pointer-events-auto rounded-md border border-cyan-300/30 px-3 py-2 text-xs text-cyan-300"
            onClick={() => {
              setAttempt((current) => current + 1);
              setError(null);
            }}
          >
            Reintentar vista 3D
          </button>
        </AppLoadingScreen>
      </div>
    );
  }

  return (
    <RendererBoundary key={attempt} onError={setError}>
      <Canvas {...props} dpr={dpr} gl={createRenderer}>
        {children}
      </Canvas>
    </RendererBoundary>
  );
}
