import { EspApiError } from "../protocol/espClient.ts";

export const STM_REMOTE_ACTION_STATUS = {
  ACCEPTED: 0,
  SCREEN_MISMATCH: 2,
  INVALID_STATE: 3,
  NOT_CONSUMED: 4,
  UNSUPPORTED_TRANSPORT: 5,
  AUTH_REQUIRED: 7,
  LOCAL_PIN_ACTIVE: 8,
  INVALID_SOURCE: 9,
} as const;

export interface StmRemoteActionFeedback {
  message: string;
  status?: number;
  refreshScreen: boolean;
  reauthenticationRequired: boolean;
}

export function getStmRemoteActionFeedback(
  cause: unknown,
  description: string,
): StmRemoteActionFeedback {
  if (!(cause instanceof EspApiError)) {
    return {
      message: cause instanceof Error ? cause.message : `Fallo al enviar ${description}`,
      refreshScreen: false,
      reauthenticationRequired: false,
    };
  }

  const status = readF4Status(cause.details);
  const base = {
    status,
    refreshScreen: false,
    reauthenticationRequired: false,
  };

  if (cause.code === "unauthorized" || status === STM_REMOTE_ACTION_STATUS.AUTH_REQUIRED) {
    return {
      ...base,
      message: "La sesion PIN del F4 vencio. Volve a autenticarte para continuar.",
      reauthenticationRequired: true,
    };
  }

  if (status === STM_REMOTE_ACTION_STATUS.SCREEN_MISMATCH) {
    return {
      ...base,
      message: `La pantalla del F4 cambio antes de aplicar "${description}". Sincronizando el estado real...`,
      refreshScreen: true,
    };
  }

  if (status === STM_REMOTE_ACTION_STATUS.INVALID_STATE) {
    return {
      ...base,
      message: `El F4 no puede aplicar "${description}" en la pantalla o estado actual.`,
      refreshScreen: true,
    };
  }

  if (status === STM_REMOTE_ACTION_STATUS.NOT_CONSUMED) {
    return {
      ...base,
      message: `La accion "${description}" llego al F4, pero ningun manejador de interfaz la consumio.`,
      refreshScreen: true,
    };
  }

  if (status === STM_REMOTE_ACTION_STATUS.LOCAL_PIN_ACTIVE) {
    return {
      ...base,
      message: "El F4 esta atendiendo una validacion PIN local y bloqueo temporalmente los controles remotos.",
      refreshScreen: true,
    };
  }

  if (status === STM_REMOTE_ACTION_STATUS.UNSUPPORTED_TRANSPORT) {
    return {
      ...base,
      message: `El F4 no admite "${description}" por el transporte actual.`,
    };
  }

  if (status === STM_REMOTE_ACTION_STATUS.INVALID_SOURCE) {
    return {
      ...base,
      message: "El F4 rechazo el nodo de origen asignado a esta sesion Web.",
    };
  }

  if (cause.code === "f4_nack") {
    return {
      ...base,
      message: `El F4 rechazo "${description}". Sincronizando la pantalla para recuperar el contexto.`,
      refreshScreen: true,
    };
  }

  return {
    ...base,
    message: cause.message,
  };
}

function readF4Status(details: unknown): number | undefined {
  if (!isRecord(details)) return undefined;

  for (const key of ["status", "stmCode", "f4Status", "f4Reason"]) {
    const value = details[key];
    if (typeof value === "number" && Number.isInteger(value)) return value;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
