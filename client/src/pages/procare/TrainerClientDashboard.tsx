import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import TrainerClientDashboardBase from "@/pages/pro/TrainerClientDashboard";

export default function TrainerClientDashboard() {
  const [, params] = useRoute("/procare/trainer/clients/:id");
  const clientId = params?.id as string;

  useEffect(() => {
    localStorage.setItem("mpm_pro_portal_type", "trainer");
    localStorage.setItem("mpm_pro_portal_back_path", `/procare/trainer`);
    localStorage.setItem("mpm_pro_client_back_path", `/procare/trainer/clients/${clientId}`);
  }, [clientId]);

  return <TrainerClientDashboardBase portalBackPath="/procare/trainer" />;
}
