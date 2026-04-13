import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { WebSocketProvider } from './contexts/WebSocketContext.tsx';
import { UserProvider } from './contexts/UserContext.tsx';
import { UNERProtocolProvider } from './contexts/UNERProtocolContext.tsx';
import { ScreenProvider } from './contexts/ScreenContext.tsx';

const wsUrl =
  import.meta.env.VITE_WS_URL ??
  (import.meta.env.DEV
    ? `ws://${window.location.hostname}/ws/mock`
    : `ws://${window.location.host}/ws`);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WebSocketProvider url={wsUrl}>
      <UNERProtocolProvider>
        <UserProvider>
          <ScreenProvider>
            <App />
          </ScreenProvider>
        </UserProvider>
      </UNERProtocolProvider>
    </WebSocketProvider>
  </StrictMode>
);
