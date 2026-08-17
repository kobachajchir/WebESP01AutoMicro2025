// PublicRoute.tsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import AppLoadingScreen from "./AppLoadingScreen";

export const PublicRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, loading } = useUser();

  if (loading) {
    return <AppLoadingScreen label="Cargando login" />;
  }

  return !user ? <>{children}</> : <Navigate to="/home" replace />;
};
