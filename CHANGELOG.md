# Versionshistorie

Alle wichtigen Änderungen am Sauna Aufguss Manager werden hier dokumentiert.

Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/):
`MAJOR` = inkompatible Änderungen (z. B. Datenbank/.env muss angepasst werden),
`MINOR` = neue Funktionen, `PATCH` = Fehlerbehebungen.

> **Bei jeder neuen Version auch pflegen:** `frontend/src/lib/changelog.ts` (Anzeige im
> Admin-Panel unter „Versionen“) und `"version"` in den drei `package.json`.

---

## [1.6.1] – 2026-11-12

> **Update:** `git pull` und `docker compose up -d --build` genügen. Die neue Spalte und Tabelle
> legt die Migration beim Start automatisch an. **Alle Benutzer müssen sich danach einmal neu
> anmelden** (alte Anmeldungen werden nicht mehr akzeptiert).

### Behoben
- **Sicherheit:** Abmelden hat die Anmeldung nur im Browser gelöscht. Jetzt wird sie auch auf dem
  Server ungültig.
- **Sicherheit:** Nach einer Passwortänderung blieben alte Anmeldungen bis zu 7 Tage gültig. Neues
  Passwort oder Deaktivieren meldet den Mitarbeiter jetzt auf allen Geräten ab. Wer das eigene
  Passwort ändert, bleibt auf dem aktuellen Gerät angemeldet.
