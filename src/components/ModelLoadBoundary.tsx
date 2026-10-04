import { Component, type ReactNode } from "react";
import ModelLoadingScreen from "./ModelLoadingScreen";

interface Props {
  modelUrl: string;
  children: ReactNode;
}

interface State {
  modelUrl: string;
  failed: boolean;
}

// Un fallo del modelo queda dentro del canvas y no deja la web cargando.
export default class ModelLoadBoundary extends Component<Props, State> {
  state: State = { modelUrl: this.props.modelUrl, failed: false };

  static getDerivedStateFromProps(props: Props, state: State) {
    return props.modelUrl !== state.modelUrl
      ? { modelUrl: props.modelUrl, failed: false }
      : null;
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    // Diagnostico de carga: conserva el motivo real sin imprimir assets base64.
    const message = error.message.replace(/data:[^\s]+/g, "[asset incorporado]");
    console.error("[Modelo 3D] Error al cargar el archivo local", {
      modelUrl: this.props.modelUrl.startsWith("data:") ? "[asset incorporado]" : this.props.modelUrl,
      message,
    });
  }

  render() {
    return this.state.failed ? (
      <ModelLoadingScreen
        visible
        failed
        customLabel="No se pudo cargar el modelo 3D local"
      />
    ) : this.props.children;
  }
}
