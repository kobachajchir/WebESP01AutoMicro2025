import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { IrEmittersProvider } from "./contexts/IrEmittersContext";
import App from './App.tsx'
import { WebSocketProvider } from './contexts/WebSocketContext.tsx';
import { UserProvider } from './contexts/UserContext.tsx';
import { ScreenProvider } from './contexts/ScreenContext.tsx';
import { ScreenStreamModalProvider } from "./contexts/ScreenStreamModalContext.tsx";
import { CarModeProvider } from "./contexts/CarModeContext.tsx";
import { SavedOledScreensProvider } from "./contexts/SavedOledScreensContext.tsx";
import { WifiCredentialsProvider } from "./contexts/WifiCredentialsContext.tsx";
import { EspWifiStatusProvider } from "./contexts/EspWifiStatusContext.tsx";
import { resolveWebSocketUrl } from "./protocol/wsApi.ts";

const wsUrl =
  import.meta.env.VITE_WS_MOCK === "true"
    ? "mock://local"
    : resolveWebSocketUrl(import.meta.env.VITE_WS_URL);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
      <WebSocketProvider url={wsUrl}>
        <EspWifiStatusProvider>
          <UserProvider>
            <IrEmittersProvider>
            <WifiCredentialsProvider>
              <CarModeProvider>
                <ScreenProvider>
                  <SavedOledScreensProvider>
                    <ScreenStreamModalProvider>
                      <App />
                    </ScreenStreamModalProvider>
                  </SavedOledScreensProvider>
                </ScreenProvider>
              </CarModeProvider>
            </WifiCredentialsProvider>
          </IrEmittersProvider>
          </UserProvider>
        </EspWifiStatusProvider>
      </WebSocketProvider>
  </StrictMode>,
);
