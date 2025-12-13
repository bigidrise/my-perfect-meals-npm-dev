import { useEffect } from "react";
import { useLocation } from "wouter";
import { forceScrollToTop } from "@/utils/scrollToTop";

export default function ScrollManager() {
  const [location] = useLocation();

  // Force browser to not restore scroll
  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    return () => {
      if ("scrollRestoration" in history) {
        history.scrollRestoration = "auto";
      }
    };
  }, []);

  // Scroll to top on every route change
  useEffect(() => {
    forceScrollToTop(location);
  }, [location]);

  return null;
}