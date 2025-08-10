import { useUser } from "../contexts/UserContext";
import NavigateVT from "./NavigateVT";

export default function RedirectRoot() {
  const { user, loading } = useUser();
  if (loading) return null;
  return user ? (
    <NavigateVT to="/home" replace />
  ) : (
    <NavigateVT to="/login" replace />
  );
}

