import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";

export default function ApProvisioningGate() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useUser();

  useEffect(() => {
    if (location.pathname === "/provision") {
      navigate(user ? "/wifi" : "/login", {
        replace: true,
        viewTransition: true,
      });
    }
  }, [location.pathname, navigate, user]);

  return null;
}
