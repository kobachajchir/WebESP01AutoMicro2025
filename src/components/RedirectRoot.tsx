import { useUser } from "../contexts/UserContext";
import NavigateVT from "./NavigateVT";
import AppLoadingScreen from "./AppLoadingScreen";

export default function RedirectRoot() {
  const { user, loading } = useUser();
  if (loading) return <AppLoadingScreen label="Cargando login" />;
  return user ? (
    <NavigateVT to="/home" replace />
  ) : (
    <NavigateVT to="/login" replace />
  );
}

