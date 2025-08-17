// src/App.tsx
import { useEffect } from "react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { useUser } from "./contexts/UserContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import "./App.css";
import WifiSection from "./pages/WifiSection";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicRoute } from "./components/PublicRoute";
//import AppFooter from "./components/AppFooter";
import RedirectRoot from "./components/RedirectRoot";
import RootLayout from "./components/RootLayout";
import ControlSection from "./pages/ControlSection";
import EstadoSection from "./pages/EstadoSection";
import { useWebSocket } from "./hooks/useWebSocket";

const App: React.FC = () => {
  const { user } = useUser();
  const { connected, setConnected } = useWebSocket();

  const router = createBrowserRouter([
    {
      path: "/",
      element: <RootLayout />,
      errorElement: <NotFound />, // ⬅️ cualquier ruta no matcheada cae acá
      children: [
        { index: true, element: <RedirectRoot /> }, // equivale a path="/"
        {
          path: "login",
          element: (
            <PublicRoute>
              <Login />
            </PublicRoute>
          ),
        },
        {
          path: "home",
          element: (
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          ),
        },
        {
          path: "wifi",
          element: (
            <ProtectedRoute>
              <WifiSection />
            </ProtectedRoute>
          ),
        },
        { path: "statics", element: <ProtectedRoute><EstadoSection /></ProtectedRoute> },
        { path: "control", element: <ProtectedRoute><ControlSection /></ProtectedRoute> },
        { path: "notFound", element: <NotFound /> }, // opcional
      ],
    },
  ]);

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
    if (!("startViewTransition" in document)) {
      console.warn("View Transitions no soportado en este navegador");
    }else{
      console.log("View Transitions soportado en este navegador");
    }
    // Ajusta el root para que ocupe todo el alto visible del navegador y previene el scroll
    const setFullHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.getElementById("root")?.style.setProperty("--vh", `${vh}px`);
      document.getElementById("root")?.style.setProperty("height", `calc(var(--vh, 1vh) * 100)`);
      document.body.style.height = `calc(var(--vh, 1vh) * 100)`;
      document.body.style.overflow = "scroll";
    };
    setFullHeight();
    return () => {
      window.removeEventListener("resize", setFullHeight);
      document.body.style.overflow = "";
      document.body.style.height = "";
    }
  }, [])
  

  useEffect(() => {
    console.log("Usuario autenticado:", user);
    /*if(user){
      setUser(null);
    }*/
  }, [user]);

  useEffect(() => {
    // Si ya estamos conectados, no mockeamos nada
    if (connected) return;

    const t = window.setTimeout(() => {
      // Solo forzar si aún NO se conectó de verdad
      setConnected(true);
      console.log("[MOCK] Forzado connected = true después 5 segs");
    }, 10);

    // Si el WS se conecta antes, cancelar el mock
    return () => window.clearTimeout(t);
  }, [connected, setConnected]);

  return (
    <div className="flex flex-col h-full w-full relative">
      {/* Aquí puedes agregar un Header si es necesario */}
      <RouterProvider router={router} />
      <div className="mt-auto">
      {/*<AppFooter />*/}
      </div>
    </div>
  );
};

export default App;
