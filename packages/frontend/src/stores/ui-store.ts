import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface UiState {
  sidebarOpen: boolean;
  theme: Theme;
  toggleSidebar: () => void;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const THEME_KEY = 'traefik_ui_theme';

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  theme: getInitialTheme(),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem(THEME_KEY, next);
      return { theme: next };
    }),

  setTheme: (theme: Theme) => {
    localStorage.setItem(THEME_KEY, theme);
    set({ theme });
  },
}));
