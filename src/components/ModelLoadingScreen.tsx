import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import AppLoadingScreen from "./AppLoadingScreen";

export default function ModelLoadingScreen({
  visible,
  customLabel,
  failed = false,
}: {
  visible: boolean;
  customLabel?: string;
  failed?: boolean;
}) {
  const { gl } = useThree();
  const portal = useMemo(() => ({ current: gl.domElement.parentElement! }), [gl]);
  if (!visible) return null;
  return (
    <Html
      fullscreen
      portal={portal}
      zIndexRange={[20, 20]}
      calculatePosition={(_object, _camera, size) => [size.width / 2, size.height / 2]}
      style={{ pointerEvents: "none" }}
    >
      <AppLoadingScreen
        label={customLabel ?? "Cargando modelo 3D local"}
        className="model-loading-screen"
        showSpinner={!failed}
      />
    </Html>
  );
}
