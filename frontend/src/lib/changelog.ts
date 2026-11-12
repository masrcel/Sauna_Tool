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
    version: '1.8.0',
    date: '2026-11-12',
    title: 'Tag als PDF teilen',
    note: 'Im Plan gibt es den neuen Knopf „Als PDF / teilen“.',
    changes: {
      added: [
        'Einen geplanten Tag als PDF exportieren. Auf dem Handy öffnet „Teilen“ direkt das Teilen-Menü, z. B. für WhatsApp.',
        'Vor dem Export wählbar: Aufgießer anzeigen, Dosierung der Düfte anzeigen, abgesagte Aufgüsse ausblenden. Die Auswahl wird gemerkt.',
        'Plan als formatierten Text direkt per WhatsApp verschicken.',
        '„Für KI kopieren“: kopiert den Plan mit einer fertigen Anweisung. In ChatGPT, Claude o. Ä. einfügen, dann wird daraus eine Grafik für den WhatsApp-Status oder ein Aushang.',
      ],
    },
  },
  {
    version: '1.7.0',
    date: '2026-11-12',
    title: 'Protokoll & Backup',
    note: 'Neue Menüpunkte „Protokoll“ und „Backup“ – nur für Admins sichtbar.',
    changes: {
      added: [
        'Protokoll: Zeigt, welcher Mitarbeiter wann was geändert hat – z. B. Aufgüsse, Vorlagen, Düfte, Saunen, Mitarbeiter und Einstellungen.',
        'Protokoll: Bei Änderungen werden die Werte vorher → nachher angezeigt, bei Löschungen der gelöschte Eintrag. So lässt sich auch nachträglich nachvollziehen, was vorher dort stand.',
        'Protokoll: Anmeldungen, Abmeldungen und fehlgeschlagene Anmeldeversuche werden ebenfalls erfasst.',
        'Protokoll: Filter nach Mitarbeiter, Bereich, Aktion, Zeitraum und Freitext sowie Export als CSV-Datei (für Excel).',
        'Backup: Jede Nacht wird automatisch eine Datensicherung erstellt und 14 Tage aufbewahrt. Zusätzlich jederzeit per Knopfdruck.',
        'Backup: Enthält alle Daten (Pläne, Vorlagen, Düfte, Ideen, Mitarbeiter, Einstellungen), die Profilbilder und das Protokoll.',
        'Backup: Sicherungen lassen sich herunterladen und wiederherstellen – direkt vom Server oder aus einer hochgeladenen Datei (z. B. nach einem Serverumzug).',
      ],
      security: [
        'Vor jeder Wiederherstellung wird automatisch eine Sicherheitskopie des aktuellen Stands angelegt. Das Protokoll bleibt dabei vollständig erhalten.',
        'Nach einer Wiederherstellung werden alle Mitarbeiter abgemeldet und müssen sich neu anmelden.',
        'Passwörter werden nie im Protokoll gespeichert, dort steht nur „geändert“.',
      ],
    },
  },
  {
    version: '1.6.2',
    date: '2026-11-12',
    title: 'Stärkere Passwörter & Datenschutz',
    changes: {
      security: [
        'Passwörter müssen jetzt mindestens 10 Zeichen lang sein (beim Anlegen oder Ändern). Bestehende Passwörter funktionieren weiter.',
        'Login-Schutz zusätzlich pro Konto: Nach 10 Fehlversuchen in 15 Minuten ist das Konto kurz gesperrt, egal von welchem Gerät die Versuche kommen.',
        'Der Login verrät über die Antwortzeit nicht mehr, ob eine E-Mail-Adresse registriert ist.',
        'Abhängigkeiten mit bekannten Sicherheitslücken aktualisiert (u. a. Express/body-parser).',
      ],
      changed: [
        'Datenschutz: Die Schriften werden vom eigenen Server geladen statt von Google Fonts. Es werden keine Besucher-IP-Adressen mehr an Google übertragen.',
      ],
    },
  },
  {
    version: '1.6.1',
    date: '2026-11-12',
    title: 'Sichereres Abmelden',
    note: 'Nach dem Update muss sich jeder einmal neu anmelden.',
    changes: {
      security: [
        'Abmelden beendet die Anmeldung jetzt auch auf dem Server, nicht nur im Browser.',
        'Neues Passwort oder Deaktivieren meldet einen Mitarbeiter auf allen Geräten ab. Wer das eigene Passwort ändert, bleibt auf dem aktuellen Gerät angemeldet.',
        'Der Webserver sendet zusätzliche Sicherheits-Header (u. a. Content-Security-Policy). Das schützt besser vor eingeschleustem Code und verhindert das Einbetten in fremde Seiten.',
        'Feste Paket- und Image-Versionen beim Bauen: Es landen nur noch geprüfte Versionen auf dem Server, keine ungeprüften Updates.',
      ],
      changed: [
        'Server läuft mit Node 24 LTS statt Node 20.',
      ],
    },
  },
  {
    version: '1.6.0',
    date: '2026-11-11',
    title: '„Mir zuweisen“ & sicherer Login',
    changes: {
      added: [
        '„Mir zuweisen“: Einen noch freien Aufguss im Tagesplan mit einem Klick selbst übernehmen. Wer zu der Zeit schon einen anderen Aufguss leitet, bekommt einen Hinweis.',
      ],
      changed: [
        'Profilfotos: Nur noch Bilder im Format JPG oder PNG (max. 5 MB).',
        'Einstellungen: Die Logo-Adresse muss mit https://, http:// oder / beginnen.',
        'Login: Nach zu vielen Fehlversuchen erscheint „Zu viele Anmeldeversuche …“ statt „E-Mail oder Passwort falsch“.',
      ],
      fixed: [
        'Änderungen an Mitarbeitern ließen sich nicht speichern.',
        'Bei einem Serverfehler lud die Seite endlos – jetzt kommt sofort eine verständliche Meldung, auch beim Hochladen von Profilfotos.',
      ],
      security: [
        'Passwörter lassen sich nicht mehr beliebig oft durchprobieren: Nach 10 Fehlversuchen in 15 Minuten wird die Anmeldung vorübergehend gesperrt.',
        'Der Server prüft alle Eingaben und lehnt ungültige Daten mit klarer Meldung ab.',
        'Technische Fehlerdetails werden nicht mehr an den Browser weitergegeben.',
      ],
    },
  },
  {
    version: '1.5.0',
    date: '2026-11-11',
    title: 'Tagesvorlagen & schneller Tageswechsel',
    changes: {
      added: [
        'Tagesvorlagen: Einen kompletten Tagesablauf (Sauna, Zeiten, Mitarbeiter, Düfte) einmal anlegen und auf beliebige Tage übertragen – neuer Menüpunkt „Tagesvorlagen“.',
        'Tagesplan: „Als Tagesvorlage speichern“ übernimmt einen fertig geplanten Tag als Vorlage.',
        'Tagesplan: „Tagesvorlage anwenden“ auf den aktuellen Tag oder einen Zeitraum mit Wochentag-Auswahl, z. B. alle Samstage der nächsten 4 Wochen.',
        'Beim Anwenden wählbar: bestehende Aufgüsse behalten oder ersetzen. Aufgüsse mit Zeitkonflikt werden übersprungen und danach aufgelistet.',
        'Tagesvorlagen lassen sich bearbeiten, duplizieren und löschen.',
        'Tagesplan: Datumsfeld „Gehe zu“ und Wochenleiste (Mo–So) mit Anzahl der Aufgüsse je Tag – kein Durchklicken mehr Tag für Tag.',
        'Das gewählte Datum im Tagesplan bleibt beim Neuladen erhalten.',
      ],
      changed: [
        'Menü: „Vorlagen“ heißt jetzt „Aufguss-Vorlagen“.',
        'Personal sieht im Admin-Panel nur noch, was es darf: Saunen, Einstellungen und Admin-Knöpfe sind ausgeblendet.',
        'Ideen: Alle sehen alle Ideen und können kommentieren; bearbeiten und löschen nur Ersteller oder Admin. Eigene Kommentare lassen sich löschen.',
        'Profilfotos: Jeder ändert nur sein eigenes Foto, Admins alle.',
      ],
      security: [
        'Deaktivierte Mitarbeiter werden sofort abgemeldet, Rollenänderungen greifen ohne erneuten Login.',
        'Personal kann keine fremden Profilfotos und Ideen mehr ändern oder löschen.',
      ],
    },
  },
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
