export type BeamGroup = "objects" | "line";
export type BeamOpacities = Record<BeamGroup, number>;
export type BeamVisibility = Record<BeamGroup, boolean>;

// Fractions used directly by the materials, independent of ADC and sensitivity.
export const DEFAULT_BEAM_OPACITIES: BeamOpacities = {
  objects: 0.02,
  line: 0.02,
};
