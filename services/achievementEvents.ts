type AchievementListener = () => void;

const listeners = new Set<AchievementListener>();

export function requestAchievementCheck() {
  listeners.forEach((listener) => listener());
}

export function subscribeToAchievementChecks(listener: AchievementListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
