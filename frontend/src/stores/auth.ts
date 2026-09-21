/**
 * 登录状态 Store（Pinia）
 */
import { defineStore } from 'pinia';
import { authApi } from '@/api';
import { TOKEN_KEY } from '@/api/http';
import type { User } from '@/types';

interface AuthState {
  token: string;
  user: User | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: localStorage.getItem(TOKEN_KEY) ?? '',
    user: null,
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
    isAgent: (s) => s.user?.role === 'agent' || s.user?.role === 'admin',
    isAdmin: (s) => s.user?.role === 'admin',
  },
  actions: {
    setSession(token: string, user: User) {
      this.token = token;
      this.user = user;
      localStorage.setItem(TOKEN_KEY, token);
    },
    async login(email: string, password: string) {
      const res = await authApi.login({ email, password });
      this.setSession(res.token, res.user);
    },
    async register(name: string, email: string, password: string) {
      const res = await authApi.register({ name, email, password });
      this.setSession(res.token, res.user);
    },
    async fetchMe() {
      if (!this.token) return null;
      this.user = await authApi.me();
      return this.user;
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem(TOKEN_KEY);
    },
  },
});
