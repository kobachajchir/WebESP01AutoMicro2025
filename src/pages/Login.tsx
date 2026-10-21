// src/pages/Login.tsx
import PinScreen from "../components/PinScreen";
import { useUser } from "../contexts/UserContext";

export default function Login() {
  const { login, sessionNotice } = useUser();

  return (
    <PinScreen
      kicker="Acceso seguro"
      title="Ingresar PIN"
      subtitle="Usá el PIN del STM32/F4 para el acceso normal, o 9999 para navegar y usar el Wi-Fi de la ESP sin F4. En el bypass los ajustes duran solo esta sesión y no se guardan en Flash."
      submitLabel="Login"
      digitsCount={4}
      canClose={false}
      onSubmit={login}
      idleMessage={sessionNotice ?? "Ingresá los 4 dígitos; después de validar verás los intentos restantes."}
      errorMessage="No se pudo validar el PIN con el STM32."
      compactInvalidPinError
      loadingMessage="Validando y confirmando la sesión..."
    />
  );
}
