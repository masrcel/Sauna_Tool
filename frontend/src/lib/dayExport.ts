import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { DayEvent, ScheduleEntry } from '../types';
import { formatTime } from './utils';

/** Was im Export erscheinen soll – wird im Export-Dialog gewählt */
export interface DayExportOptions {
  showStaff: boolean;
  showDosage: boolean;
  hideCancelled: boolean;
}

export interface DayExportInput {
  date: Date;
  event: DayEvent;
  appName: string;
  primaryColor: string;
  options: DayExportOptions;
}

const entryName = (e: ScheduleEntry) => e.custom_name ?? e.template_name ?? 'Aufguss';
const entrySubtitle = (e: ScheduleEntry) => e.custom_subtitle ?? e.template_subtitle ?? '';

function visibleEntries({ event, options }: DayExportInput): ScheduleEntry[] {
  return [...event.schedule]
    .filter(e => !(options.hideCancelled && e.status === 'abgesagt'))
    .sort((a, b) => a.start_time.localeCompare(b.start_time) || a.sort_order - b.sort_order);
}

function timeRange(e: ScheduleEntry): string {
  return e.end_time ? `${formatTime(e.start_time)} - ${formatTime(e.end_time)}` : formatTime(e.start_time);
}

function scentText(e: ScheduleEntry, showDosage: boolean): string[] {
  return e.scents.map(s => {
    const extras = showDosage
      ? [s.dosage_ml ? `${Math.round(s.dosage_ml)} ml` : '', s.dosage_note ?? ''].filter(Boolean).join(', ')
      : '';
    return extras ? `${s.scent_name} (${extras})` : s.scent_name;
  });
}

export function exportFileName(date: Date): string {
  return `Aufgussplan_${format(date, 'yyyy-MM-dd')}.pdf`;
}

// ---------------------------------------------------------------------------
// Text (WhatsApp / KI)
// ---------------------------------------------------------------------------

/** Plan als Text. `whatsapp` nutzt *fett* und _kursiv_ aus der WhatsApp-Formatierung. */
export function buildDayText(input: DayExportInput, whatsapp = false): string {
  const { date, event, options } = input;
  const b = (s: string) => (whatsapp ? `*${s}*` : s);
  const i = (s: string) => (whatsapp ? `_${s}_` : s);
  const lines: string[] = [
    b(`Aufgussplan – ${format(date, 'EEEE, dd. MMMM yyyy', { locale: de })}`),
  ];
  if (event.title) lines.push(event.title);
  if (event.notes) lines.push(i(event.notes));
  lines.push('');

  for (const e of visibleEntries(input)) {
    const sub = entrySubtitle(e);
    lines.push(`${b(`${timeRange(e)} Uhr`)} · ${entryName(e)}${sub ? ` – ${sub}` : ''}`);
    const details = [e.sauna_name];
    const scents = scentText(e, options.showDosage);
    if (scents.length) details.push(`Düfte: ${scents.join(', ')}`);
    if (options.showStaff && e.staff_name) details.push(`mit ${e.staff_name}`);
    if (e.status === 'abgesagt') details.push('ABGESAGT');
    lines.push(`   ${details.join(' · ')}`);
  }
  return lines.join('\n');
}

