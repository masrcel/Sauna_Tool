# 🧖 Sauna Aufguss Manager

Digitales Aufguss-Planungssystem für Saunen. Drei Ansichten:
- **`/`** — Gäste-Display (öffentlich, kein Login)
- **`/personal`** — Personal-Display (öffentlich, kein Login)
- **`/admin`** — Admin-Panel (Login erforderlich, Rollen siehe [Rollen & Berechtigungen](#rollen--berechtigungen))

Aktuelle Version: **1.5.0** · Optimiert für Monitor, Tablet und Handy.

Live: **https://kropp.sauna-aufgussplan.de**

---

## Installation (Server)

Voraussetzungen: Docker + Docker Compose, DNS-Eintrag der Domain zeigt auf den Server,
Ports **80 und 443** sind offen.

```bash
cd ~/Software/sauna-aufguss-manager
cp .env.example .env
nano .env                   # alle leeren Werte ausfüllen
docker compose up -d --build
```

Die `.env` muss **im selben Ordner wie `docker-compose.yml`** liegen. Fehlt ein Pflichtwert,
bricht `docker compose` mit einer Meldung ab (z. B. `DOMAIN fehlt in .env`).

Zufallswerte für `JWT_SECRET` / `POSTGRES_PASSWORD` erzeugen: `openssl rand -hex 32`

### Login
- URL: `https://[DOMAIN]/admin`
- E-Mail: `admin@sauna.local`
- Passwort: `ADMIN_PASSWORD` aus der `.env` (wird nur beim allerersten Start gesetzt)

### Update einspielen
```bash
cd ~/Software/sauna-aufguss-manager
git pull
docker compose up -d --build
```

### HTTPS / Let's Encrypt
- Beim ersten Start nutzt nginx ein temporäres selbstsigniertes Zertifikat. Der `certbot`-Container
  holt dann das echte Zertifikat; nginx übernimmt es automatisch innerhalb von ~1 Minute.
- Erneuerung läuft automatisch (certbot prüft alle 12h, nginx lädt alle 12h neu).
- `LETSENCRYPT_STAGING=1` nur zum Testen (Zertifikat nicht vertrauenswürdig). Danach Volume
  `letsencrypt` löschen, bevor auf `0` umgestellt wird.

### Sicherheit
- Datenbank (5432) und Backend (3001) sind **nicht** von außen erreichbar, nur über nginx.
- `.env` nie ins Git einchecken (steht in `.gitignore`).

### Logs & Fehlersuche
```bash
docker compose ps
docker compose logs -f certbot frontend backend
docker compose exec frontend env | grep DOMAIN    # muss die echte Domain zeigen
```

---

## Funktionen

| Bereich | Beschreibung |
|---|---|
| **Tagesplan** | Aufgüsse pro Tag planen, Saunen und Mitarbeiter zuweisen, Zeiten setzen (mit Konfliktprüfung); Datumsauswahl und Wochenleiste zum schnellen Springen |
| **Tagesvorlagen** | Kompletten Tagesablauf speichern und auf einen Tag oder einen Zeitraum (z. B. alle Samstage) anwenden |
| **Aufguss-Vorlagen** | Wiederverwendbare Aufguss-Vorlagen mit Düften + Dosierung |
| **Ideen** | Ideensammlung zu Düften, Zeremonien, Musik mit Kommentarfunktion |
| **Mitarbeiter** | Fotos, Rollen, Zuweisung zu Aufgüssen |
| **Saunen** | Saunen mit Namen verwalten |
| **Düfte** | 40+ Düfte mit Farbe und Kategorie, Suche und Kategorie-Filter |
| **Einstellungen** | App-Name, Logo, Primärfarbe, Hell/Dunkel/System |
| **Versionen** | Änderungshistorie direkt im Admin-Panel |

---

## Rollen & Berechtigungen

Es gibt zwei Rollen. Die Rolle wird unter **Mitarbeiter** beim Anlegen/Bearbeiten vergeben
(Standard für neue Mitarbeiter: **Personal**).

| Rolle | Wert in DB | Beschreibung |
|---|---|---|
| **Admin** | `admin` | Volle Rechte inkl. Mitarbeiter-, Sauna- und App-Verwaltung |
| **Personal** | `staff` | Tägliche Arbeit: Aufgüsse planen, Vorlagen, Ideen, Düfte pflegen |

Die Displays (`/` und `/personal`) sind ohne Login erreichbar und zeigen nur Daten an.

### Rechte-Übersicht

| Bereich | Aktion | Öffentlich | Personal | Admin |
|---|---|:-:|:-:|:-:|
| **Tagesplan** | Ansehen (Displays) | ✅ | ✅ | ✅ |
| | Aufgüsse anlegen, ändern, löschen, Düfte zuweisen | – | ✅ | ✅ |
| **Tagesvorlagen** | Ansehen, anlegen, ändern, löschen, anwenden | – | ✅ | ✅ |
| **Aufguss-Vorlagen** | Ansehen, anlegen, ändern, löschen | – | ✅ | ✅ |
| **Ideen** | Alle Ideen ansehen, neue anlegen | – | ✅ | ✅ |
| | Ändern, löschen | – | nur eigene | alle |
| | Kommentieren | – | ✅ | ✅ |
| | Kommentar löschen | – | nur eigene | alle |
| **Düfte** | Ansehen | ✅ | ✅ | ✅ |
| | Anlegen, ändern | – | ✅ | ✅ |
| | Löschen | – | – | ✅ |
| **Saunen** | Ansehen | ✅ | ✅ | ✅ |
| | Anlegen, ändern, löschen | – | – | ✅ |
| **Mitarbeiter** | Liste ansehen | – | ✅ | ✅ |
| | Profilfoto ändern | – | nur eigenes | alle |
| | Anlegen, bearbeiten, Rolle/Passwort ändern, deaktivieren | – | – | ✅ |
| **Einstellungen** | Lesen (Name, Farbe, Logo) | ✅ | ✅ | ✅ |
| | Ändern | – | – | ✅ |
| **Versionen** | Ansehen | – | ✅ | ✅ |

### Hinweise
- Personal sieht im Admin-Panel nur, was es auch darf: Die Menüpunkte **Saunen** und
  **Einstellungen** sowie Knöpfe für Admin-Aktionen (Mitarbeiter anlegen/bearbeiten, Duft löschen,
  fremde Ideen bearbeiten …) sind ausgeblendet. Die Seite **Versionen** sieht jeder.
- Zusätzlich prüft das **Backend** jede Anfrage; nicht erlaubte Aktionen werden mit HTTP 403 abgelehnt.
- Mitarbeiter werden nicht gelöscht, sondern **deaktiviert**. Deaktivierung und Rollenänderungen
  greifen **sofort**: Bei jeder Anfrage wird das Konto in der Datenbank geprüft, ein deaktivierter
  Mitarbeiter wird beim nächsten Klick abgemeldet.
- Der Standard-Admin `admin@sauna.local` wird beim ersten Start angelegt. Weitere Admins
  einfach unter **Mitarbeiter** mit Rolle **Admin** anlegen.

### API-Schutz (für Entwickler)
- `requireAuth` — gültiges Token **und** aktives Konto in der DB (beide Rollen), sonst `401`.
  Die Rolle wird dabei aus der DB gelesen, nicht aus dem Token.
- `requireAdmin` — wie `requireAuth`, zusätzlich Rolle `admin`, sonst `403`
- Eigentümer-Prüfungen: Ideen (`PUT`/`DELETE /api/ideas/:id`), Kommentare und Profilfotos
  (`POST /api/users/:id/avatar`) — Ersteller bzw. die Person selbst oder ein Admin
- Definiert in [backend/src/middleware/auth.ts](backend/src/middleware/auth.ts); Token: JWT, 7 Tage gültig,
  signiert mit `JWT_SECRET`.

## URL-Übersicht für Monitore

| Monitor | URL | Hinweis |
|---|---|---|
| Gäste-Display | `https://[DOMAIN]/` | Auto-Refresh alle 60s |
| Personal-Display | `https://[DOMAIN]/personal` | Auto-Refresh alle 30s |

---

## Lokal testen (optional, ohne Docker)

```bash
docker run -d --name sauna-db -e POSTGRES_DB=sauna_aufguss \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 postgres:16-alpine
cd backend && cp .env.example .env && npm install && npm run db:migrate && npm run dev
cd frontend && npm install && npm run dev       # http://localhost:5173
```

---

## Versionshistorie

Alle Änderungen je Version stehen in der [CHANGELOG.md](CHANGELOG.md).
