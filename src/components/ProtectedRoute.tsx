import { Navigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import NavigateVT from "./NavigateVT";

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, loading } = useUser(); // Tu hook de autenticación

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
          <p className="text-slate-300">Cargando...</p>
        </div>
      </div>
    );
  }

  return user ? <>{children}</> : <NavigateVT to="/login" replace />;
};
