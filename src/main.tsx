import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { WebSocketProvider } from './contexts/WebSocketContext.tsx';
import { UserProvider } from './contexts/UserContext.tsx';

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WebSocketProvider url={`ws://${window.location.hostname}/ws`}>
      <UserProvider>
        <App />
      </UserProvider>
    </WebSocketProvider>
  </StrictMode>
);
