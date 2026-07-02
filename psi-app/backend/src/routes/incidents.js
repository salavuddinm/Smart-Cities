import { Router } from 'express';
import { db, logAudit } from '../db/init.js';

const router = Router();

function getThreshold(type) {
  return db.prepare(`SELECT * FROM detection_thresholds WHERE detection_type=?`).get(type);
}

// UC#1/9/14/19/24 - AI detection event ingestion (creates incident + alert, applies threshold & suppression)
router.post('/detect', (req, res) => {
  const { incident_type, camera_id, zone_id, watchlist_id, confidence_pct, location_lat, location_lng } = req.body;
  if (!incident_type || confidence_pct == null) return res.status(400).json({ error: 'incident_type and confidence_pct are required' });

  const threshold = getThreshold(incident_type);
  if (threshold && confidence_pct < threshold.confidence_pct) {
    return res.status(200).json({ created: false, reason: 'Below configured confidence threshold (AC-008)' });
  }

  // Duplicate suppression: same camera + type within suppression window (UC#1 FR-012, AC-007)
  if (threshold) {
    const dup = db.prepare(
      `SELECT incident_id FROM incidents WHERE incident_type=? AND camera_id=? AND detected_at > datetime('now', ?)`
    ).get(incident_type, camera_id, `-${threshold.suppression_seconds} seconds`);
    if (dup) return res.status(200).json({ created: false, reason: 'Duplicate suppressed', incident_id: dup.incident_id });
  }

  const severity = confidence_pct >= 95 ? 'Critical' : confidence_pct >= 90 ? 'High' : confidence_pct >= 80 ? 'Medium' : 'Low';
  const locationStatus = (location_lat == null || location_lng == null) ? 'Location Pending' : 'Resolved'; // AC-009

  const info = db.prepare(`INSERT INTO incidents
    (incident_type, camera_id, zone_id, watchlist_id, confidence_pct, severity, status, location_lat, location_lng, location_status)
    VALUES (?,?,?,?,?,?,'New/Open',?,?,?)`
  ).run(incident_type, camera_id || null, zone_id || null, watchlist_id || null, confidence_pct, severity, location_lat || null, location_lng || null, locationStatus);

  const incidentId = info.lastInsertRowid;

  db.prepare(`INSERT INTO alerts (incident_id, alert_type, severity, status, message) VALUES (?,?,?,'Active',?)`)
    .run(incidentId, incident_type, severity, `${incident_type} event detected (confidence ${confidence_pct}%)`);

  logAudit('incident', incidentId, 'created', null, { incident_type, confidence_pct, severity });
  res.status(201).json({ created: true, incident_id: incidentId, severity, location_status: locationStatus });
});

// UC#33/36 - list / search incidents (also backs Incident History UC#4,8,26)
router.get('/', (req, res) => {
  const { type, status, severity, from, to, q } = req.query;
  let sql = `SELECT * FROM incidents WHERE 1=1`;
  const params = [];
  if (type) { sql += ` AND incident_type=?`; params.push(type); }
  if (status) { sql += ` AND status=?`; params.push(status); }
  if (severity) { sql += ` AND severity=?`; params.push(severity); }
  if (from) { sql += ` AND detected_at >= ?`; params.push(from); }
  if (to) { sql += ` AND detected_at <= ?`; params.push(to); }
  sql += ` ORDER BY detected_at DESC LIMIT 200`;
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const incident = db.prepare(`SELECT * FROM incidents WHERE incident_id=?`).get(req.params.id);
  if (!incident) return res.status(404).json({ error: 'Not found' });
  incident.evidence = db.prepare(`SELECT * FROM incident_evidence WHERE incident_id=?`).all(req.params.id);
  incident.dispatches = db.prepare(`SELECT * FROM dispatch_log WHERE incident_id=?`).all(req.params.id);
  incident.audit = db.prepare(`SELECT * FROM audit_log WHERE entity_type='incident' AND entity_id=? ORDER BY performed_at`).all(req.params.id);
  res.json(incident);
});

// UC#6 - Incident Acknowledgment
router.post('/:id/acknowledge', (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required (RBAC: only authorized users may acknowledge)' });
  const incident = db.prepare(`SELECT * FROM incidents WHERE incident_id=?`).get(req.params.id);
  if (!incident) return res.status(404).json({ error: 'Not found' });
  if (incident.status !== 'New/Open') return res.status(409).json({ error: `Cannot acknowledge from status ${incident.status}` });

  db.prepare(`UPDATE incidents SET status='Acknowledged', acknowledged_by=?, acknowledged_at=datetime('now'), updated_at=datetime('now') WHERE incident_id=?`)
    .run(user_id, req.params.id);
  logAudit('incident', req.params.id, 'acknowledged', user_id, {});
  res.json({ status: 'Acknowledged' });
});

