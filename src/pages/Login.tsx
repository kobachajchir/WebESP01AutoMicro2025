// src/pages/Login.tsx
import PinScreen from "../components/PinScreen";
import { useUser } from "../contexts/UserContext";

export default function Login() {
  const { login, sessionNotice } = useUser();

  return (
    <PinScreen
      kicker="Acceso seguro"
      title="Ingresar PIN"
      subtitle="Usá el PIN de 4 dígitos almacenado en el STM32/F4. El ESP sólo transporta la solicitud."
      submitLabel="Login"
      digitsCount={4}
      canClose={false}
      onSubmit={login}
      idleMessage={sessionNotice ?? "Ingresá los 4 dígitos; después de validar verás los intentos restantes."}
      errorMessage="No se pudo validar el PIN con el STM32."
      loadingMessage="Validando y confirmando la sesión..."
    />
  );
}
