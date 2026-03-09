import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isFreeTier } from "@/lib/subscriptionCheck";

export function useFreeLock() {
  const { user } = useAuth();
  const isFree = isFreeTier(user);
  const [lockMessage, setLockMessage] = useState("");
  const [showModal, setShowModal] = useState(false);

  const guardAction = useCallback(
    (message: string, action: () => void) => {
      if (isFree) {
        setLockMessage(message);
        setShowModal(true);
      } else {
        action();
      }
    },
    [isFree],
  );

  const closeLockModal = useCallback(() => {
    setShowModal(false);
    setLockMessage("");
  }, []);

  return {
    isFree,
    showLockModal: showModal,
    lockMessage,
    guardAction,
    closeLockModal,
  };
}
