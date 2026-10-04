import { useLayoutEffect, type RefObject } from "react";

type RemoteButtonKind = "encoder" | "user";

export interface ScreenStreamKeyboardActions {
  active: boolean;
  onRotate: (direction: "left" | "right") => void;
  onRefresh: () => void;
  onPressStart: (kind: RemoteButtonKind) => void;
  onPressRelease: (kind: RemoteButtonKind) => void;
  onPressCancel: (kind: RemoteButtonKind) => void;
}

interface ScreenStreamKeyboardOptions {
  enabled: boolean;
  scopeRef: RefObject<HTMLDivElement | null>;
  actionsRef: RefObject<ScreenStreamKeyboardActions | null>;
}

function buttonForKey(key: string): RemoteButtonKind | null {
  if (key === "u") return "user";
  if (key === "m") return "encoder";
  return null;
}

function directionForKey(key: string): "left" | "right" | null {
  if (key === "arrowup") return "left";
  if (key === "arrowdown") return "right";
  return null;
}

export function useScreenStreamKeyboard({
  enabled,
  scopeRef,
  actionsRef,
}: ScreenStreamKeyboardOptions) {
  useLayoutEffect(() => {
    if (!enabled) return;
    const scope = scopeRef.current;
    if (!scope) return;

    const heldKeys = new Set<string>();
    const cancelHeldKeys = () => {
      heldKeys.forEach((key) => {
        const kind = buttonForKey(key);
        if (kind) actionsRef.current?.onPressCancel(kind);
      });
      heldKeys.clear();
    };
    const shouldIgnoreAction = (event: KeyboardEvent) =>
      event.isComposing || event.ctrlKey || event.altKey || event.metaKey;
    const captureKey = (event: KeyboardEvent) => {
      if (!(event.target instanceof Node) || !scope.contains(event.target)) return false;

      // Dentro del visor ninguna tecla navega, selecciona o activa controles HTML.
      event.preventDefault();
      event.stopImmediatePropagation();
      return true;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!captureKey(event) || shouldIgnoreAction(event) || event.repeat) return;

      const key = event.key.toLowerCase();
      const kind = buttonForKey(key);
      if (!actionsRef.current?.active ||
          (!kind && !directionForKey(key) && key !== "r") || heldKeys.has(key)) return;

      heldKeys.add(key);
      // El estado visual funciona sin conexion. El comando espera a keyup.
      if (kind) actionsRef.current.onPressStart(kind);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const captured = captureKey(event);
      const key = event.key.toLowerCase();
      if (!heldKeys.delete(key)) return;

      const kind = buttonForKey(key);
      if (!captured || shouldIgnoreAction(event) || !actionsRef.current?.active) {
        if (kind) actionsRef.current?.onPressCancel(kind);
        return;
      }

      if (kind) {
        actionsRef.current.onPressRelease(kind);
      } else if (key === "r") {
        actionsRef.current.onRefresh();
      } else {
        const direction = directionForKey(key);
        if (direction) actionsRef.current.onRotate(direction);
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) cancelHeldKeys();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!(event.relatedTarget instanceof Node) || !scope.contains(event.relatedTarget)) {
        cancelHeldKeys();
      }
    };

    scope.addEventListener("keydown", onKeyDown, true);
    scope.addEventListener("keyup", onKeyUp, true);
    scope.addEventListener("focusout", onFocusOut);
    window.addEventListener("blur", cancelHeldKeys);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      scope.removeEventListener("keydown", onKeyDown, true);
      scope.removeEventListener("keyup", onKeyUp, true);
      scope.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("blur", cancelHeldKeys);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      cancelHeldKeys();
    };
  }, [enabled, scopeRef, actionsRef]);
}
