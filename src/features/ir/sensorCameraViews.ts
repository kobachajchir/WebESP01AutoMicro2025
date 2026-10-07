type CameraView = {
  key: string;
  label: string;
  shortLabel: string;
  position: readonly [number, number, number];
  up?: readonly [number, number, number];
};

// Offsets from the centered model. The vehicle's front points toward -Z.
export const SENSOR_CAMERA_VIEW_GROUPS = [
  { label: "Vistas principales", views: [
    { key: "front", label: "Frontal", shortLabel: "Frente", position: [0, 0, -4.15] },
    { key: "back", label: "Posterior", shortLabel: "Trasera", position: [0, 0, 4.15] },
    { key: "left", label: "Izquierda", shortLabel: "Izq.", position: [-4.15, 0, 0] },
    { key: "right", label: "Derecha", shortLabel: "Der.", position: [4.15, 0, 0] },
    { key: "top", label: "Superior", shortLabel: "Arriba", position: [0, 4.15, 0], up: [0, 0, -1] },
    { key: "bottom", label: "Inferior", shortLabel: "Abajo", position: [0, -4.15, 0], up: [0, 0, 1] },
  ] },
  { label: "Isométricas superiores", views: [
    { key: "iso", label: "Frontal derecha", shortLabel: "Fr. der.", position: [2.5, 2.5, -2.5] },
    { key: "isoFrontLeft", label: "Frontal izquierda", shortLabel: "Fr. izq.", position: [-2.5, 2.5, -2.5] },
    { key: "isoBackRight", label: "Posterior derecha", shortLabel: "Tr. der.", position: [2.5, 2.5, 2.5] },
    { key: "isoBackLeft", label: "Posterior izquierda", shortLabel: "Tr. izq.", position: [-2.5, 2.5, 2.5] },
  ] },
  { label: "Isométricas inferiores", views: [
    { key: "isoBottomFrontRight", label: "Frontal derecha", shortLabel: "Fr. der.", position: [2.5, -2.5, -2.5] },
    { key: "isoBottomFrontLeft", label: "Frontal izquierda", shortLabel: "Fr. izq.", position: [-2.5, -2.5, -2.5] },
    { key: "isoBottomBackRight", label: "Posterior derecha", shortLabel: "Tr. der.", position: [2.5, -2.5, 2.5] },
    { key: "isoBottomBackLeft", label: "Posterior izquierda", shortLabel: "Tr. izq.", position: [-2.5, -2.5, 2.5] },
  ] },
] as const satisfies readonly { label: string; views: readonly CameraView[] }[];

export type SensorCameraPreset = (typeof SENSOR_CAMERA_VIEW_GROUPS)[number]["views"][number]["key"];
export const SENSOR_CAMERA_VIEWS: readonly CameraView[] = SENSOR_CAMERA_VIEW_GROUPS.flatMap<CameraView>((group) => [...group.views]);