// UC#7 - Emergency Manual Dispatch
router.post('/:id/dispatch', (req, res) => {
  const { user_id, dispatched_to, services } = req.body; // services e.g. ['Fire','Medical','EMS']
  if (!user_id || !dispatched_to || !services?.length) return res.status(400).json({ error: 'user_id, dispatched_to, services[] required' });

  db.prepare(`UPDATE incidents SET severity='Emergency', status='Dispatched', dispatched_at=datetime('now'), dispatched_to=?, updated_at=datetime('now') WHERE incident_id=?`)
    .run(dispatched_to, req.params.id);
  db.prepare(`INSERT INTO dispatch_log (incident_id, services_notified, dispatched_by, confirmation_status) VALUES (?,?,?,'Confirmed')`)
    .run(req.params.id, services.join(','), user_id);
  logAudit('incident', req.params.id, 'dispatched', user_id, { dispatched_to, services });
  res.json({ status: 'Dispatched', severity: 'Emergency', services_notified: services });
});

// UC#3/12/32 - Escalate incident
router.post('/:id/escalate', (req, res) => {
  const { user_id, escalate_to, reason } = req.body;
  db.prepare(`UPDATE incidents SET status='Escalated', updated_at=datetime('now') WHERE incident_id=?`).run(req.params.id);
  logAudit('incident', req.params.id, 'escalated', user_id, { escalate_to, reason });
  res.json({ status: 'Escalated' });
});

// UC#29 - Assign incident
router.post('/:id/assign', (req, res) => {
  const { user_id, assigned_to } = req.body;
  db.prepare(`UPDATE incidents SET assigned_to=?, status='Assigned', updated_at=datetime('now') WHERE incident_id=?`).run(assigned_to, req.params.id);
  logAudit('incident', req.params.id, 'assigned', user_id, { assigned_to });
  res.json({ status: 'Assigned' });
});

// UC#30 - Update status
router.patch('/:id/status', (req, res) => {
  const { user_id, status } = req.body;
  const allowed = ['New/Open','Acknowledged','Assigned','In Progress','Dispatched','Escalated','Closed','Archived'];
  if (!allowed.includes(status)) return res.status(400).json({ error: `status must be one of ${allowed.join(', ')}` });
  db.prepare(`UPDATE incidents SET status=?, updated_at=datetime('now') WHERE incident_id=?`).run(status, req.params.id);
  logAudit('incident', req.params.id, 'updated', user_id, { status });
  res.json({ status });
});

// UC#31 - Close incident
router.post('/:id/close', (req, res) => {
  const { user_id, closure_notes } = req.body;
  db.prepare(`UPDATE incidents SET status='Closed', closed_at=datetime('now'), closure_notes=?, updated_at=datetime('now') WHERE incident_id=?`)
    .run(closure_notes || '', req.params.id);
  logAudit('incident', req.params.id, 'closed', user_id, { closure_notes });
  res.json({ status: 'Closed' });
});

// UC#48 - Archive
router.post('/:id/archive', (req, res) => {
  const { user_id } = req.body;
  db.prepare(`UPDATE incidents SET status='Archived', updated_at=datetime('now') WHERE incident_id=?`).run(req.params.id);
  logAudit('incident', req.params.id, 'archived', user_id, {});
  res.json({ status: 'Archived' });
});

// UC#47 - Manage Incident Evidence
router.post('/:id/evidence', (req, res) => {
  const { evidence_type, file_url, uploaded_by } = req.body;
  if (!evidence_type || !file_url) return res.status(400).json({ error: 'evidence_type and file_url required' });
  const info = db.prepare(`INSERT INTO incident_evidence (incident_id, evidence_type, file_url, uploaded_by) VALUES (?,?,?,?)`)
    .run(req.params.id, evidence_type, file_url, uploaded_by || null);
  logAudit('incident', req.params.id, 'evidence_added', uploaded_by, { evidence_type, file_url });
  res.status(201).json({ evidence_id: info.lastInsertRowid });
});

// UC#20 - Suspect tracking path
router.post('/:id/track', (req, res) => {
  const { camera_id, location_lat, location_lng } = req.body;
  db.prepare(`INSERT INTO suspect_tracking (incident_id, camera_id, location_lat, location_lng) VALUES (?,?,?,?)`)
    .run(req.params.id, camera_id || null, location_lat, location_lng);
  res.status(201).json({ tracked: true });
});

router.get('/:id/track', (req, res) => {
  res.json(db.prepare(`SELECT * FROM suspect_tracking WHERE incident_id=? ORDER BY observed_at`).all(req.params.id));
});

export default router;
