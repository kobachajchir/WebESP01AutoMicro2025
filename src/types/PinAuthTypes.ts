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
  attemptsLeft?: number | null;
  blocked?: boolean;
  authSource?: "stm32" | null;
  retryAfterMs?: number;
}

export type PinSubmitResult = boolean | PinAuthResult;
