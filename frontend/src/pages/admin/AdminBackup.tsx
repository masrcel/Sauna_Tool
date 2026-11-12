import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { clearToken, clearUser } from '../../lib/auth';
import { cn } from '../../lib/utils';
import { DatabaseBackup, Download, RotateCcw, Trash2, Upload, AlertTriangle, Info } from 'lucide-react';

interface BackupInfo {
  name: string;
  kind: 'auto' | 'manuell' | 'vor-wiederherstellung';
  size: number;
  created_at: string;
}

interface BackupSummary {
  created_at: string;
  app_version?: string;
  mitarbeiter: number;
  saunen: number;
  duefte: number;
  vorlagen: number;
  tage: number;
  aufguesse: number;
  ideen: number;
  tagesvorlagen: number;
  dateien: number;
}

const KIND_LABELS: Record<BackupInfo['kind'], { label: string; style: string }> = {
  auto: { label: 'Automatisch', style: 'bg-gray-100 text-gray-600 dark:bg-stone-800 dark:text-stone-300' },
  manuell: { label: 'Manuell', style: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  'vor-wiederherstellung': { label: 'Vor Wiederherstellung', style: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
};

const CONFIRM_WORD = 'WIEDERHERSTELLEN';

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function errorText(err: any) {
  return err?.response?.data?.error ?? 'Unbekannter Fehler';
}

/** Nach der Wiederherstellung sind alle Anmeldungen ungültig → neu anmelden */
function logoutAfterRestore() {
  clearToken();
  clearUser();
  window.location.href = '/admin/login';
}

export default function AdminBackup() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [restoreTarget, setRestoreTarget] = useState<{ source: 'server'; name: string } | { source: 'file'; file: File; summary: BackupSummary } | null>(null);

  const { data } = useQuery<{ backups: BackupInfo[]; keep_days: number; hour: number }>({
    queryKey: ['backups'],
    queryFn: async () => (await api.get('/backup')).data,
  });
  const backups = data?.backups ?? [];

  const create = useMutation({
    mutationFn: () => api.post('/backup'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups'] }),
    onError: err => alert(`Backup fehlgeschlagen: ${errorText(err)}`),
  });

  const remove = useMutation({
    mutationFn: (name: string) => api.delete(`/backup/${encodeURIComponent(name)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups'] }),
    onError: err => alert(`Löschen fehlgeschlagen: ${errorText(err)}`),
  });

  const inspect = useMutation({
    mutationFn: async (file: File) => {
      const res = await api.post('/backup/inspect', file, { headers: { 'Content-Type': 'application/octet-stream' } });
      return { file, summary: res.data as BackupSummary };
    },
    onSuccess: ({ file, summary }) => setRestoreTarget({ source: 'file', file, summary }),
    onError: err => alert(`Datei kann nicht gelesen werden: ${errorText(err)}`),
  });

  async function download(name: string) {
    try {
      const res = await api.get(`/backup/${encodeURIComponent(name)}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Download fehlgeschlagen: ${errorText(err)}`);
    }
  }

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-6 max-w-4xl">
      <div className="page-header">
        <div>
          <h2 className="font-display text-2xl font-bold">Backup</h2>
          <p className="text-gray-500 dark:text-stone-500 text-sm mt-1">Datensicherung und Wiederherstellung</p>
        </div>
        <button onClick={() => create.mutate()} disabled={create.isPending} className="btn-primary flex items-center gap-2">
          <DatabaseBackup className="w-4 h-4" /> {create.isPending ? 'Erstelle …' : 'Backup jetzt erstellen'}
        </button>
      </div>

      <div className="card p-4 flex gap-3 text-sm text-gray-600 dark:text-stone-300">
        <Info className="w-5 h-5 shrink-0 text-sauna-600" />
        <div className="flex flex-col gap-1">
          <p>
            {data && data.hour >= 0
              ? <>Jede Nacht ab <strong>{data.hour}:00 Uhr</strong> wird automatisch ein Backup erstellt und <strong>{data.keep_days} Tage</strong> aufbewahrt. Manuelle Backups bleiben, bis du sie löschst.</>
              : <>Automatische Backups sind ausgeschaltet (BACKUP_HOUR=-1).</>}
          </p>
          <p>Ein Backup enthält alle Daten (Pläne, Vorlagen, Düfte, Mitarbeiter, Einstellungen), die Profilbilder und das Protokoll.</p>
          <p className="text-gray-500 dark:text-stone-400">
            Tipp: Lade regelmäßig ein Backup herunter und bewahre es <strong>außerhalb des Servers</strong> auf. Fällt der Server aus, sind die Backups dort sonst auch weg.
          </p>
        </div>
      </div>

      {/* Liste */}
      <section className="flex flex-col gap-2">
        <h3 className="font-display text-lg font-bold">Backups auf dem Server</h3>
        {backups.map(b => {
          const kind = KIND_LABELS[b.kind];
          return (
            <div key={b.name} className="card p-3 sm:p-4 flex flex-wrap sm:flex-nowrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 dark:text-stone-100 font-medium">{fmtDateTime(b.created_at)}</p>
                <p className="text-gray-400 dark:text-stone-500 text-xs font-mono truncate">{b.name} · {fmtSize(b.size)}</p>
              </div>
              <span className={cn('badge shrink-0', kind.style)}>{kind.label}</span>
              <div className="flex gap-2">
                <button onClick={() => download(b.name)} className="btn-secondary p-2" title="Herunterladen"><Download className="w-4 h-4" /></button>
                <button onClick={() => setRestoreTarget({ source: 'server', name: b.name })} className="btn-secondary p-2" title="Wiederherstellen"><RotateCcw className="w-4 h-4" /></button>
                <button onClick={() => { if (confirm(`Backup vom ${fmtDateTime(b.created_at)} löschen?`)) remove.mutate(b.name); }} className="btn-danger p-2" title="Löschen"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
        {backups.length === 0 && <p className="text-gray-400 dark:text-stone-500 text-center py-8">Noch keine Backups vorhanden.</p>}
      </section>

      {/* Upload */}
      <section className="card p-4 flex flex-col gap-3">
        <h3 className="font-display text-lg font-bold">Aus Datei wiederherstellen</h3>
        <p className="text-sm text-gray-500 dark:text-stone-400">Eine zuvor heruntergeladene Backup-Datei (<span className="font-mono">.json.gz</span>) einspielen, z. B. nach einem Serverumzug.</p>
        <input
          ref={fileRef}
          type="file"
          accept=".gz,.json,application/gzip,application/json"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) inspect.mutate(f);
          }}
        />
        <div>
          <button onClick={() => fileRef.current?.click()} disabled={inspect.isPending} className="btn-secondary flex items-center gap-2">
            <Upload className="w-4 h-4" /> {inspect.isPending ? 'Prüfe Datei …' : 'Datei auswählen'}
          </button>
        </div>
      </section>

      {restoreTarget && <RestoreDialog target={restoreTarget} onClose={() => setRestoreTarget(null)} />}
    </div>
  );
}

function RestoreDialog({ target, onClose }: {
  target: { source: 'server'; name: string } | { source: 'file'; file: File; summary: BackupSummary };
  onClose: () => void;
}) {
  const [word, setWord] = useState('');
  const [error, setError] = useState('');

  const restore = useMutation({
    mutationFn: async () => target.source === 'server'
      ? api.post(`/backup/${encodeURIComponent(target.name)}/restore`)
      : api.post('/backup/restore', target.file, {
          headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(target.file.name) },
        }),
    onSuccess: () => {
      alert('Die Daten wurden wiederhergestellt. Vorher wurde automatisch eine Sicherheitskopie des alten Stands angelegt.\n\nBitte melde dich neu an.');
      logoutAfterRestore();
    },
    onError: err => setError(errorText(err)),
  });

  const s = target.source === 'file' ? target.summary : null;

  return (
    <div className="modal-backdrop">
      <div className="modal-panel max-w-lg">
        <h3 className="font-display text-xl font-bold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" /> Daten wiederherstellen
        </h3>
        <p className="text-sm text-gray-600 dark:text-stone-300">
          Alle aktuellen Daten werden durch den Stand aus{' '}
          {target.source === 'server' ? <span className="font-mono break-all">{target.name}</span> : <span className="font-mono break-all">{target.file.name}</span>}{' '}
          <strong>ersetzt</strong>. Änderungen seit diesem Backup gehen verloren.
        </p>
        {s && (
          <div className="text-sm bg-gray-50 dark:bg-stone-800/60 rounded-xl p-3 grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-gray-500 dark:text-stone-400">Erstellt</span><span>{fmtDateTime(s.created_at)}</span>
            {s.app_version && <><span className="text-gray-500 dark:text-stone-400">Version</span><span>v{s.app_version}</span></>}
            <span className="text-gray-500 dark:text-stone-400">Mitarbeiter</span><span>{s.mitarbeiter}</span>
            <span className="text-gray-500 dark:text-stone-400">Saunen</span><span>{s.saunen}</span>
            <span className="text-gray-500 dark:text-stone-400">Düfte</span><span>{s.duefte}</span>
            <span className="text-gray-500 dark:text-stone-400">Aufguss-Vorlagen</span><span>{s.vorlagen}</span>
            <span className="text-gray-500 dark:text-stone-400">Geplante Aufgüsse</span><span>{s.aufguesse} an {s.tage} Tagen</span>
            <span className="text-gray-500 dark:text-stone-400">Tagesvorlagen</span><span>{s.tagesvorlagen}</span>
            <span className="text-gray-500 dark:text-stone-400">Ideen</span><span>{s.ideen}</span>
            <span className="text-gray-500 dark:text-stone-400">Profilbilder</span><span>{s.dateien}</span>
          </div>
        )}
        <ul className="text-sm text-gray-500 dark:text-stone-400 list-disc pl-5 flex flex-col gap-1">
          <li>Vorher wird automatisch eine Sicherheitskopie des aktuellen Stands angelegt.</li>
          <li>Das Protokoll bleibt vollständig erhalten.</li>
          <li>Alle Mitarbeiter werden abgemeldet und müssen sich neu anmelden (mit den Passwörtern aus dem Backup).</li>
        </ul>
        <div>
          <label className="label">Zur Bestätigung <span className="font-mono">{CONFIRM_WORD}</span> eintippen</label>
          <input className="input font-mono" value={word} onChange={e => setWord(e.target.value)} autoFocus />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-3 justify-end [&>button]:flex-1 sm:[&>button]:flex-none">
          <button onClick={onClose} disabled={restore.isPending} className="btn-secondary">Abbrechen</button>
          <button onClick={() => restore.mutate()} disabled={word !== CONFIRM_WORD || restore.isPending} className="btn-danger disabled:opacity-40">
            {restore.isPending ? 'Stelle wieder her …' : 'Jetzt wiederherstellen'}
          </button>
        </div>
      </div>
    </div>
  );
}
