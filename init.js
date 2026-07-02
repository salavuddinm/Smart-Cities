import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const db = new DatabaseSync(path.join(__dirname, 'psi.db'));
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS roles (
  role_id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_name TEXT UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(role_id),
  is_active INTEGER NOT NULL DEFAULT 1,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS zones (
  zone_id INTEGER PRIMARY KEY AUTOINCREMENT,
  zone_name TEXT NOT NULL,
  zone_type TEXT NOT NULL,
  polygon_geojson TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(user_id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cameras (
  camera_id INTEGER PRIMARY KEY AUTOINCREMENT,
  camera_name TEXT NOT NULL,
  location_lat REAL, location_lng REAL,
  zone_id INTEGER REFERENCES zones(zone_id),
  status TEXT NOT NULL DEFAULT 'online',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS detection_thresholds (
  threshold_id INTEGER PRIMARY KEY AUTOINCREMENT,
  detection_type TEXT NOT NULL,
  confidence_pct REAL NOT NULL DEFAULT 90.0,
  dwell_seconds INTEGER,
  suppression_seconds INTEGER NOT NULL DEFAULT 300,
  updated_by INTEGER REFERENCES users(user_id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS watchlist_entries (
  watchlist_id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_name TEXT, reference_photo_url TEXT, reason TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(user_id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS incidents (
  incident_id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_type TEXT NOT NULL,
  camera_id INTEGER REFERENCES cameras(camera_id),
  zone_id INTEGER REFERENCES zones(zone_id),
  watchlist_id INTEGER REFERENCES watchlist_entries(watchlist_id),
  confidence_pct REAL,
  severity TEXT NOT NULL DEFAULT 'Low',
  status TEXT NOT NULL DEFAULT 'New/Open',
  location_lat REAL, location_lng REAL,
  location_status TEXT NOT NULL DEFAULT 'Resolved',
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),
  acknowledged_at TEXT, acknowledged_by INTEGER REFERENCES users(user_id),
  dispatched_at TEXT, dispatched_to TEXT,
  closed_at TEXT, closure_notes TEXT,
  assigned_to INTEGER REFERENCES users(user_id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_incidents_type_status ON incidents(incident_type, status);

CREATE TABLE IF NOT EXISTS incident_evidence (
  evidence_id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id INTEGER NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL, file_url TEXT NOT NULL,
  uploaded_by INTEGER REFERENCES users(user_id),
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dispatch_log (
  dispatch_id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id INTEGER NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
  services_notified TEXT NOT NULL,
  dispatched_by INTEGER REFERENCES users(user_id),
  confirmation_status TEXT NOT NULL DEFAULT 'Sent',
  dispatched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS alerts (
  alert_id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id INTEGER REFERENCES incidents(incident_id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'Low',
  status TEXT NOT NULL DEFAULT 'Active',
  message TEXT,
  acknowledged_by INTEGER REFERENCES users(user_id),
  acknowledged_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);

CREATE TABLE IF NOT EXISTS notification_subscriptions (
  subscription_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  channel TEXT NOT NULL, alert_types TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS notifications_sent (
  notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_id INTEGER REFERENCES alerts(alert_id),
  user_id INTEGER REFERENCES users(user_id),
  channel TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'Sent',
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suspect_tracking (
  track_id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id INTEGER NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
  camera_id INTEGER REFERENCES cameras(camera_id),
  location_lat REAL, location_lng REAL,
  observed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL, entity_id INTEGER NOT NULL,
  action TEXT NOT NULL, performed_by INTEGER REFERENCES users(user_id),
  details TEXT,
  performed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS compliance_checks (
  check_id INTEGER PRIMARY KEY AUTOINCREMENT,
  standard TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Compliant',
  last_checked_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT
);
`);

export function logAudit(entityType, entityId, action, performedBy, details) {
  db.prepare(
    `INSERT INTO audit_log (entity_type, entity_id, action, performed_by, details) VALUES (?,?,?,?,?)`
  ).run(entityType, entityId, action, performedBy || null, details ? JSON.stringify(details) : null);
}
