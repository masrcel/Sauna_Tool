import fs from 'fs';
import path from 'path';
import { pool } from './client';
import bcrypt from 'bcryptjs';

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');

  // Schema ohne Seed-Daten ausführen
  const schemaOnly = sql.split('-- Seed-Daten')[0];
  await pool.query(schemaOnly);

  // Spalten-Migrationen für bestehende Datenbanken
  await pool.query(`ALTER TABLE saunas ADD COLUMN IF NOT EXISTS break_minutes INT NOT NULL DEFAULT 0`);
  // wird beim Bearbeiten von Mitarbeitern gesetzt, fehlte bisher im Schema
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);

  // App-Einstellungen Standardwerte
  await pool.query(`
    INSERT INTO app_settings (key, value) VALUES
      ('app_name',      'Sauna Aufguss Manager'),
      ('primary_color', '#d97d1d'),
      ('logo_url',      '')
    ON CONFLICT (key) DO NOTHING
  `);

  // Admin-User mit echtem Passwort anlegen
  const adminPassword = process.env.ADMIN_PASSWORD || 'sauna2024';
  const hash = await bcrypt.hash(adminPassword, 10);

  await pool.query(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES ('Admin', 'admin@sauna.local', $1, 'admin')
    ON CONFLICT (email) DO NOTHING
  `, [hash]);

  console.log('Migration erfolgreich.');
  console.log('Admin-Login: admin@sauna.local (Passwort aus ADMIN_PASSWORD)');
  await pool.end();
}

migrate().catch(err => {
  console.error('Migration fehlgeschlagen:', err.message);
  process.exit(1);
});
