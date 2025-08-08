// src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useUser } from "./contexts/UserContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import "./App.css";
import { useWebSocket } from "./contexts/WebSocketContext";

const App: React.FC = () => {
  const { user } = useUser();
  const { connected } = useWebSocket();

  // Mientras no estemos conectados al WS, mostramos un mensaje de espera
  if (!connected) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-2.5">
        <div
          className="inline-block animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]
          size-24 mb-0 text-white"
          role="status"
        >
        </div>
        <span className="text-white text-2xl">Conectando al servidor de la ESP01...</span>
      </div>
    );
  }

  return (
    <>
      <BrowserRouter>
        <Routes>
          {/* Ruta raíz: si hay user → /home, sino → /login */}
          <Route
            path="/"
            element={
              user ? (
                <Navigate to="/home" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* Login: solo accesible si NO hay user */}
          <Route
            path="/login"
            element={user ? <Login /> : <Navigate to="/home" replace />} //Negar user
          />

          {/* Home: solo accesible si hay user */}
          <Route
            path="/home"
            element={!user ? <Home /> : <Navigate to="/login" replace />} //Sacar negacion de user
          />
        </Routes>
      </BrowserRouter>
    </>
  );
};

export default App;
