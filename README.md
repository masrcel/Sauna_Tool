# 🧖 Sauna Aufguss Manager

Digitales Aufguss-Planungssystem für Saunen. Drei Ansichten:
- **`/`** — Gäste-Display (öffentlich, kein Login)
- **`/personal`** — Personal-Display (öffentlich, kein Login)
- **`/admin`** — Admin-Panel (Login erforderlich)

## Schnellstart (Entwicklung)

### Voraussetzungen
- Node.js 20+
- PostgreSQL (lokal oder via Docker)

### 1. Datenbank starten (Docker)
```bash
docker run -d --name sauna-db -e POSTGRES_DB=sauna_aufguss \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 postgres:16-alpine
```

### 2. Backend
```bash
cd backend
cp .env.example .env        # ggf. anpassen
npm install
npm run db:migrate          # Schema + Admin-User anlegen
npm run dev                 # läuft auf :3001
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev                 # läuft auf :5173
```

### Login
- URL: http://localhost:5173/admin
- E-Mail: `admin@sauna.local`
- Passwort: `sauna2024` (oder ADMIN_PASSWORD aus .env)

---

## Produktion (Docker Compose)

```bash
cp .env.example .env        # Werte anpassen (JWT_SECRET, ADMIN_PASSWORD, DOMAIN, LETSENCRYPT_EMAIL)
docker compose up -d --build
```

App läuft dann auf **HTTPS (Port 443)**, HTTP (Port 80) leitet automatisch um.

### HTTPS / Let's Encrypt
- Voraussetzung: DNS-Eintrag von `DOMAIN` zeigt auf den Server, Ports **80 und 443** sind offen.
- Beim ersten Start nutzt nginx ein temporäres selbstsigniertes Zertifikat. Der `certbot`-Container
  holt dann das echte Zertifikat; nginx übernimmt es automatisch innerhalb von ~1 Minute.
- Erneuerung läuft automatisch (certbot prüft alle 12h, nginx lädt alle 12h neu).
- Zum Testen ohne Rate-Limits: `LETSENCRYPT_STAGING=1` in `.env` (danach Volume `letsencrypt` löschen, bevor auf echt umgestellt wird).
- Logs: `docker compose logs -f certbot frontend`
- Ohne `DOMAIN` (bzw. `localhost`) läuft lokal nur das selbstsignierte Zertifikat.

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


# Entwicklung Docker Neustart 
cd ~/Software/sauna-aufguss-manager
docker compose build --no-cache 
docker compose up -d
