export type Dir = 0 | 1; //Atras 1, Adelante 0
export type MotorTarget = "left" | "right" | "both";
export type BlockKind = "ramp" | "hold" | "pivot" | "arc" | "stop";
export type TrackKey = "left" | "right" | "dual";

export interface Block {
  id: string;
  kind: BlockKind;
  label: string;
  durationMs: number;
  direction: Dir;
  speed?: number; // 0..100 (hold/pivot/arc)
}
