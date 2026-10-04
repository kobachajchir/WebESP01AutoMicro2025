// src/components/ScreenStreamModal.tsx
import { useRef } from "react";
import { useScreenStreamKeyboard, type ScreenStreamKeyboardActions } from "../hooks/useScreenStreamKeyboard";
import Modal from "./modal";
import ScreenStreamWorkspace from "./ScreenStreamWorkspace";

interface ScreenStreamModalProps {
 isOpen: boolean;
 onClose: () => void;
}

export default function ScreenStreamModal({
 isOpen,
 onClose,
}: ScreenStreamModalProps) {
 const keyboardScopeRef = useRef<HTMLDivElement | null>(null);
 const keyboardActionsRef = useRef<ScreenStreamKeyboardActions | null>(null);
 useScreenStreamKeyboard({
 enabled: isOpen,
 scopeRef: keyboardScopeRef,
 actionsRef: keyboardActionsRef,
 });

 return (
 <Modal
 isOpen={isOpen}
 onClose={onClose}
 closeOnOverlayClick={true}
 keyboardNavigationEnabled={false}
 keyboardScopeRef={keyboardScopeRef}
 containerClassnames="screen-stream-modal-content flex-col w-full max-w-[min(1400px,96vw)]"
 >
 <div className="screen-stream-modal-heading mb-6">
 <div className="app-kicker mb-3">Stream</div>
 <h2 className="text-3xl font-black text-[var(--ui-text)]">Pantalla en vivo</h2>
 <p className="mt-2 text-sm text-[var(--ui-muted)]">
 Vista global del OLED para streaming y control remoto
 </p>
 <p className="mt-2 text-xs text-[var(--ui-muted)]">
 Teclado: ↑ giro izquierda · ↓ giro derecha · U usuario · M menú · R refrescar.
 Al mantener U o M durante 1,5 s, el botón se vuelve naranja hasta soltar.
 Cada tecla genera una sola acción al soltarla.
 </p>
 </div>

 <ScreenStreamWorkspace isModal keyboardActionsRef={keyboardActionsRef} />
 </Modal>
 );
}
