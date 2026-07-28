// src/App.tsx
import { lazy, Suspense, useEffect, useMemo, type ReactNode } from "react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { useUser } from "./contexts/UserContext";
import "./App.css";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicRoute } from "./components/PublicRoute";
//import AppFooter from "./components/AppFooter";
import RedirectRoot from "./components/RedirectRoot";
import RootLayout from "./components/RootLayout";
import AppLoadingScreen from "./components/AppLoadingScreen";
import {
  applyThemeColors,
  applyThemeMode,
  loadThemeColors,
  loadThemeMode,
} from "./utils/theme";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const WifiSection = lazy(() => import("./pages/WifiSection"));
const ControlSection = lazy(() => import("./pages/ControlSection"));
const EstadoSection = lazy(() => import("./pages/EstadoSection"));
const DocsSection = lazy(() => import("./pages/DocsSection"));
const DocTopicSection = lazy(() => import("./pages/DocTopicSection"));
const OledEditorSection = lazy(() => import("./pages/OledEditorSection"));
const ProtocolSection = lazy(() => import("./pages/ProtocolSection"));
const TrackFollowerSection = lazy(() => import("./pages/TrackFollowerSection"));

function routeLoader(label: string, children: ReactNode) {
  return <Suspense fallback={<AppLoadingScreen label={label} />}>{children}</Suspense>;
}

const App: React.FC = () => {
  const { user } = useUser();

  useEffect(() => {
    applyThemeMode(loadThemeMode());
    applyThemeColors(loadThemeColors());
  }, []);

  // Conservar el mismo router durante toda la sesion. Recrearlo cuando cambia
  // `user` desmontaba la navegacion justo en el redirect login -> home.
  const router = useMemo(() => createBrowserRouter([
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
              {routeLoader("Cargando login", <Login />)}
            </PublicRoute>
          ),
        },
        {
          path: "home",
          element: (
            <ProtectedRoute loadingLabel="Cargando dashboard">
              {routeLoader("Cargando dashboard", <Home />)}
            </ProtectedRoute>
          ),
        },
        {
          path: "wifi",
          element: (
            <ProtectedRoute loadingLabel="Cargando WiFi">
              {routeLoader("Cargando WiFi", <WifiSection />)}
            </ProtectedRoute>
          ),
        },
        {
          path: "statics",
          element: (
            <ProtectedRoute loadingLabel="Cargando sensores">
              {routeLoader("Cargando sensores", <EstadoSection />)}
            </ProtectedRoute>
          ),
        },
        {
          path: "control",
          element: (
            <ProtectedRoute loadingLabel="Cargando control">
              {routeLoader("Cargando control", <ControlSection />)}
            </ProtectedRoute>
          ),
        },
        {
          path: "provision",
          element: routeLoader("Cargando WiFi", <WifiSection provisioning />),
        },
        {
          path: "seguidor-pista",
          element: (
            <ProtectedRoute loadingLabel="Cargando seguidor">
              {routeLoader("Cargando seguidor", <TrackFollowerSection />)}
            </ProtectedRoute>
          ),
        },
        {
          path: "protocol",
          element: (
            <ProtectedRoute loadingLabel="Cargando UNER Studio">
              {routeLoader("Cargando UNER Studio", <ProtocolSection />)}
            </ProtectedRoute>
          ),
        },
        {
          path: "docs",
          element: (
            <ProtectedRoute loadingLabel="Cargando documentacion">
              {routeLoader("Cargando documentacion", <DocsSection />)}
            </ProtectedRoute>
          ),
        },
        {
          path: "docs/:topicSlug",
          element: (
            <ProtectedRoute loadingLabel="Cargando documentacion">
              {routeLoader("Cargando documentacion", <DocTopicSection />)}
            </ProtectedRoute>
          ),
        },
        {
          path: "oled-editor",
          element: (
            <ProtectedRoute loadingLabel="Cargando OLED Studio">
              {routeLoader("Cargando OLED Studio", <OledEditorSection />)}
            </ProtectedRoute>
          ),
        },
        { path: "notFound", element: <NotFound /> }, // opcional
      ],
    },
  ]), []);

  // Efecto para configurar View Transitions y altura completa
  useEffect(() => {
    if (!("startViewTransition" in document)) {
      console.warn("View Transitions no soportado en este navegador");
    } else {
      console.log("View Transitions soportado en este navegador");
    }
    // Ajusta el root para que ocupe todo el alto visible del navegador sin forzar barras fijas.
    const setFullHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.getElementById("root")?.style.setProperty("--vh", `${vh}px`);
      document
        .getElementById("root")
        ?.style.setProperty("height", `calc(var(--vh, 1vh) * 100)`);
      document.body.style.height = `calc(var(--vh, 1vh) * 100)`;
      document.body.style.overflowX = "hidden";
      document.body.style.overflowY = "auto";
    };
    setFullHeight();
    window.addEventListener("resize", setFullHeight);
    return () => {
      window.removeEventListener("resize", setFullHeight);
      document.body.style.overflowX = "";
      document.body.style.overflowY = "";
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
