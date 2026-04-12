import Modal from "../../../components/modal";

interface ProtocolHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProtocolHelpModal({ isOpen, onClose }: ProtocolHelpModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} closeOnOverlayClick={false}>
      <h2 className="mb-4 text-2xl font-bold text-slate-900">UNER Studio</h2>
      <p className="mb-3 text-black leading-relaxed">
        Esta seccion unifica tres herramientas del protocolo: un constructor de frames con routing y payload, un traductor que acepta hex, arrays C/Arduino o literales de Python, y un escaner de bloques para detectar multiples tramas UNER dentro del mismo stream.
      </p>
      <ul className="mb-4 space-y-2 text-black">
        <li><span className="font-semibold">Frame Builder:</span> selecciona origen, destino y comando. Si el comando tiene campos, la herramienta arma el payload automaticamente y recalcula el checksum XOR en tiempo real.</li>
        <li><span className="font-semibold">Payload manual:</span> si necesitas probar un caso fuera del formulario, puedes escribir bytes hex a mano y eso reemplaza el payload generado.</li>
        <li><span className="font-semibold">Traductor:</span> reconoce frames completos, comandos sueltos, arrays C, sintaxis de <code>bytes([...])</code> en Python y nombres de comandos como <code>PING</code>.</li>
        <li><span className="font-semibold">Escaner de bloques:</span> cuando encuentra varios headers o un bloque largo, separa frames validos, headers invalidos y bytes fuera de frame, mostrando una vista continua del stream.</li>
        <li><span className="font-semibold">Bootloader ESP detectado:</span> si el bloque previo al primer header contiene el log fijo tipo <code>ets Jan 8 2013</code> / <code>rst cause:2</code>, se marca como reinicio del ESP y no como ruido generico. En esta integracion eso suele significar que el STM se reinicio y obligo al ESP a reiniciarse.</li>
        <li><span className="font-semibold">Reinicios desde la web:</span> <code>resetEsp</code> y <code>resetMcu</code> viajan como <code>stmPacket</code> con <code>payload.data</code>. El firmware de la ESP valida esos bytes y los reenvia como frames UNER v2 con ruta <code>0x21</code>.</li>
        <li><span className="font-semibold">Telemetria:</span> <code>TELEMETRY_SET_RATE (0x20)</code> usa payload <code>u16 LE</code>; <code>00 00</code> detiene el stream, <code>0x21</code> confirma ACK y <code>0x22</code> transporta muestras de 17 bytes.</li>
        <li><span className="font-semibold">Salidas listas para copiar:</span> puedes exportar el frame como hex limpio, formato RealTerm, array <code>uint8_t[]</code> o literal de Python.</li>
      </ul>
      <div className="rounded-xl bg-white/70 p-3 text-xs text-black ring-1 ring-black/5">
        <p className="m-0">
          <span className="font-semibold">Tip:</span> usa <code>Cargar frame generado</code> para verificar inmediatamente el paquete que acabas de construir. Si estas depurando logs mezclados con texto, pega el bloque completo en el traductor para que el escaner intente reconstruir cada trama.
        </p>
      </div>
    </Modal>
  );
}
