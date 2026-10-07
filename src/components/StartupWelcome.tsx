import { useEffect, useLayoutEffect, useRef, useState, type PropsWithChildren } from "react";
import { createPortal } from "react-dom";

import autoMicroLogo from "../assets/LogoDashboardV2.webp";
import "./StartupWelcome.css";

export default function StartupWelcome({ children }: PropsWithChildren) {
  const [visible, setVisible] = useState(true);
  const [logoReady, setLogoReady] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    content.inert = visible;
    return () => { content.inert = false; };
  }, [visible]);

  useEffect(() => {
    if (logoRef.current?.complete && logoRef.current.naturalWidth > 0) {
      setLogoReady(true);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    // Liberar la página aunque falle la imagen o no llegue animationend.
    const timeout = window.setTimeout(() => setVisible(false), 4000);
    return () => window.clearTimeout(timeout);
  }, [visible]);

  return (
    <>
      <div
        aria-hidden={visible || undefined}
        className="startup-welcome-content"
        ref={contentRef}
      >
        {children}
      </div>
      {visible && createPortal(
        <div
          aria-label="Bienvenido a AutoMicro"
          className="startup-welcome"
          data-ready={logoReady}
          onAnimationEnd={event => {
            if (event.target === event.currentTarget && event.animationName === "startup-welcome-veil-out") {
              setVisible(false);
            }
          }}
          role="status"
        >
          <div aria-hidden="true" className="startup-welcome__logo">
            <img
              alt=""
              decoding="async"
              fetchPriority="high"
              height={512}
              loading="eager"
              onError={() => setVisible(false)}
              onLoad={() => setLogoReady(true)}
              ref={logoRef}
              src={autoMicroLogo}
              width={768}
            />
            <span className="startup-welcome__brand">AutoMicro</span>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
