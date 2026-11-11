import { useEffect, useRef, useState } from "react";
import { mealShoppingCapabilities, sendShoppingSelections, shoppingAccount } from "@/lib/mealShoppingApi";
import type { ShoppingSelection, TransferResult } from "@shared/mealShoppingSelection";

export function useMealShopping() {
  const account = shoppingAccount();
  const [capability, setCapability] = useState<{ available: boolean; reason?: string; checked: boolean; legacyAllowed?: boolean }>({ available: false, checked: false });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<TransferResult | null>(null);
  const lock = useRef(false);
  const epoch = useRef(0);
  const currentAccount = useRef(account);
  currentAccount.current = account;
  useEffect(() => {
    let mounted = true;
    epoch.current++; lock.current = false; setPending(false);
    setResult(null); setMessage(""); setCapability({ available: false, checked: false });
    mealShoppingCapabilities().then(value => {
      if (mounted) setCapability({ ...value, checked: true, legacyAllowed: !value.available });
    }).catch(() => { if (mounted) setCapability({ available: false, checked: true, reason: "Shopping readiness could not be confirmed. Please reload." }); });
    return () => { mounted = false; };
  }, [account]);
  async function send(selections: ShoppingSelection[], update = false) {
    if (lock.current || !capability.available) return null;
    const owner = account;
    const requestEpoch = epoch.current;
    const versions = new Map(result?.results.map(r => [r.selectionId, r.version]) || []);
    lock.current = true; setPending(true); setMessage("");
    setResult(null);
    try {
      const response = await sendShoppingSelections(selections.map(s => update
        ? { ...s, ...(versions.get(s.selectionId) ? { expectedVersion: versions.get(s.selectionId) } : {}) } : s), update ? "replace" : "add");
      if (owner !== currentAccount.current || requestEpoch !== epoch.current) return null;
      setResult(response);
      setMessage(!response.committed ? "Recipe or servings changed. Select Update Shopping to replace only this selection's ingredients."
        : response.results.every(r => r.status === "already_added") ? "Already on your shopping list."
        : "Saved to your shopping list.");
      return response;
    } catch (error) {
      if (owner === currentAccount.current && requestEpoch === epoch.current) setMessage((error as Error).message || "Shopping was not saved. Please retry.");
      return null;
    } finally {
      if (requestEpoch === epoch.current) { lock.current = false; if (owner === currentAccount.current) setPending(false); }
    }
  }
  return { ...capability, pending, message, result, send };
}
