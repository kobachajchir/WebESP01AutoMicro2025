import { useWebSocket } from "../hooks/useWebSocket";
import { UNERProtocol } from "../api/UnerProtocol";

export default function MockInjectButton() {
  const { mockRaw } = useWebSocket();
  return (
    <button
    className="bg-red-400 p-4 rounded-xl"
      onClick={() => {
        // construir un frame válido (ej: CMD 0xA0, payload [0xF4,0x01] = 500ms)
        const frame = new UNERProtocol().buildPacket(
          0xa0,
          new Uint8Array([0xf4, 0x01])
        );
        console.log("Injecta")
        mockRaw(frame); // simula recepción binaria
      }}
    >
      Inject mock
    </button>
  );
}
