import { create } from "zustand";

type KycGateState = {
  action: string;
  visible: boolean;
  hide: () => void;
  show: (action?: string) => void;
};

export const useKycGateStore = create<KycGateState>((set) => ({
  action: "use this feature",
  visible: false,
  hide: () => set({ visible: false }),
  show: (action = "use this feature") => set({ action, visible: true }),
}));

export function showKycRequired(action?: string) {
  useKycGateStore.getState().show(action);
}
