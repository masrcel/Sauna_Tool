# Versionshistorie

Alle wichtigen Änderungen am Sauna Aufguss Manager werden hier dokumentiert.

Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/):
`MAJOR` = inkompatible Änderungen (z. B. Datenbank/.env muss angepasst werden),
`MINOR` = neue Funktionen, `PATCH` = Fehlerbehebungen.

> **Bei jeder neuen Version auch pflegen:** `frontend/src/lib/changelog.ts` (Anzeige im
> Admin-Panel unter „Versionen“) und `"version"` in den drei `package.json`.

---

## [Unveröffentlicht]

_Noch keine Änderungen._

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