- **Sicherheit:** Der Webserver sendet jetzt Sicherheits-Header (Content-Security-Policy,
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`). Eingeschleuster Code kann so
  keine fremden Skripte laden, und die App lässt sich nicht in fremde Seiten einbetten.

---

## [1.6.0] – 2026-11-11

> **Update:** `git pull` und `docker compose up -d --build` genügen. Neue Pakete werden beim
> Build installiert, die fehlende Datenbankspalte legt die Migration beim Start automatisch an.

### Hinzugefügt
- **„Mir zuweisen“:** Ist ein Aufguss im Tagesplan noch niemandem zugewiesen, kann ihn jeder
  angemeldete Mitarbeiter mit einem Klick selbst übernehmen. Geprüft wird, ob die Person zu der
  Zeit schon einen anderen Aufguss leitet; klicken zwei gleichzeitig, bekommt ihn nur einer.

### Geändert
- **Profilfotos:** Es lassen sich nur noch Bilder im Format JPG oder PNG hochladen (max. 5 MB).
  Andere Dateien werden mit einem Hinweis abgelehnt.
- **Einstellungen:** Die Logo-Adresse muss mit `https://`, `http://` oder `/` beginnen.
- **Login:** Nach zu vielen Fehlversuchen erscheint „Zu viele Anmeldeversuche …“ statt
  „E-Mail oder Passwort falsch“.

### Behoben
- **Mitarbeiter bearbeiten:** Änderungen an Mitarbeitern ließen sich nicht speichern.
- **Fehlermeldungen:** Bei einem Serverfehler (z. B. Datenbank nicht erreichbar) lud die Seite
  endlos. Jetzt kommt sofort eine verständliche Meldung, auch beim Hochladen von Profilfotos.
- **Sicherheit:** Passwörter ließen sich beliebig oft durchprobieren. Nach 10 Fehlversuchen
  innerhalb von 15 Minuten wird die Anmeldung von dieser IP-Adresse vorübergehend gesperrt.
- **Sicherheit:** Der Server hat Eingaben nicht geprüft. Fehlende Pflichtfelder, zu lange Texte,
  ungültige Uhrzeiten oder unbekannte Werte werden jetzt mit klarer Meldung abgelehnt.
- **Sicherheit:** Technische Fehlerdetails wurden an den Browser weitergegeben.

---

## [1.5.0] – 2026-11-11

> **Update:** Die neuen Tabellen für Tagesvorlagen legt die Migration beim Start des
> Backend-Containers automatisch an – `git pull` und `docker compose up -d --build` genügen.

### Hinzugefügt
- **Tagesvorlagen:** Neuer Menüpunkt „Tagesvorlagen“. Ein kompletter Tagesablauf (Sauna, Zeiten,
  Mitarbeiter, Düfte je Aufguss) wird einmal angelegt und dann auf beliebige Tage übertragen.
  - Im Tagesplan: **„Als Tagesvorlage speichern“** übernimmt einen fertig geplanten Tag als Vorlage.
  - Im Tagesplan: **„Tagesvorlage anwenden“** auf den aktuellen Tag oder einen Zeitraum mit
    Wochentag-Auswahl (z. B. alle Samstage der nächsten 4 Wochen, max. 92 Tage).
  - Bestehende Aufgüsse wahlweise **behalten** (Vorlage ergänzt) oder **ersetzen**. Aufgüsse mit
    Zeitkonflikt oder deaktivierter Sauna werden übersprungen und danach aufgelistet.
  - Vorlagen lassen sich bearbeiten, duplizieren und löschen (bereits geplante Tage bleiben erhalten).
- **Tagesplan, schneller springen:** Datumsfeld „Gehe zu“ und eine Wochenleiste (Mo–So) mit Anzahl
  der Aufgüsse je Tag; mit « » wochenweise blättern. Das gewählte Datum steht in der URL
  (`/admin/plan?datum=2026-11-21`) und bleibt beim Neuladen erhalten.

### Geändert
- **Menü:** „Vorlagen“ heißt jetzt „Aufguss-Vorlagen“ (zur Unterscheidung von den Tagesvorlagen).
- **Berechtigungen, Admin-Panel:** Personal sieht nur noch, was es darf. Saunen und Einstellungen
  sind ausgeblendet (auch per direkter URL gesperrt), ebenso Knöpfe für Admin-Aktionen
  (Mitarbeiter anlegen/bearbeiten/deaktivieren, Duft löschen). Versionen sieht jeder.
- **Ideen:** Alle sehen alle Ideen und können kommentieren. Bearbeiten und Löschen nur noch durch
  den Ersteller oder einen Admin. Kommentare lassen sich löschen (eigene; Admins alle).
- **Profilfotos:** Jeder darf nur sein eigenes Foto ändern, Admins alle.

### Behoben
- **Sicherheit:** Deaktivierte Mitarbeiter blieben bis zu 7 Tage angemeldet, Rollenänderungen
  griffen erst nach erneutem Login. Konto und Rolle werden jetzt bei jeder Anfrage geprüft.
- **Sicherheit:** Personal konnte Profilfotos anderer Mitarbeiter ändern sowie fremde Ideen
  bearbeiten und löschen.

---

## [1.4.0] – 2026-11-11

### Hinzugefügt
- **Handy-Ansicht, Admin-Panel:** Auf schmalen Bildschirmen gibt es eine Kopfzeile mit ☰-Menü;
  die Navigation klappt als Seitenleiste aus und schließt sich nach der Auswahl automatisch.
- **Handy-Ansicht, Gäste- & Personal-Display:** Saunen stehen auf dem Handy untereinander
  (Tablet: 2 Spalten, großer Monitor: wie bisher alle nebeneinander). Uhr, Countdown und
  Fußzeile sind verkleinert.
- **Home-Bildschirm:** Meta-Tags für „Zum Home-Bildschirm hinzufügen“ (iOS/Android), inkl.
  Berücksichtigung von Notch/Home-Indikator.

### Geändert
- **Formulare:** Öffnen auf dem Handy als scrollbares Bottom-Sheet, Felder einspaltig,
  Duft-Zeilen brechen um, Buttons in voller Breite.
- **Tagesplan & Listen:** Datumsnavigation, Aufguss-Aktionen, Duft-/Sauna-/Mitarbeiterlisten
  brechen auf kleinen Bildschirmen um; größere Tippflächen.
- **Eingabefelder:** Auf dem Handy mindestens 16 px Schrift, damit iOS nicht automatisch hineinzoomt.

---

## [1.3.0] – 2026-11-11

### Hinzugefügt
- **Admin-Panel, Duft-Datenbank:** Suchfeld zum Filtern nach Name, Beschreibung und Anmerkungen
  (kombinierbar mit dem Kategorie-Filter, mit Button zum Leeren).
- **Admin-Panel, Duft-Datenbank:** Wird ein Duft noch in Vorlagen, geplanten Aufgüssen oder Ideen
  verwendet, zeigt die Rückfrage vor dem Löschen, wo genau. Auf Wunsch wird er dort mit entfernt.

### Behoben
- **Düfte löschen:** Düfte, die noch in Vorlagen, Tagesplänen oder Ideen verwendet wurden, ließen sich
  nicht löschen. Die Datenbank blockierte den Vorgang, die Anfrage blieb ohne Antwort hängen und
  im Admin-Panel passierte nichts. Löschen erfolgt jetzt in einer Transaktion
  (`DELETE /api/scents/:id`, mit `?force=true` inkl. Verknüpfungen).
- **Düfte löschen:** Fehler (z. B. fehlende Admin-Rechte) werden jetzt im Admin-Panel angezeigt.

---

## [1.2.0] – 2026-11-11

### Hinzugefügt
- **Gäste-Display:** Countdown-Banner „Beginnt in M:SS“, sobald ein Aufguss in weniger als
  5 Minuten startet (mit Sauna, Düften und Aufgießer).
- **Gäste-Display:** Betroffene Aufguss-Karten werden hervorgehoben und mit Countdown-Badge markiert.
- **Gäste-Display:** Düfte werden beim nächsten Aufguss und in den Aufguss-Karten angezeigt.
- **Personal-Display:** Countdown-Hinweise für anstehende Aufgüsse – gelb ab 10 Minuten,
  rot (blinkend) ab 5 Minuten vor Start, inkl. Sauna, Düften und zugewiesenem Mitarbeiter.
- **Personal-Display:** Abgeschlossene Aufgüsse erscheinen in einem eigenen, ein-/ausklappbaren
  Bereich (zuletzt beendete zuerst).
- **Personal-Display:** Hinweis „Alle Aufgüsse für heute sind abgeschlossen“, wenn nichts mehr ansteht.
- **Admin-Panel:** Seite „Versionen“ (`/admin/versionen`) mit Versionshistorie; aktuelle Version
  wird in der Sidebar angezeigt.

### Geändert
- Countdown-Hilfsfunktionen (`secondsUntil`, `formatCountdown`) nach `frontend/src/lib/utils.ts`
  ausgelagert und von Gäste- und Personal-Display gemeinsam genutzt.

---

## [1.1.0] – 2026-11-11

### Hinzugefügt
- **HTTPS mit Let's Encrypt:** eigener `certbot`-Container mit automatischer Zertifikats-Erneuerung;
  nginx startet mit temporärem selbstsigniertem Zertifikat und übernimmt das echte automatisch.
- Zentrale `.env`-Vorlage (`.env.example`) im Projekt-Root.
- `.gitignore` und `.dockerignore` für Frontend und Backend.

### Geändert
- `docker-compose.yml` für den Live-Betrieb: Pflichtwerte (`DOMAIN`, `JWT_SECRET`,
  `ADMIN_PASSWORD`, `POSTGRES_PASSWORD`, `LETSENCRYPT_EMAIL`) müssen in der `.env` gesetzt sein,
  sonst bricht `docker compose` mit einer Meldung ab.
- README um Installation, HTTPS, Update-Ablauf und Fehlersuche erweitert.
- `node_modules` aus dem Repository entfernt (Repository-Struktur bereinigt).

### Sicherheit
- Datenbank (5432) und Backend (3001) sind nicht mehr von außen erreichbar, nur noch über nginx.
- Keine Standard-Passwörter mehr in `docker-compose.yml`.
- Admin-Passwort wird bei der Migration nicht mehr im Log ausgegeben.

> **Hinweis zum Update von 1.0.0:** Vor `docker compose up -d --build` muss eine `.env`
> nach Vorlage `.env.example` angelegt werden.

---

## [1.0.0] – 2026-11-11

### Hinzugefügt
- Erste Version des Sauna Aufguss Managers.
- **Gäste-Display** (`/`), **Personal-Display** (`/personal`) und **Admin-Panel** (`/admin`).
- Tagesplan, Aufguss-Vorlagen, Ideen-Datenbank, Mitarbeiter-, Saunen- und Duft-Verwaltung.
- Docker-Setup mit PostgreSQL, Node/TypeScript-Backend und React/Vite-Frontend.

[Unveröffentlicht]: #unveröffentlicht
[1.2.0]: #120--2026-11-11
[1.1.0]: #110--2026-11-11
[1.0.0]: #100--2026-11-11
