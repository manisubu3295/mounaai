import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  upgradeModalOpen: boolean;
  upgradeFeature: string | null;
  toggleSidebar: () => void;
  openUpgradeModal: (feature?: string) => void;
  closeUpgradeModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  upgradeModalOpen: false,
  upgradeFeature: null,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  openUpgradeModal: (feature) =>
    set({ upgradeModalOpen: true, upgradeFeature: feature ?? null }),

  closeUpgradeModal: () =>
    set({ upgradeModalOpen: false, upgradeFeature: null }),
}));
