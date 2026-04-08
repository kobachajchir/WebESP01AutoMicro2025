export type CommandKind = "request" | "mixed" | "event" | "ack";
export type FieldType = "select" | "str" | "u8" | "hex1";
export type ValidationTone = "ok" | "warn" | "bad";
export type OverallState = "ok" | "warn" | "bad";
export type TranslatorViewMode = "idle" | "singleFrame" | "singleCommand" | "block" | "error";

export interface CommandField {
  id: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
}

export interface CommandDefinition {
  name: string;
  desc: string;
  fields: CommandField[];
  minPayload: number;
  maxPayload: number;
  kind: CommandKind;
}

export interface CommandGroup {
  label: string;
  commands: string[];
}

export interface ValidationItem {
  tone: ValidationTone;
  message: string;
}

export interface TranslationResult {
  overall: OverallState;
  summary: string;
  typeDetected: string;
  cmdHex: string;
  name: string;
  meaning: string;
  route: string;
  nodes: string;
  len: string;
  payload: string;
  validations: ValidationItem[];
  frameBytes: number[];
  hasFrame: boolean;
}

export interface BlockGap {
  start: number;
  end: number;
  bytes: number[];
  kind: "out_of_frame" | "boot_reset";
  title: string;
  note: string;
}

export interface InvalidCandidate {
  offset: number;
  reason: string;
  preview: number[];
}

export interface ValidFrameItem {
  offset: number;
  frame: number[];
  analysis: TranslationResult;
}

export interface ScanBlockResult {
  sourceLabel: string;
  totalBytes: number;
  validFrames: ValidFrameItem[];
  invalidCandidates: InvalidCandidate[];
  gaps: BlockGap[];
  knownCount: number;
  unknownCount: number;
}

export type DetectInputResult =
  | {
      mode: "frame";
      bytes: number[];
      sourceLabel: string;
      forceBlockScan: boolean;
    }
  | {
      mode: "cmd";
      cmd: number;
      sourceLabel: string;
    };

export interface BuilderData {
  frame: number[];
  payload: number[];
  cmd: number;
  route: number;
  chk: number;
  len: number;
}
