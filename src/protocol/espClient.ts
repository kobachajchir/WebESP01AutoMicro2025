import {
  buildWsRequest,
  parseWsEnvelope,
  type CommandName,
  type WsEnvelope,
  type WsError,
  type WsEvent,
} from "./wsApi.ts";

export class EspApiError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "EspApiError";
    this.code = code;
    this.details = details;
  }
}

type PendingRequest = {
  command: CommandName;
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

type EventHandler = (event: WsEvent) => void;

export class EspClient {
  private pending = new Map<string, PendingRequest>();
  private eventListeners = new Map<string, Set<EventHandler>>();
  private sender: ((text: string) => void) | null = null;

  setSender(sender: ((text: string) => void) | null): void {
    this.sender = sender;
    if (!sender) {
      this.cancelPending("connection_lost", "La conexion WebSocket se cerro");
    }
  }

  request<T>(
    command: CommandName,
    args: Record<string, unknown> = {},
    options: { requestId?: string; timeoutMs?: number } = {},
  ): Promise<T> {
    if (!this.sender) {
      return Promise.reject(new EspApiError("offline", "WebSocket desconectado"));
    }

    const request = buildWsRequest(command, args, options.requestId);
    if (this.pending.has(request.requestId)) {
      return Promise.reject(
        new EspApiError("invalid_request", `requestId duplicado: ${request.requestId}`),
      );
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(request.requestId);
        reject(new EspApiError("timeout", `Timeout esperando ${command}`));
      }, options.timeoutMs ?? 10_000);

      this.pending.set(request.requestId, {
        command,
        resolve: resolve as (data: unknown) => void,
        reject,
        timer,
      });

      try {
        this.sender?.(JSON.stringify(request));
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(request.requestId);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  accept(value: unknown): WsEnvelope | null {
    const decoded = typeof value === "string" ? safeParseJson(value) : value;
    const envelope = parseWsEnvelope(decoded);
    if (!envelope) {
      return null;
    }

    if (envelope.type === "event") {
      this.eventListeners.get(envelope.event)?.forEach((handler) => handler(envelope));
      this.eventListeners.get("*")?.forEach((handler) => handler(envelope));
      return envelope;
    }

    if (!envelope.requestId) {
      return envelope;
    }

    const pending = this.pending.get(envelope.requestId);
    if (!pending) {
      return envelope;
    }

    clearTimeout(pending.timer);
    this.pending.delete(envelope.requestId);

    if (envelope.type === "error") {
      pending.reject(toEspApiError(envelope));
    } else if (envelope.command !== pending.command) {
      pending.reject(
        new EspApiError(
          "invalid_response",
          `La respuesta ${envelope.command} no corresponde a ${pending.command}`,
        ),
      );
    } else {
      pending.resolve(envelope.data);
    }

    return envelope;
  }

  subscribe(event: string, handler: EventHandler): () => void {
    const listeners = this.eventListeners.get(event) ?? new Set<EventHandler>();
    listeners.add(handler);
    this.eventListeners.set(event, listeners);
    return () => {
      listeners.delete(handler);
      if (listeners.size === 0) {
        this.eventListeners.delete(event);
      }
    };
  }

  cancelPending(code = "connection_lost", message = "Operacion cancelada"): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new EspApiError(code, message));
    }
    this.pending.clear();
  }

  get pendingCount(): number {
    return this.pending.size;
  }
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toEspApiError(error: WsError): EspApiError {
  return new EspApiError(error.code, error.message, error.details);
}
