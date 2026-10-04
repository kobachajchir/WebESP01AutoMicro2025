import { useEffect } from "react";

let activeLocks = 0;
let restoreScroll: (() => void) | null = null;

/** Bloquea el documento y el contenedor desplazable de la ruta actual. */
export function useModalScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;

    if (activeLocks === 0) {
      const elements = [
        document.documentElement,
        document.body,
        ...document.querySelectorAll<HTMLElement>(".app-route-view"),
      ];
      const previous = elements.map((element) => ({
        element,
        overflow: element.style.overflow,
        overscrollBehavior: element.style.overscrollBehavior,
      }));

      elements.forEach((element) => {
        element.style.overflow = "hidden";
        element.style.overscrollBehavior = "none";
      });
      restoreScroll = () => {
        previous.forEach(({ element, overflow, overscrollBehavior }) => {
          element.style.overflow = overflow;
          element.style.overscrollBehavior = overscrollBehavior;
        });
      };
    }
    activeLocks += 1;

    return () => {
      // La capa sigue visible durante su salida; el fondo no debe moverse entonces.
      window.setTimeout(() => {
        activeLocks = Math.max(0, activeLocks - 1);
        if (activeLocks === 0) {
          restoreScroll?.();
          restoreScroll = null;
        }
      }, 240);
    };
  }, [isOpen]);
}
