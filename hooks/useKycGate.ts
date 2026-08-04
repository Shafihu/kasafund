import { useAuthStore } from "@/stores/useAuthStore";
import { useKycGateStore } from "@/stores/useKycGateStore";
import { useCallback } from "react";

export function useKycGate() {
  const status = useAuthStore((state) => state.user?.identityVerification?.status);
  const show = useKycGateStore((state) => state.show);

  const ensureKyc = useCallback(
    (action: string) => {
      if (status === "verified") return true;
      show(action);
      return false;
    },
    [show, status]
  );

  const guardKyc = useCallback(
    (action: string, onVerified: () => void) => {
      if (!ensureKyc(action)) return false;
      onVerified();
      return true;
    },
    [ensureKyc]
  );

  return { ensureKyc, guardKyc, isKycVerified: status === "verified" };
}
