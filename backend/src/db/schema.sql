-- Sauna Aufguss Manager – Datenbankschema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Benutzer (Admins + Personal)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'staff', -- 'admin' | 'staff'
  avatar_url VARCHAR(500),
  active BOOLEAN NOT NULL DEFAULT true,
  token_version INT NOT NULL DEFAULT 0, -- erhöhen = alle Tokens des Benutzers ungültig
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Beim Abmelden widerrufene Tokens (nur bis zu ihrem Ablauf aufbewahrt)
CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);

-- Saunen
CREATE TABLE IF NOT EXISTS saunas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  break_minutes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- App-Einstellungen (CI/CD)
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL
);

-- Duft-Datenbank
CREATE TABLE IF NOT EXISTS scents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  color VARCHAR(7),
  default_dosage_ml DECIMAL(6,2),
  dosage_unit VARCHAR(10) NOT NULL DEFAULT 'ml', -- 'ml' | 'g' | 'Tropfen'
  dosage_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration: Neue Spalten für bestehende Datenbanken
ALTER TABLE scents ADD COLUMN IF NOT EXISTS default_dosage_ml DECIMAL(6,2);
ALTER TABLE scents ADD COLUMN IF NOT EXISTS dosage_unit VARCHAR(10) NOT NULL DEFAULT 'ml';
ALTER TABLE scents ADD COLUMN IF NOT EXISTS dosage_note TEXT;

-- Aufguss-Vorlagen (wiederverwendbar)
CREATE TABLE IF NOT EXISTS aufguss_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  subtitle VARCHAR(200), -- z.B. "Sommerliche Erfrischung"
  description TEXT,
  duration_minutes INT NOT NULL DEFAULT 15,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Düfte pro Vorlage (kann mehrere Düfte/Variationen haben)
CREATE TABLE IF NOT EXISTS template_scents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES aufguss_templates(id) ON DELETE CASCADE,
  scent_id UUID NOT NULL REFERENCES scents(id),
  dosage_ml DECIMAL(6,2),
  dosage_note TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

-- Tages-Events (ein Event = ein Veranstaltungstag)
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_date DATE NOT NULL,
  title VARCHAR(200), -- z.B. "Wellness-Wochenende", "Sommer-Special"
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_date)
);

-- Geplante Aufgüsse (Tagesplan)
CREATE TABLE IF NOT EXISTS aufguss_schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  sauna_id UUID NOT NULL REFERENCES saunas(id),
  template_id UUID REFERENCES aufguss_templates(id),
  assigned_user_id UUID REFERENCES users(id),
  custom_name VARCHAR(200), -- überschreibt Template-Name
  custom_subtitle VARCHAR(200),
  start_time TIME NOT NULL,
  end_time TIME,
  status VARCHAR(20) NOT NULL DEFAULT 'geplant', -- 'geplant' | 'läuft' | 'fertig' | 'abgesagt'
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Düfte direkt für geplante Aufgüsse (überschreibt Template-Düfte wenn vorhanden)
CREATE TABLE IF NOT EXISTS schedule_scents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES aufguss_schedule(id) ON DELETE CASCADE,
  scent_id UUID NOT NULL REFERENCES scents(id),
  dosage_ml DECIMAL(6,2),
  dosage_note TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

-- Ideen-Datenbank
CREATE TABLE IF NOT EXISTS ideas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'duft', -- 'duft' | 'zeremonie' | 'musik' | 'sonstiges'
  content TEXT NOT NULL,
  tags TEXT[], -- Array von Tags
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kommentare zu Ideen
CREATE TABLE IF NOT EXISTS idea_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ideen-Verknüpfung mit Düften
CREATE TABLE IF NOT EXISTS idea_scents (
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  scent_id UUID NOT NULL REFERENCES scents(id),
  PRIMARY KEY (idea_id, scent_id)
);

-- Tagesvorlagen (kompletter Tagesablauf, auf beliebige Tage anwendbar)
CREATE TABLE IF NOT EXISTS day_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Aufgüsse einer Tagesvorlage
CREATE TABLE IF NOT EXISTS day_template_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_template_id UUID NOT NULL REFERENCES day_templates(id) ON DELETE CASCADE,
  sauna_id UUID NOT NULL REFERENCES saunas(id),
  template_id UUID REFERENCES aufguss_templates(id) ON DELETE SET NULL,
  assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  custom_name VARCHAR(200),
  custom_subtitle VARCHAR(200),
  start_time TIME NOT NULL,
  end_time TIME,
  sort_order INT NOT NULL DEFAULT 0
);

-- Düfte je Aufguss einer Tagesvorlage
CREATE TABLE IF NOT EXISTS day_template_entry_scents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id UUID NOT NULL REFERENCES day_template_entries(id) ON DELETE CASCADE,
  scent_id UUID NOT NULL REFERENCES scents(id) ON DELETE CASCADE,
  dosage_ml DECIMAL(6,2),
  dosage_note TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

-- Protokoll: wer hat wann was im System gemacht.
-- Bewusst OHNE Fremdschlüssel auf users: Der Name wird als Kopie gespeichert, und eine
-- Backup-Wiederherstellung (TRUNCATE users) lässt das Protokoll unangetastet.
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID,
  user_name VARCHAR(255),
  action VARCHAR(30) NOT NULL, -- create | update | delete | login | login_failed | logout | backup | restore | download
  entity VARCHAR(50),          -- z. B. 'Aufguss', 'Sauna', 'Mitarbeiter'
  entity_id TEXT,
  summary TEXT NOT NULL,       -- lesbarer Satz, z. B. Sauna „Finnisch“ geändert
  details JSONB,               -- Änderungen (vorher/nachher), gelöschte Daten usw.
  ip VARCHAR(64)
);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_user_idx ON audit_log (user_id, created_at DESC);

-- Seed-Daten: Standard-Admin
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Admin', 'admin@sauna.local', '$2a$10$placeholder', 'admin');
