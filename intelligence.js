import { Router } from 'express';
import { db, logAudit } from '../db/init.js';

const router = Router();

/* ---------------- GIS Intelligence: UC#38,39,40,41 ---------------- */
router.get('/gis/incidents', (req, res) => {
  // UC#38 - Map Public Safety Incident
  res.json(db.prepare(`SELECT incident_id, incident_type, severity, status, location_lat, location_lng, location_status, detected_at
                        FROM incidents WHERE location_lat IS NOT NULL`).all());
});

router.get('/gis/heatmap', (req, res) => {
  // UC#40 - View Incident Heat Map: aggregate counts by rounded coordinate cell
  const rows = db.prepare(`
    SELECT ROUND(location_lat,3) AS lat, ROUND(location_lng,3) AS lng, COUNT(*) AS weight
    FROM incidents WHERE location_lat IS NOT NULL
    GROUP BY ROUND(location_lat,3), ROUND(location_lng,3)`).all();
  res.json(rows);
});

router.get('/gis/hotspots', (req, res) => {
  // UC#41 - Analyze High-Risk Areas: zones ranked by incident count
  const rows = db.prepare(`
    SELECT z.zone_id, z.zone_name, COUNT(i.incident_id) AS incident_count
    FROM zones z LEFT JOIN incidents i ON i.zone_id = z.zone_id
    GROUP BY z.zone_id ORDER BY incident_count DESC`).all();
  res.json(rows);
});

/* ---------------- Dashboard & Reporting: UC#42,43,44,45 ---------------- */
router.get('/dashboard/kpis', (req, res) => {
  // UC#42 - View Public Safety Dashboard
  const row = db.prepare(`
    SELECT
      COUNT(*) FILTER (WHERE status NOT IN ('Closed','Archived')) AS active_incidents,
      COUNT(*) FILTER (WHERE severity IN ('Critical','Emergency') AND status NOT IN ('Closed','Archived')) AS critical_open,
      COUNT(*) FILTER (WHERE detected_at > datetime('now','-1 day')) AS incidents_last_24h
    FROM incidents`).get();
  const avgAck = db.prepare(`
    SELECT AVG((julianday(acknowledged_at)-julianday(detected_at))*86400) AS avg_ack_seconds
    FROM incidents WHERE acknowledged_at IS NOT NULL`).get();
  res.json({ ...row, avg_ack_seconds: avgAck.avg_ack_seconds });
});

router.get('/reports/incidents', (req, res) => {
  // UC#43 - Generate Incident Report
  const { from, to, type } = req.query;
  let sql = `SELECT * FROM incidents WHERE 1=1`;
  const params = [];
  if (from) { sql += ` AND detected_at >= ?`; params.push(from); }
  if (to) { sql += ` AND detected_at <= ?`; params.push(to); }
  if (type) { sql += ` AND incident_type = ?`; params.push(type); }
  res.json(db.prepare(sql).all(...params));
});

router.get('/reports/response-times', (req, res) => {
  // UC#44 - View Response Time Metrics
  res.json(db.prepare(`
    SELECT incident_id, incident_type, severity,
      (julianday(acknowledged_at)-julianday(detected_at))*86400 AS ack_seconds,
      (julianday(dispatched_at)-julianday(detected_at))*86400 AS dispatch_seconds,
      (julianday(closed_at)-julianday(detected_at))*86400 AS resolution_seconds
    FROM incidents`).all());
});

router.get('/reports/compliance', (req, res) => {
  // UC#45/49 - Compliance & regulatory report
  res.json(db.prepare(`SELECT * FROM compliance_checks ORDER BY last_checked_at DESC`).all());
});

/* ---------------- Audit & Compliance: UC#46,49 ---------------- */
router.get('/audit', (req, res) => {
  const { entity_type, entity_id } = req.query;
  let sql = `SELECT * FROM audit_log WHERE 1=1`;
  const params = [];
  if (entity_type) { sql += ` AND entity_type=?`; params.push(entity_type); }
  if (entity_id) { sql += ` AND entity_id=?`; params.push(entity_id); }
  sql += ` ORDER BY performed_at DESC LIMIT 500`;
  res.json(db.prepare(sql).all(...params));
});

/* ---------------- Notification Management: UC#50,51 ---------------- */
router.get('/notifications/subscriptions', (req, res) => {
  const { user_id } = req.query;
  res.json(db.prepare(`SELECT * FROM notification_subscriptions WHERE user_id=?`).all(user_id));
});

router.put('/notifications/subscriptions', (req, res) => {
  const { user_id, channel, alert_types, is_active } = req.body;
  const existing = db.prepare(`SELECT * FROM notification_subscriptions WHERE user_id=? AND channel=?`).get(user_id, channel);
  if (existing) {
    db.prepare(`UPDATE notification_subscriptions SET alert_types=?, is_active=? WHERE subscription_id=?`)
      .run(alert_types, is_active ? 1 : 0, existing.subscription_id);
  } else {
    db.prepare(`INSERT INTO notification_subscriptions (user_id, channel, alert_types, is_active) VALUES (?,?,?,?)`)
      .run(user_id, channel, alert_types, is_active ? 1 : 0);
  }
  res.json({ saved: true });
});

export default router;
