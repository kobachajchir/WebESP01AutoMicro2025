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
import ProtocolSection from "./pages/ProtocolSection";
import { applyThemeColors, loadThemeColors } from "./utils/theme";

const App: React.FC = () => {
  const { user } = useUser();

  useEffect(() => {
    applyThemeColors(loadThemeColors());
  }, []);

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
        {
          path: "statics",
          element: (
            <ProtectedRoute>
              <EstadoSection />
            </ProtectedRoute>
          ),
        },
        {
          path: "control",
          element: (
            <ProtectedRoute>
              <ControlSection />
            </ProtectedRoute>
          ),
        },
        {
          path: "protocol",
          element: (
            <ProtectedRoute>
              <ProtocolSection />
            </ProtectedRoute>
          ),
        },
        { path: "notFound", element: <NotFound /> }, // opcional
      ],
    },
  ]);

  // Efecto para configurar View Transitions y altura completa
  useEffect(() => {
    if (!("startViewTransition" in document)) {
      console.warn("View Transitions no soportado en este navegador");
    } else {
      console.log("View Transitions soportado en este navegador");
    }
    // Ajusta el root para que ocupe todo el alto visible del navegador y previene el scroll
    const setFullHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.getElementById("root")?.style.setProperty("--vh", `${vh}px`);
      document
        .getElementById("root")
        ?.style.setProperty("height", `calc(var(--vh, 1vh) * 100)`);
      document.body.style.height = `calc(var(--vh, 1vh) * 100)`;
      document.body.style.overflow = "scroll";
    };
    setFullHeight();
    return () => {
      window.removeEventListener("resize", setFullHeight);
      document.body.style.overflow = "";
      document.body.style.height = "";
    };
  }, []);

  // Efecto para logs de usuario
  useEffect(() => {
    console.log("Usuario autenticado:", user);
  }, [user]);

  return (
    <div className="flex flex-col h-full w-full relative">
      {/* Aquí puedes agregar un Header si es necesario */}
      <RouterProvider router={router} />
      <div className="mt-auto">{/*<AppFooter />*/}</div>
    </div>
  );
};

export default App;
