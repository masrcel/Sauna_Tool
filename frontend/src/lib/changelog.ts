/**
 * Versionshistorie für das Admin-Panel (Seite „Versionen“).
 * Neueste Version immer OBEN eintragen – sie gilt als aktuelle App-Version.
 * Bitte parallel CHANGELOG.md im Projekt-Root und die "version" in den package.json pflegen.
 */

export type ChangeType = 'added' | 'changed' | 'fixed' | 'security';

export interface Release {
  version: string;
  date: string; // YYYY-MM-DD
  title?: string;
  note?: string;
  changes: Partial<Record<ChangeType, string[]>>;
}

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  added: 'Neu',
  changed: 'Geändert',
  fixed: 'Behoben',
  security: 'Sicherheit',
};

export const CHANGELOG: Release[] = [
  {
    version: '1.4.0',
    date: '2026-11-11',
    title: 'Handy-Ansicht',
    changes: {
      added: [
        'Admin-Panel auf dem Handy: Menü über den ☰-Button oben links, die Navigation klappt seitlich aus.',
        'Gäste- und Personal-Display lassen sich auf dem Handy öffnen; die Saunen stehen dort untereinander statt nebeneinander.',
        'Die Seite kann über „Zum Home-Bildschirm“ wie eine App gestartet werden.',
      ],
      changed: [
        'Formulare (Aufguss, Vorlage, Duft, Sauna, Mitarbeiter, Idee) öffnen auf dem Handy als scrollbares Fenster von unten, Eingabefelder untereinander.',
        'Tagesplan, Listen und Kopfzeilen brechen auf kleinen Bildschirmen sauber um, Buttons sind größer und leichter zu treffen.',
      ],
    },
  },
  {
    version: '1.3.0',
    date: '2026-11-11',
    title: 'Duft-Suche & Löschen repariert',
    changes: {
      added: [
        'Duft-Datenbank: Suchfeld für Name, Beschreibung und Anmerkungen, kombinierbar mit dem Kategorie-Filter.',
        'Duft-Datenbank: Die Rückfrage vor dem Löschen zeigt, in wie vielen Vorlagen, Aufgüssen und Ideen der Duft noch verwendet wird.',
      ],
      fixed: [
        'Düfte, die noch in Vorlagen, Tagesplänen oder Ideen verwendet wurden, ließen sich nicht löschen.',
        'Fehler beim Löschen (z. B. fehlende Admin-Rechte) werden jetzt angezeigt statt stillschweigend ignoriert.',
      ],
    },
  },
  {
    version: '1.2.0',
    date: '2026-11-11',
    title: 'Countdowns & Display-Verbesserungen',
    changes: {
      added: [
        'Gäste-Display: Countdown-Banner „Beginnt in M:SS“, sobald ein Aufguss in weniger als 5 Minuten startet.',
        'Gäste-Display: Betroffene Aufguss-Karten werden hervorgehoben und mit Countdown-Badge markiert.',
        'Gäste-Display: Düfte werden beim nächsten Aufguss und in den Aufguss-Karten angezeigt.',
        'Personal-Display: Countdown-Hinweise – gelb ab 10 Minuten, rot (blinkend) ab 5 Minuten vor Start.',
        'Personal-Display: Abgeschlossene Aufgüsse in eigenem, ein-/ausklappbarem Bereich.',
        'Personal-Display: Hinweis, wenn alle Aufgüsse des Tages abgeschlossen sind.',
        'Admin-Panel: Seite „Versionen“ mit Versionshistorie und Versionsanzeige in der Sidebar.',
      ],
      changed: [
        'Countdown-Funktionen werden von Gäste- und Personal-Display gemeinsam genutzt.',
      ],
    },
  },
  {
    version: '1.1.0',
    date: '2026-11-11',
    title: 'HTTPS & Live-Betrieb',
    note: 'Update von 1.0.0: Vorher eine .env nach Vorlage .env.example anlegen.',
    changes: {
      added: [
        'HTTPS mit Let’s Encrypt inkl. automatischer Zertifikats-Erneuerung.',
        'Zentrale .env-Vorlage (.env.example) im Projekt-Root.',
      ],
      changed: [
        'docker-compose.yml bricht mit Meldung ab, wenn Pflichtwerte in der .env fehlen.',
        'README um Installation, HTTPS, Updates und Fehlersuche erweitert.',
        'Repository-Struktur bereinigt (node_modules entfernt).',
      ],
      security: [
        'Datenbank und Backend sind nicht mehr von außen erreichbar, nur über nginx.',
        'Keine Standard-Passwörter mehr in der Konfiguration.',
        'Admin-Passwort wird nicht mehr im Log ausgegeben.',
      ],
    },
  },
  {
    version: '1.0.0',
    date: '2026-11-11',
    title: 'Erste Version',
    changes: {
      added: [
        'Gäste-Display, Personal-Display und Admin-Panel.',
        'Tagesplan, Vorlagen, Ideen-Datenbank, Mitarbeiter-, Saunen- und Duft-Verwaltung.',
        'Docker-Setup mit PostgreSQL, Backend und Frontend.',
      ],
    },
  },
];

export const APP_VERSION = CHANGELOG[0].version;
