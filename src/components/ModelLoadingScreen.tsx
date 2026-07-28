import AppLoadingScreen from "./AppLoadingScreen";

export default function ModelLoadingScreen({ visible }: { visible: boolean }) {
  return visible ? <AppLoadingScreen label="Cargando modelo 3D" /> : null;
}
