// src/router/NavigateVT.tsx
import { useEffect } from "react";
import type { To } from "react-router-dom";
import { useNavigate } from "react-router-dom";

type NavigateVTProps = {
  to: To;
  replace?: boolean;
  state?: any;
};

export default function NavigateVT({ to, replace = false, state }: NavigateVTProps) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace, state, viewTransition: true });
  }, [navigate, to, replace, state]);
  return null;
}
