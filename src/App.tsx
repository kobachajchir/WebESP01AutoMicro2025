// src/App.tsx
import React, { use, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useUser } from "./contexts/UserContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import "./App.css";
import { useWebSocket } from "./contexts/WebSocketContext";
import WifiSection from "./pages/WifiSection";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicRoute } from "./components/PublicRoute";

const App: React.FC = () => {
  const { user } = useUser();
  const { connected } = useWebSocket();

  // Mientras no estemos conectados al WS, mostramos un mensaje de espera
  if (!connected) {
    return (
      <div
        className="flex flex-col h-screen w-full items-center justify-center gap-3 p-6 relative
                      bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100
                      selection:bg-cyan-500/30"
      >
        <div
          role="status"
          className="inline-block size-24 rounded-full border-4 border-current border-r-transparent
                    animate-spin motion-reduce:animate-none text-cyan-400"
        />
        <h1
          className="text-2xl md:text-3xl font-extrabold uppercase tracking-tight
                      bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-indigo-400 to-fuchsia-400
                      bg-[length:200%_100%] motion-safe:animate-[gradient-move_6s_linear_infinite] drop-shadow-sm"
        >
          Conectando al servidor de la ESP01...
        </h1>
      </div>
    );
  }

  useEffect(() => {
    console.log("Usuario autenticado:", user);
  }, [user]);

  return (
    <>
      <BrowserRouter>
        <Routes>
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

          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />

          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />

          <Route
            path="/wifi"
            element={
              <ProtectedRoute>
                <WifiSection />
              </ProtectedRoute>
            }
          />

          {`<Route
            path="/statics"
            element={
              <ProtectedRoute>
                <StaticsSection />
              </ProtectedRoute>
            }
          />`}

          {`<Route
            path="/control"
            element={
              <ProtectedRoute>
                <ControlSection />
              </ProtectedRoute>
            }
          />`}

          <Route path="/notFound" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/notFound" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
};

export default App;
