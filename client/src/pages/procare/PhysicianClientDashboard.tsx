import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import ClinicianClientDashboard from "@/pages/pro/ClinicianClientDashboard";

export default function PhysicianClientDashboard() {
  const [, params] = useRoute("/procare/physician/clients/:id");
  const clientId = params?.id as string;

  useEffect(() => {
    localStorage.setItem("mpm_pro_portal_type", "physician");
    localStorage.setItem("mpm_pro_portal_back_path", `/procare/physician`);
    localStorage.setItem("mpm_pro_client_back_path", `/procare/physician/clients/${clientId}`);
  }, [clientId]);

  return <ClinicianClientDashboard portalBackPath="/procare/physician" />;
}
