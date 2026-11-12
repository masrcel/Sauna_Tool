import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Copy, Download, Eye, MessageCircle, Share2, Sparkles, Check } from 'lucide-react';
import { api } from '../lib/api';
import { DayEvent } from '../types';
import { buildAiPrompt, buildDayPdf, buildDayText, DayExportInput, DayExportOptions, exportFileName } from '../lib/dayExport';

const OPTIONS_KEY = 'day-export-options';
const DEFAULT_OPTIONS: DayExportOptions = { showStaff: true, showDosage: false, hideCancelled: true };

function loadOptions(): DayExportOptions {
  try { return { ...DEFAULT_OPTIONS, ...JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? '{}') }; }
  catch { return DEFAULT_OPTIONS; }
}

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return; }
  catch { /* Fallback für ältere Browser / ohne Clipboard-Berechtigung */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

export default function DayExportModal({ date, event, onClose }: { date: Date; event: DayEvent; onClose: () => void }) {
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/settings')).data,
  });
  const [options, setOptions] = useState<DayExportOptions>(loadOptions);
  const [pdf, setPdf] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // date ist beim Aufrufer oft bei jedem Rendern ein neues Objekt – nur auf den Wert reagieren
  const dayKey = format(date, 'yyyy-MM-dd');
  const input: DayExportInput = useMemo(() => ({
    date,
    event,
    appName: settings?.app_name || 'Sauna Aufguss Manager',
    primaryColor: settings?.primary_color || '#d97d1d',
    options,
  }), [dayKey, event, settings, options]); // eslint-disable-line react-hooks/exhaustive-deps

  // PDF vorab erzeugen: „Teilen“ muss direkt im Klick passieren (iOS verwirft navigator.share sonst)
  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setPdf(null);
    setError(null);
    buildDayPdf(input)
      .then(blob => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPdf({ blob, url });
      })
      .catch(err => { if (!cancelled) setError(err?.message ?? String(err)); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [input]);

  const setOption = (key: keyof DayExportOptions, value: boolean) => {
    const next = { ...options, [key]: value };
    setOptions(next);
    try { localStorage.setItem(OPTIONS_KEY, JSON.stringify(next)); } catch { /* egal */ }
  };

  const fileName = exportFileName(date);
  const file = useMemo(() => (pdf ? new File([pdf.blob], fileName, { type: 'application/pdf' }) : null), [pdf, fileName]);
  const canShareFile = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: `Aufgussplan ${format(date, 'dd.MM.yyyy')}` });
    } catch (err: any) {
      if (err?.name !== 'AbortError') alert(`Teilen nicht möglich: ${err?.message ?? err}`);
    }
  };

  const download = () => {
    if (!pdf) return;
    const a = document.createElement('a');
    a.href = pdf.url;
    a.download = fileName;
    a.click();
  };

  const copyForAi = async () => {
    await copyText(buildAiPrompt(input));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const whatsappText = `https://wa.me/?text=${encodeURIComponent(buildDayText(input, true))}`;

  const checkbox = (key: keyof DayExportOptions, label: string) => (
    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-stone-300 cursor-pointer">
      <input type="checkbox" className="w-4 h-4 accent-sauna-600" checked={options[key]} onChange={e => setOption(key, e.target.checked)} />
      {label}
    </label>
  );

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel max-w-lg">
        <div>
          <h3 className="font-display text-xl font-bold">Tag exportieren</h3>
          <p className="text-sm text-gray-500 dark:text-stone-400">{format(date, 'EEEE, dd. MMMM yyyy', { locale: de })}</p>
        </div>

        <div className="flex flex-col gap-2 bg-gray-100/70 dark:bg-stone-800/50 p-3 rounded-xl">
          {checkbox('showStaff', 'Aufgießer anzeigen')}
          {checkbox('showDosage', 'Dosierung der Düfte anzeigen')}
          {checkbox('hideCancelled', 'Abgesagte Aufgüsse ausblenden')}
        </div>

        {error && <p className="text-sm text-red-500">PDF konnte nicht erstellt werden: {error}</p>}

        <div className="flex flex-col gap-2">
          <span className="label mb-0">PDF</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {canShareFile && (
              <button onClick={share} disabled={!pdf} className="btn-primary flex items-center justify-center gap-2 sm:col-span-2 disabled:opacity-50">
                <Share2 className="w-4 h-4" /> Teilen (z. B. WhatsApp)
              </button>
            )}
            <button onClick={download} disabled={!pdf} className={`${canShareFile ? 'btn-secondary' : 'btn-primary'} flex items-center justify-center gap-2 disabled:opacity-50`}>
              <Download className="w-4 h-4" /> {pdf ? 'Herunterladen' : 'Wird erstellt…'}
            </button>
            <a
              href={pdf?.url}
              target="_blank"
              rel="noopener"
              aria-disabled={!pdf}
              className={`btn-secondary flex items-center justify-center gap-2 ${pdf ? '' : 'pointer-events-none opacity-50'}`}
            >
              <Eye className="w-4 h-4" /> Vorschau
            </a>
          </div>
          {!canShareFile && pdf && (
            <p className="text-xs text-gray-500 dark:text-stone-400">
              Direktes Teilen geht nur auf dem Handy. Am PC: PDF herunterladen und in WhatsApp Web als Dokument anhängen.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="label mb-0">Als Text</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <a href={whatsappText} target="_blank" rel="noopener noreferrer" className="btn-secondary flex items-center justify-center gap-2">
              <MessageCircle className="w-4 h-4" /> Text per WhatsApp
            </a>
            <button onClick={copyForAi} className="btn-secondary flex items-center justify-center gap-2">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Sparkles className="w-4 h-4" />}
              {copied ? 'Kopiert!' : 'Für KI kopieren'}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-stone-400 flex gap-1.5">
            <Copy className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            „Für KI kopieren“ kopiert den Plan samt fertiger Anweisung. Einfach in ChatGPT, Claude o. Ä. einfügen,
            dann wird daraus eine Grafik für WhatsApp-Status oder ein Aushang gestaltet.
          </p>
        </div>

        <div className="flex justify-end">
          <button onClick={onClose} className="btn-secondary">Schließen</button>
        </div>
      </div>
    </div>
  );
}