/** Fertiger Prompt für ChatGPT, Claude & Co., um aus dem Plan eine Grafik/einen Aushang zu machen */
export function buildAiPrompt(input: DayExportInput): string {
  return [
    `Gestalte aus dem folgenden Aufgussplan unserer Sauna („${input.appName}“) eine ansprechende Grafik im Hochformat (z. B. 1080×1920 px für WhatsApp-Status oder A4 als Aushang).`,
    'Anforderungen:',
    '- Warme, entspannte Sauna-Atmosphäre (Holz, Dampf, Kerzenlicht), aber gut lesbar.',
    '- Uhrzeiten groß und deutlich, chronologisch von oben nach unten.',
    '- Pro Aufguss: Uhrzeit, Name, Sauna und Düfte; Untertitel kleiner.',
    '- Alle Angaben exakt übernehmen – keine Aufgüsse, Zeiten oder Düfte erfinden oder weglassen.',
    '- Texte auf Deutsch.',
    '',
    'Aufgussplan:',
    buildDayText(input, false),
  ].join('\n');
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

/** Die PDF-Standardschriften kennen nur Latin-1: typografische Zeichen ersetzen, Rest (z. B. Emojis) entfernen */
function pdfSafe(s: string): string {
  return s
    .replace(/[–—−]/g, '-')
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/…/g, '...')
    .replace(/[   ]/g, ' ')
    .replace(/[^\x0A\x20-\x7E\xA0-\xFF]/g, '')
    .trim();
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [217, 125, 29];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export async function buildDayPdf(input: DayExportInput): Promise<Blob> {
  const { jsPDF } = await import('jspdf'); // erst bei Bedarf laden, hält das Haupt-Bundle klein
  const { date, event, appName, primaryColor, options } = input;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 16;
  const brand = hexToRgb(primaryColor);
  const dark: [number, number, number] = [41, 37, 36];
  const grey: [number, number, number] = [120, 113, 108];
  const line: [number, number, number] = [231, 229, 228];
  const dateLong = format(date, 'EEEE, dd. MMMM yyyy', { locale: de });

  doc.setProperties({ title: `Aufgussplan ${format(date, 'dd.MM.yyyy')}`, creator: pdfSafe(appName) });

  // Kopfbereich
  doc.setFillColor(...brand);
  doc.rect(0, 0, W, 38, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(pdfSafe(appName).toUpperCase(), M, 12, { charSpace: 0.6 });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('Aufgussplan', M, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text(pdfSafe(dateLong), M, 32);

  let y = 48;
  if (event.title) {
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    const t = doc.splitTextToSize(pdfSafe(event.title), W - 2 * M);
    doc.text(t, M, y);
    y += t.length * 6;
  }
  if (event.notes) {
    doc.setTextColor(...grey);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10.5);
    const n = doc.splitTextToSize(pdfSafe(event.notes), W - 2 * M);
    doc.text(n, M, y);
    y += n.length * 4.8 + 2;
  }
  if (event.title || event.notes) y += 3;

  const entries = visibleEntries(input);
  const timeCol = 34;               // Breite der Zeitspalte
  const textX = M + timeCol;
  const textW = W - M - textX;
  const footerY = H - 10;

  if (entries.length === 0) {
    doc.setTextColor(...grey);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(12);
    doc.text('Für diesen Tag ist kein Aufguss geplant.', M, y + 6);
  }

  for (const e of entries) {
    const cancelled = e.status === 'abgesagt';
    const sub = pdfSafe(entrySubtitle(e));
    const scents = scentText(e, options.showDosage).map(pdfSafe);
    const staff = options.showStaff && e.staff_name ? pdfSafe(e.staff_name) : '';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    const nameLines: string[] = doc.splitTextToSize(pdfSafe(entryName(e)), textW - 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const subLines: string[] = sub ? doc.splitTextToSize(sub, textW) : [];
    doc.setFontSize(9.5);
    const scentLines: string[] = scents.length ? doc.splitTextToSize(scents.join('   '), textW - 4) : [];

    const blockH = Math.max(14, 5.5 + nameLines.length * 5.2 + subLines.length * 4.2
      + (scentLines.length ? scentLines.length * 4.2 + 1 : 0) + (staff ? 4.5 : 0) + 2.5);

    if (y + blockH > footerY - 6) {
      doc.addPage();
      y = M;
    }

    const top = y;
    let ty = top + 5.5;

    // Uhrzeit
    doc.setTextColor(...(cancelled ? grey : brand));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(formatTime(e.start_time), M, ty + 0.5);
    if (e.end_time) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...grey);
      doc.text(`bis ${formatTime(e.end_time)}`, M, ty + 5.5);
    }

    // Sauna rechts oben
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...grey);
    doc.text(pdfSafe(e.sauna_name).toUpperCase(), W - M, ty - 0.5, { align: 'right' });

    // Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...(cancelled ? grey : dark));
    doc.text(nameLines, textX, ty);
    if (cancelled) {
      const w = Math.min(doc.getTextWidth(nameLines[0]), textW);
      doc.setDrawColor(...grey);
      doc.setLineWidth(0.4);
      doc.line(textX, ty - 1.5, textX + w, ty - 1.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(200, 60, 60);
      doc.text('ABGESAGT', W - M, ty + 4, { align: 'right' });
    }
    ty += nameLines.length * 5.2;

    if (subLines.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...grey);
      doc.text(subLines, textX, ty - 0.6);
      ty += subLines.length * 4.2;
    }

    if (scentLines.length) {
      // Farbpunkte je Duft (nur in einzeiliger Darstellung genau zuordenbar)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...dark);
      if (scentLines.length === 1) {
        let x = textX;
        e.scents.forEach((s, idx) => {
          doc.setFillColor(...hexToRgb(s.color ?? primaryColor));
          doc.circle(x + 1.2, ty + 0.4, 1.2, 'F');
          doc.text(scents[idx], x + 3.5, ty + 1.4);
          x += 3.5 + doc.getTextWidth(scents[idx]) + 5;
        });
      } else {
        doc.text(scentLines, textX, ty + 1.4);
      }
      ty += scentLines.length * 4.2 + 1;
    }

    if (staff) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...grey);
      doc.text(`Aufgießer: ${staff}`, textX, ty + 1.8);
      ty += 4.5;
    }

    y = top + blockH;
    doc.setDrawColor(...line);
    doc.setLineWidth(0.3);
    doc.line(M, y, W - M, y);
  }

  // Fußzeile auf jeder Seite
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...grey);
    doc.text(pdfSafe(`${appName} · Stand ${format(new Date(), 'dd.MM.yyyy HH:mm')} Uhr`), M, footerY);
    if (pages > 1) doc.text(`Seite ${p} von ${pages}`, W - M, footerY, { align: 'right' });
  }

  return doc.output('blob');
}
