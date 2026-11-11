import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) { return clsx(inputs); }

export function formatTime(time: string): string {
  return time?.substring(0, 5) ?? '';
}

export function statusColor(status: string): string {
  switch (status) {
    case 'läuft': return 'bg-green-500';
    case 'fertig': return 'bg-gray-400';
    case 'abgesagt': return 'bg-red-400';
    default: return 'bg-sauna-500';
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'läuft': return 'Läuft';
    case 'fertig': return 'Fertig';
    case 'abgesagt': return 'Abgesagt';
    default: return 'Geplant';
  }
}

export function categoryLabel(cat: string): string {
  switch (cat) {
    case 'duft': return 'Duft';
    case 'zeremonie': return 'Zeremonie';
    case 'musik': return 'Musik';
    default: return 'Sonstiges';
  }
}

export function categoryColor(cat: string): string {
  switch (cat) {
    case 'duft': return 'bg-amber-100 text-amber-800';
    case 'zeremonie': return 'bg-purple-100 text-purple-800';
    case 'musik': return 'bg-blue-100 text-blue-800';
    default: return 'bg-gray-100 text-gray-700';
  }
}

export function avatarFallback(name: string): string {
  return name?.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase() ?? '?';
}

/** Sekunden bis zum Start (start_time im Format HH:MM[:SS]) relativ zu now */
export function secondsUntil(startTime: string, now: Date): number {
  const [h, m, sec] = startTime.split(':').map(Number);
  const start = new Date(now);
  start.setHours(h, m, sec || 0, 0);
  return Math.floor((start.getTime() - now.getTime()) / 1000);
}

/** Formatiert Sekunden als M:SS */
export function formatCountdown(secs: number): string {
  const s = Math.max(0, secs);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
