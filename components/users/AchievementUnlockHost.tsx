import { AchievementBadgeModal } from "@/components/users/AchievementBadge";
import { apiService, type PendingAchievement } from "@/services/apiService";
import { subscribeToAchievementChecks } from "@/services/achievementEvents";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

export function AchievementUnlockHost({ enabled }: { enabled: boolean }) {
  const [achievement, setAchievement] = useState<PendingAchievement | null>(null);
  const checking = useRef(false);
  const acknowledging = useRef(false);
  const current = useRef<PendingAchievement | null>(null);

  const checkForAchievement = useCallback(async () => {
    if (!enabled || checking.current || acknowledging.current || current.current) return;
    checking.current = true;
    try {
      const response = await apiService.getPendingAchievement();
      if (response.data) {
        current.current = response.data;
        setAchievement(response.data);
      }
    } catch {
      // Achievement checks should never interrupt normal app usage.
    } finally {
      checking.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      current.current = null;
      acknowledging.current = false;
      setAchievement(null);
      return;
    }
    void checkForAchievement();
    return subscribeToAchievementChecks(() => void checkForAchievement());
  }, [checkForAchievement, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void checkForAchievement();
    });
    return () => subscription.remove();
  }, [checkForAchievement, enabled]);

  const closeAchievement = async () => {
    const dismissed = current.current;
    current.current = null;
    setAchievement(null);
    if (!dismissed) return;
    acknowledging.current = true;
    try {
      await apiService.markAchievementPresented(dismissed.achievementId);
    } catch {
      // If acknowledgement fails, showing it again next session is safer than losing it.
      acknowledging.current = false;
      return;
    }
    acknowledging.current = false;
    setTimeout(() => void checkForAchievement(), 280);
  };

  return <AchievementBadgeModal badge={achievement} onClose={() => void closeAchievement()} />;
}
