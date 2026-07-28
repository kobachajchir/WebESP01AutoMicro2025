// PublicRoute.tsx
import React from "react";
import NavigateVT from "./NavigateVT"; // ajustá la ruta según dónde lo guardaste
import { useUser } from "../contexts/UserContext";
import AppLoadingScreen from "./AppLoadingScreen";

export const PublicRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, loading } = useUser();

  if (loading) {
    return <AppLoadingScreen label="Cargando login" />;
  }

  return !user ? <>{children}</> : <NavigateVT to="/home" replace />;
};
