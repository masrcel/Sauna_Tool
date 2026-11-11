import { User } from '../types';

export function getToken() { return localStorage.getItem('token'); }
export function setToken(t: string) { localStorage.setItem('token', t); }
export function clearToken() { localStorage.removeItem('token'); }

export function getStoredUser(): User | null {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
}
export function setStoredUser(u: User) { localStorage.setItem('user', JSON.stringify(u)); }
export function clearUser() { localStorage.removeItem('user'); }
