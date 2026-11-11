import { User } from '../types';

export function getToken() { return localStorage.getItem('token'); }
export function setToken(t: string) { localStorage.setItem('token', t); }
export function clearToken() { localStorage.removeItem('token'); }

// Gemeinsamer Speicher für den angemeldeten Benutzer, damit alle Komponenten
// Änderungen (z. B. neue Rolle nach /auth/me) sofort mitbekommen.
const listeners = new Set<() => void>();
let cachedUser: User | null = readUser();

function readUser(): User | null {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
}
function emit() { listeners.forEach(l => l()); }

export function subscribeUser(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function getStoredUser(): User | null { return cachedUser; }
export function setStoredUser(u: User) {
  cachedUser = u;
  localStorage.setItem('user', JSON.stringify(u));
  emit();
}
export function clearUser() {
  cachedUser = null;
  localStorage.removeItem('user');
  emit();
}
