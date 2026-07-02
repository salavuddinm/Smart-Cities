import { Router } from 'express';
import { db, logAudit } from '../db/init.js';

const router = Router();

// UC#33 - View Active Alerts
router.get('/', (req, res) => {
  const { status, severity, alert_type, q } = req.query;
  let sql = `SELECT * FROM alerts WHERE 1=1`;
  const params = [];
  if (status) { sql += ` AND status=?`; params.push(status); }
  if (severity) { sql += ` AND severity=?`; params.push(severity); }
  if (alert_type) { sql += ` AND alert_type=?`; params.push(alert_type); }
  if (q) { sql += ` AND message LIKE ?`; params.push(`%${q}%`); } // UC#36 Search Alert History
  sql += ` ORDER BY created_at DESC LIMIT 200`;
  res.json(db.prepare(sql).all(...params));
});

// UC#34 - Acknowledge Alert
router.post('/:id/acknowledge', (req, res) => {
  const { user_id } = req.body;
  db.prepare(`UPDATE alerts SET status='Acknowledged', acknowledged_by=?, acknowledged_at=datetime('now') WHERE alert_id=?`)
    .run(user_id, req.params.id);
  logAudit('alert', req.params.id, 'acknowledged', user_id, {});
  res.json({ status: 'Acknowledged' });
});

// UC#35 - Prioritize Alert (severity override by supervisor)
router.patch('/:id/severity', (req, res) => {
  const { user_id, severity } = req.body;
  const allowed = ['Low', 'Medium', 'High', 'Critical', 'Emergency'];
  if (!allowed.includes(severity)) return res.status(400).json({ error: `severity must be one of ${allowed.join(', ')}` });
  db.prepare(`UPDATE alerts SET severity=? WHERE alert_id=?`).run(severity, req.params.id);
  logAudit('alert', req.params.id, 'reprioritized', user_id, { severity });
  res.json({ severity });
});

// UC#37 - Export Alert Data (JSON here; client renders to Excel/PDF)
router.get('/export', (req, res) => {
  const rows = db.prepare(`SELECT * FROM alerts ORDER BY created_at DESC`).all();
  res.setHeader('Content-Disposition', 'attachment; filename="alerts_export.json"');
  res.json(rows);
});

router.post('/:id/dismiss', (req, res) => {
  const { user_id } = req.body;
  db.prepare(`UPDATE alerts SET status='Dismissed' WHERE alert_id=?`).run(req.params.id);
  logAudit('alert', req.params.id, 'dismissed', user_id, {});
  res.json({ status: 'Dismissed' });
});

export default router;
