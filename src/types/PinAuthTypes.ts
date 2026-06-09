export type PinAuthFailureReason =
  | "invalid-pin"
  | "timeout"
  | "busy"
  | "bad-request"
  | "transport-error"
  | "grant-rejected"
  | "unknown";

export interface PinAuthResult {
  ok: boolean;
  reason?: PinAuthFailureReason;
  message?: string;
  code?: number;
}

export type PinSubmitResult = boolean | PinAuthResult;

