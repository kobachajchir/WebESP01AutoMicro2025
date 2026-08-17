import { useUser } from "../contexts/UserContext";
import { Navigate } from "react-router-dom";
import AppLoadingScreen from "./AppLoadingScreen";

export const ProtectedRoute: React.FC<{ children: React.ReactNode; loadingLabel?: string }> = ({
  children,
  loadingLabel = "Cargando dashboard",
}) => {
  const { user, loading } = useUser(); // Tu hook de autenticación

  if (loading) {
    return <AppLoadingScreen label={loadingLabel} />;
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />;
};
