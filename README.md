# 🧖 Sauna Aufguss Manager

Digitales Aufguss-Planungssystem für Saunen. Drei Ansichten:
- **`/`** — Gäste-Display (öffentlich, kein Login)
- **`/personal`** — Personal-Display (öffentlich, kein Login)
- **`/admin`** — Admin-Panel (Login erforderlich)

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
| **Tagesplan** | Aufgüsse pro Tag planen, Saunen zuweisen, Zeiten setzen |
| **Vorlagen** | Wiederverwendbare Aufguss-Vorlagen mit Düften + Dosierung |
| **Ideen-DB** | Düfte, Zeremonien, Musik mit Kommentarfunktion |
| **Mitarbeiter** | Fotos, Rollen, Zuweisung zu Aufgüssen |
| **Saunen** | Saunen mit Namen verwalten |
| **Duft-DB** | 40+ Düfte mit Farbe und Kategorie |

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
