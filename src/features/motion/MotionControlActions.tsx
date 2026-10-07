import TransportActionButton from "../../components/TransportActionButton";
import { ESP_COMMANDS } from "../../protocol/wsApi";
import MotionControlIcon from "./MotionControlIcon";
import type { MotionController } from "./useMotionControl";

export default function MotionControlActions({ control, isSimulating = false, onStopSimulation }: {
  control: MotionController;
  isSimulating?: boolean;
  onStopSimulation?: () => void;
}) {
  const { real, ready, pending, state, balanceEnabled, run, refresh } = control;
  return <>
    <TransportActionButton label={balanceEnabled ? "Desactivar balance" : "Activar balance"}
      detail={!state ? "Estado sin confirmar" : balanceEnabled ? "Balance activado" : state.carMode === 2 ? "No disponible en TEST" : "Balance desactivado"}
      icon={<MotionControlIcon name="balance" />} tone="emerald" active={balanceEnabled}
      pressed={state ? balanceEnabled : undefined}
      disabled={balanceEnabled ? !real || pending : !ready || state?.carMode === 2}
      onClick={() => { void run(ESP_COMMANDS.SET_BALANCE_ENABLED, { enabled: !balanceEnabled }); }} />
    <TransportActionButton label="Detener" detail={real ? "Motores y balance" : "Simulación local"}
      icon={<MotionControlIcon name="stop" />} tone="rose"
      disabled={real ? pending : !isSimulating}
      onClick={() => {
        onStopSimulation?.();
        if (real) void run(ESP_COMMANDS.STOP_MOTION, { disableBalance: true });
      }} />
    <TransportActionButton label="Consultar estado" detail={pending ? "Esperando a la placa" : "Actualizar desde la placa"}
      icon={<MotionControlIcon name="refresh" />} tone="muted" disabled={!real || pending}
      onClick={() => { void refresh(); }} />
  </>;
}
