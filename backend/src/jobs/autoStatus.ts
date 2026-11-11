import { query } from '../db/client';

export async function runAutoStatus() {
  // Zeitvergleich komplett in PostgreSQL – kein Node.js Timezone-Problem
  const updated = await query<any>(`
    UPDATE aufguss_schedule s
    SET status = CASE
      WHEN CURRENT_TIME >= COALESCE(
        s.end_time,
        s.start_time + (COALESCE(
          (SELECT t.duration_minutes FROM aufguss_templates t WHERE t.id = s.template_id),
          15
        ) || ' minutes')::interval
      ) THEN 'fertig'
      ELSE 'läuft'
    END
    FROM events e
    WHERE s.event_id = e.id
      AND e.event_date = CURRENT_DATE
      AND s.status IN ('geplant', 'läuft')
      AND CURRENT_TIME >= s.start_time
    RETURNING s.id, s.status
  `);

  if (updated.length > 0) {
    console.log(`[AutoStatus] ${new Date().toISOString()} – ${updated.length} Einträge aktualisiert:`,
      updated.map((r: any) => `${r.id.slice(0, 8)} → ${r.status}`).join(', ')
    );
  }
}
