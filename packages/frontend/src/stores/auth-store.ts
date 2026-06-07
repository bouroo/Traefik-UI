import { create } from 'zustand';

export interface AuthUser {
  id: number;
  username: string;
  source: string;
  email: string | null;
  is_active: boolean;
  isAdmin: boolean;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  permissions: string[];
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  setUser: (user: AuthUser) => void;
  setPermissions: (permissions: string[]) => void;
  loadFromStorage: () => Promise<void>;
}

const TOKEN_KEY = 'traefik_ui_token';

async function fetchMe(token: string): Promise<{ user: AuthUser; permissions: string[] }> {
  const response = await fetch('/api/auth/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }
  const data = await response.json();
  return {
    user: {
      id: data.user.id,
      username: data.user.username,
      source: data.user.source,
      email: data.user.email,
      is_active: data.user.is_active === 1 || data.user.is_active === true,
      isAdmin: data.user.is_admin === 1 || data.user.is_admin === true,
    },
    permissions: data.permissions || [],
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  permissions: [],
  isLoading: true,

  login: async (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    try {
      const { user, permissions } = await fetchMe(token);
      set({ token, user, permissions, isLoading: false });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      set({ token: null, user: null, permissions: [], isLoading: false });
      throw new Error('Session expired');
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, user: null, permissions: [], isLoading: false });
  },

  setUser: (user: AuthUser) => {
    set({ user });
  },

  setPermissions: (permissions: string[]) => {
    set({ permissions });
  },

  loadFromStorage: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      try {
        const { user, permissions } = await fetchMe(token);
        set({ token, user, permissions, isLoading: false });
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        set({ token: null, user: null, permissions: [], isLoading: false });
      }
    } else {
      set({ token: null, user: null, permissions: [], isLoading: false });
    }
  },
}));
