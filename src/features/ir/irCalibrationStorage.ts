import { createEmptyIrCalibrationProfile, parseIrCalibrationProfile } from "./irCalibration";
import type { IrCalibrationProfile } from "./irCalibration";

export const IR_CALIBRATION_STORAGE_KEY = "uner.ir-object-calibration.v1";

export function loadStoredIrCalibrationProfile(): IrCalibrationProfile {
  try {
    const stored = window.localStorage.getItem(IR_CALIBRATION_STORAGE_KEY);
    if (stored) {
      const parsed = parseIrCalibrationProfile(stored);
      if (parsed.ok && parsed.profile) {
        return { ...parsed.profile, polarity: "higher-is-closer", material: parsed.profile.material === "Blanco de prueba" ? "Blanco" : parsed.profile.material };
      }
    }
  } catch {
    // Without localStorage both screens use the same empty profile in memory.
  }
  return createEmptyIrCalibrationProfile();
}
