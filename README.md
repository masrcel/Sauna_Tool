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
# .env anlegen
echo "JWT_SECRET=dein-geheimer-schluessel" > .env
echo "ADMIN_PASSWORD=sicheres-passwort" >> .env

docker compose up -d
```

App läuft dann auf Port 80.

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
| Gäste-Display | `http://[SERVER]/` | Auto-Refresh alle 60s |
| Personal-Display | `http://[SERVER]/personal` | Auto-Refresh alle 30s |


# Entwicklung Docker Neustart 
cd ~/Software/sauna-aufguss-manager
docker compose build --no-cache 
docker compose up -d
