import { useUser } from "../contexts/UserContext";
import { Navigate } from "react-router-dom";
import AppLoadingScreen from "./AppLoadingScreen";

export default function RedirectRoot() {
  const { user, loading } = useUser();
  if (loading) return <AppLoadingScreen label="Cargando login" />;
  return user ? (
    <Navigate to="/home" replace />
  ) : (
    <Navigate to="/login" replace />
  );
}
