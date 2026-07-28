import { useUser } from "../contexts/UserContext";
import NavigateVT from "./NavigateVT";
import AppLoadingScreen from "./AppLoadingScreen";

export const ProtectedRoute: React.FC<{ children: React.ReactNode; loadingLabel?: string }> = ({
  children,
  loadingLabel = "Cargando dashboard",
}) => {
  const { user, loading } = useUser(); // Tu hook de autenticación

  if (loading) {
    return <AppLoadingScreen label={loadingLabel} />;
  }

  return user ? <>{children}</> : <NavigateVT to="/login" replace />;
};
