import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { isIosNativeShell } from "@/lib/platform";
import { isStoreKitAvailable } from "@/lib/storekit";

export default function DiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function runDiagnostics() {
      const results: Record<string, string> = {};
      
      try {
        results["Capacitor.getPlatform()"] = Capacitor.getPlatform();
      } catch (e) {
        results["Capacitor.getPlatform()"] = `Error: ${e}`;
      }
      
      try {
        results["Capacitor.isNativePlatform()"] = String(Capacitor.isNativePlatform());
      } catch (e) {
        results["Capacitor.isNativePlatform()"] = `Error: ${e}`;
      }
      
      try {
        const windowCap = (window as any).Capacitor;
        results["window.Capacitor.platform"] = windowCap?.platform ?? "undefined";
        results["window.Capacitor.isNativePlatform()"] = String(windowCap?.isNativePlatform?.() ?? "undefined");
      } catch (e) {
        results["window.Capacitor"] = `Error: ${e}`;
      }
      
      try {
        results["isIosNativeShell()"] = String(isIosNativeShell());
      } catch (e) {
        results["isIosNativeShell()"] = `Error: ${e}`;
      }
      
      try {
        const storeKit = await isStoreKitAvailable();
        results["isStoreKitAvailable()"] = String(storeKit);
      } catch (e) {
        results["isStoreKitAvailable()"] = `Error: ${e}`;
      }
      
      results["User Agent"] = navigator.userAgent;
      results["Timestamp"] = new Date().toISOString();
      
      setDiagnostics(results);
      setLoading(false);
    }
    
    runDiagnostics();
  }, []);

  if (loading) {
    return (
      <div className="p-4 bg-black text-white min-h-screen">
        <h1 className="text-xl font-bold mb-4">Running Diagnostics...</h1>
      </div>
    );
  }

  return (
    <div className="p-4 bg-black text-white min-h-screen">
      <h1 className="text-xl font-bold mb-4">StoreKit Diagnostics</h1>
      <div className="space-y-2 font-mono text-sm">
        {Object.entries(diagnostics).map(([key, value]) => (
          <div key={key} className="border-b border-gray-700 pb-2">
            <div className="text-gray-400">{key}</div>
            <div className="text-green-400 break-all">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 text-gray-500 text-xs">
        Copy this screen to share diagnostics
      </div>
    </div>
  );
}
