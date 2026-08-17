// src/components/ScreenStreamModal.tsx
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
 return (
 <Modal
 isOpen={isOpen}
 onClose={onClose}
 closeOnOverlayClick={true}
 containerClassnames="screen-stream-modal-content flex-col w-full max-w-[min(1400px,96vw)]"
 >
 <div className="screen-stream-modal-heading mb-6">
 <div className="app-kicker mb-3">Stream</div>
 <h2 className="text-3xl font-black text-[var(--ui-text)]">Pantalla en vivo</h2>
 <p className="mt-2 text-sm text-[var(--ui-muted)]">
 Vista global del OLED para streaming y control remoto
 </p>
 </div>

 <ScreenStreamWorkspace isModal />
 </Modal>
 );
}
