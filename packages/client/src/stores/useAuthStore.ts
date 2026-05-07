import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../lib/api';

export interface User {
  id: string;
  phone: string;
  username: string;
  avatar: string | null;
  createdAt: string;
}

export interface Wallet {
  coins: number;
}

interface AuthState {
  user: User | null;
  wallet: Wallet | null;
  token: string | null;
  isLoading: boolean;

  setAuth: (user: User, wallet: Wallet, token: string) => void;
  logout: () => void;
  refreshMe: () => Promise<void>;
  updateUser: (updates: Partial<Pick<User, 'username' | 'avatar'>>) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      wallet: null,
      token: null,
      isLoading: false,

      setAuth: (user, wallet, token) => {
        localStorage.setItem('bb_token', token);
        set({ user, wallet, token });
      },

      logout: () => {
        localStorage.removeItem('bb_token');
        set({ user: null, wallet: null, token: null });
      },

      refreshMe: async () => {
        try {
          set({ isLoading: true });
          const res = await api.get('/users/me');
          set({
            user: {
              id: res.data.id,
              phone: res.data.phone,
              username: res.data.username,
              avatar: res.data.avatar,
              createdAt: res.data.createdAt,
            },
            wallet: { coins: res.data.wallet.coins },
            isLoading: false,
          });
        } catch {
          set({ isLoading: false });
        }
      },

      updateUser: async (updates) => {
        const res = await api.put('/users/me', updates);
        const current = get().user;
        if (current) {
          set({
            user: { ...current, ...res.data },
          });
        }
      },
    }),
    {
      name: 'buckshot-auth',
      partialize: (state) => ({ token: state.token, user: state.user, wallet: state.wallet }),
    }
  )
);
