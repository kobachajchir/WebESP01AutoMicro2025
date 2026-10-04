// Original CAD lens apexes, converted to glTF coordinates (meters, Y up).
// Keys follow the existing scene's left-to-right semantic order.
export const IR_MODEL_MAX_DIM_M = 0.22379893250763416;
export const IR_MODEL_CENTER_M = [
  0.14249908830970526, -0.00931055098772049, 0.10309718921780586,
] as const;

// Optical axis: mounting yaw + 13.5 degrees toward the receiver.
// Vishay 80393: https://www.vishay.com/docs/80393/windowsizecalcultator_tcrt5000_tcrt5000l.pdf
// +/-16 degrees is the half-intensity cross-section, approximated by a cone.
export const IR_EMITTER_HALF_ANGLE_DEG = 16;
// Configured experimental range; confirm it with the vehicle's calibration.
export const IR_MAX_RANGE_CM = 5;
export const IR_EMITTER_GEOMETRY = [
  { key: "objectLeft45", positionM: [0.05874675750732422, 0.0035, 0.06746430206298829], opticalYawDeg: 58.5 },
  { key: "objectLeftCenter", positionM: [0.10461393737792969, 0.003650000095367432, 0.06593194580078125], opticalYawDeg: 13.5 },
  { key: "objectCenter", positionM: [0.14211393737792968, 0.0035, 0.06593000030517578], opticalYawDeg: 13.5 },
  { key: "objectRightCenter", positionM: [0.1796139373779297, 0.0035, 0.06593194580078125], opticalYawDeg: 13.5 },
  { key: "objectRight45", positionM: [0.22453378295898438, 0.0035, 0.06966285705566407], opticalYawDeg: -31.5 },
] as const;

export const IR_CENTRAL_EMITTER_M = IR_EMITTER_GEOMETRY[2].positionM;
