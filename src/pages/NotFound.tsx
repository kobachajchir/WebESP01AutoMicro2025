import { Link } from "react-router-dom";
import logoDashboard from "../assets/LogoDashboard.webp";
import "./NotFound.css";

export default function NotFound() {
  return (
    <main className="not-found-screen">
      <div className="not-found-screen__grid" aria-hidden="true" />
      <div className="not-found-screen__glow" aria-hidden="true" />

      <section className="not-found-card" aria-labelledby="not-found-title">
        <div className="not-found-card__logo-shell">
          <img
            className="not-found-card__logo"
            src={logoDashboard}
            alt="Auto Microcontroladores"
          />
        </div>

        <div className="not-found-card__status">
          <span aria-hidden="true" />
          Ruta no disponible
        </div>

        <p className="not-found-card__code" aria-label="Error 404">
          404
        </p>
        <h1 id="not-found-title">No encontramos esta pantalla</h1>
        <p className="not-found-card__description">
          La dirección puede haber cambiado o ya no estar disponible. Volvé al panel
          principal para continuar controlando el sistema.
        </p>

        <Link className="not-found-card__action" to="/home">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3.75 11.25 12 4.5l8.25 6.75v8.25a.75.75 0 0 1-.75.75h-5.25v-5.5h-4.5v5.5H4.5a.75.75 0 0 1-.75-.75v-8.25Z" />
          </svg>
          Volver al dashboard
          <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  );
}
