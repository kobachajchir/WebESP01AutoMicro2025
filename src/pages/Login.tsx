import { useRef, useState } from "react";
import { useUser } from "../contexts/UserContext";

export default function Login() {
  const { login } = useUser();
  const pinRef = useRef<HTMLInputElement>(null);
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  const valid = /^\d{4}$/.test(pin);

  function handlePinChange(value: string) {
    setStatus("idle");
    setPin(value.replace(/\D/g, "").slice(0, 4));
  }

  async function sendLoginAttempt() {
    if (!valid || status === "loading") return;
    setStatus("loading");
    const ok = await login(pin);
    setStatus(ok ? "idle" : "error");
    if (!ok) {
      setPin("");
      window.setTimeout(() => pinRef.current?.focus(), 50);
    }
  }

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center p-6 relative
                    bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100
                    selection:bg-cyan-500/30"
    >
      <div className="app-panel flex w-full max-w-md flex-col items-center p-6 sm:p-8">
        <div className="app-kicker mb-5">Acceso seguro</div>

        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className="mb-4 size-20 drop-shadow-sm"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            className="text-cyan-300"
            fillRule="evenodd"
            d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3A5.25 5.25 0 0 0 12 1.5Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z"
            clipRule="evenodd"
          />
        </svg>

        <h1 className="app-title text-center text-3xl">Ingresar PIN</h1>
        <p className="mt-3 max-w-sm text-center text-sm text-slate-300">
          Usa el PIN de 4 digitos guardado en el ESP para entrar al panel.
        </p>

        <form
          className="mt-8 flex w-full flex-col items-center gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            sendLoginAttempt();
          }}
        >
          <label htmlFor="pin" className="sr-only">
            PIN de acceso
          </label>
          <input
            ref={pinRef}
            id="pin"
            value={pin}
            onChange={(event) => handlePinChange(event.target.value)}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            autoComplete="one-time-code"
            autoFocus
            className="sr-only"
          />

          <button
            type="button"
            className="grid w-full grid-cols-4 gap-3"
            onClick={() => pinRef.current?.focus()}
            aria-label="Editar PIN"
          >
            {Array.from({ length: 4 }).map((_, index) => (
              <span
                key={index}
                className={`app-panel-strong flex aspect-square items-center justify-center text-3xl font-black ${
                  pin[index] ? "text-cyan-200" : "text-slate-500"
                }`}
              >
                {pin[index] ? "•" : index + 1}
              </span>
            ))}
          </button>

          {status === "error" ? (
            <p className="text-sm font-semibold text-rose-300">
              PIN incorrecto o sin respuesta del ESP.
            </p>
          ) : (
            <p className="text-sm text-slate-400">Escribi los 4 digitos con el teclado.</p>
          )}

          <button
            type="submit"
            disabled={!valid || status === "loading"}
            className="app-button w-full px-4 py-3 text-base font-bold"
          >
            {status === "loading" ? "Validando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
