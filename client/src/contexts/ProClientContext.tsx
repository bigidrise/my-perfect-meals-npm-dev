import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useRoute } from "wouter";
import { proStore, type ClientProfile } from "@/lib/proData";

type ProClientContextValue = {
  clientId: string | null;
  client: ClientProfile | null;
  isProCareMode: boolean;
};

const ProClientContext = createContext<ProClientContextValue>({
  clientId: null,
  client: null,
  isProCareMode: false,
});

export function ProClientProvider({ children }: { children: ReactNode }) {
  const [, trainerParams] = useRoute("/pro/clients/:id/trainer");
  const [, clinicianParams] = useRoute("/pro/clients/:id/clinician");
  const [, gnbParams] = useRoute("/pro/clients/:id/general-nutrition-builder");
  const [, pcbParams] = useRoute("/pro/clients/:id/performance-competition-builder");
  const [, diabeticParams] = useRoute("/pro/clients/:id/diabetic-builder");
  const [, glp1Params] = useRoute("/pro/clients/:id/glp1-builder");
  const [, antiInflamParams] = useRoute("/pro/clients/:id/anti-inflammatory-builder");
  const [, dashParams] = useRoute("/pro/clients/:id");

  const clientId =
    trainerParams?.id ||
    clinicianParams?.id ||
    gnbParams?.id ||
    pcbParams?.id ||
    diabeticParams?.id ||
    glp1Params?.id ||
    antiInflamParams?.id ||
    dashParams?.id ||
    null;

  const value = useMemo<ProClientContextValue>(() => {
    if (!clientId) {
      return { clientId: null, client: null, isProCareMode: false };
    }
    const client = proStore.getClient(clientId) || null;
    return { clientId, client, isProCareMode: true };
  }, [clientId]);

  return (
    <ProClientContext.Provider value={value}>
      {children}
    </ProClientContext.Provider>
  );
}

export function useProClient() {
  return useContext(ProClientContext);
}
