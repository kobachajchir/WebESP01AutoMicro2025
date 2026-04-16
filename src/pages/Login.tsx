// src/pages/Login.tsx
import PinScreen from "../components/PinScreen";
import { useUser } from "../contexts/UserContext";

export default function Login() {
  const { login } = useUser();

  return (
    <PinScreen
      kicker="Acceso seguro"
      title="Ingresar PIN"
      subtitle="Usa el PIN de 4 dígitos guardado en el ESP para entrar al panel."
      submitLabel="Login"
      digitsCount={4}
      canClose={false}
      onSubmit={login}
      idleMessage="Escribí los 4 dígitos con el teclado."
      errorMessage="PIN incorrecto o sin respuesta del ESP."
      loadingMessage="Validando..."
    />
  );
}
