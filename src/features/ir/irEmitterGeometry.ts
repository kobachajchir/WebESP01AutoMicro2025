// Original CAD lens apexes, converted to glTF coordinates (meters, Y up).
// Keys follow the existing scene's left-to-right semantic order.
export const IR_MODEL_MAX_DIM_M = 0.223800005391;
export const IR_MODEL_CENTER_M = [
  0.142499684356, -0.009308708832, 0.103089075536,
] as const;

// V2 original CAD, including the rubber rings. glTF Y is Blender Z.
export const MODEL_GROUND_Y_M = -0.053448909759521484;
export const WHEEL_AXLE_HEIGHT_M = 0.0334495015;
export const MODEL_CENTER_HEIGHT_M = IR_MODEL_CENTER_M[1] - MODEL_GROUND_Y_M;

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

// Lens poles of V2_RAW_0366_00; receiver poles are V2_RAW_0367_00.
// All three receivers lie toward -Z, so the optical axis tilts that way.
export const IR_LINE_OPTICAL_TILT_DEG = 13.5;
const lineTiltRad = IR_LINE_OPTICAL_TILT_DEG * Math.PI / 180;
export const IR_LINE_DIRECTION = [0, -Math.cos(lineTiltRad), -Math.sin(lineTiltRad)] as const;
export const IR_LINE_EMITTER_GEOMETRY = [
  { key: "lineLeft", positionM: [0.12058866882324219, -0.04621500015258789, 0.09013170623779297], receiverM: [0.12058866882324219, -0.04621500015258789, 0.0870538330078125] },
  { key: "lineCenter", positionM: [0.1405927734375, -0.04621500015258789, 0.09013170623779297], receiverM: [0.1405927734375, -0.04621500015258789, 0.0870538330078125] },
  { key: "lineRight", positionM: [0.1605989990234375, -0.04621500015258789, 0.09013170623779297], receiverM: [0.1605989990234375, -0.04621500015258789, 0.0870538330078125] },
] as const;

// V2_RAW_0354_00, three disjoint lamps; centers are the downward dome poles.
export const WHITE_LED_GEOMETRY = [
  { key: "whiteLeft", positionM: [0.12059367370605469, -0.04869499969482422, 0.0795677719116211] },
  { key: "whiteCenter", positionM: [0.1405927734375, -0.04869499969482422, 0.07957276916503906] },
  { key: "whiteRight", positionM: [0.160593994140625, -0.04869499969482422, 0.0795677719116211] },
] as const;

// Fixed visual half-angle from the LED axis; generic part remains unknown.
export const WHITE_LED_HALF_ANGLE_DEG = 30;
