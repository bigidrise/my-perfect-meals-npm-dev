import { useEffect } from "react";
import { useLocation } from "wouter";

export default function CoachQueue() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/pro/clients");
  }, []);
  return null;
}
