import { Router } from 'express';
import { db, logAudit } from '../db/init.js';

const router = Router();

// UC#5/18/27 - Configure detection thresholds (smoke/intrusion/facial/suspect/loitering)
router.get('/thresholds', (req, res) => res.json(db.prepare(`SELECT * FROM detection_thresholds`).all()));

router.put('/thresholds/:detection_type', (req, res) => {
  const { user_id, confidence_pct, dwell_seconds, suppression_seconds } = req.body;
  const existing = db.prepare(`SELECT * FROM detection_thresholds WHERE detection_type=?`).get(req.params.detection_type);
  if (!existing) return res.status(404).json({ error: 'Unknown detection_type' });
  db.prepare(`UPDATE detection_thresholds SET confidence_pct=?, dwell_seconds=?, suppression_seconds=?, updated_by=?, updated_at=datetime('now') WHERE detection_type=?`)
    .run(confidence_pct ?? existing.confidence_pct, dwell_seconds ?? existing.dwell_seconds, suppression_seconds ?? existing.suppression_seconds, user_id, req.params.detection_type);
  logAudit('threshold', existing.threshold_id, 'updated', user_id, req.body);
  res.json(db.prepare(`SELECT * FROM detection_thresholds WHERE detection_type=?`).get(req.params.detection_type));
});

// UC#13/39 - Zones / geofences (security zones + safety zones share one model)
router.get('/zones', (req, res) => res.json(db.prepare(`SELECT * FROM zones WHERE is_active=1`).all()));

router.post('/zones', (req, res) => {
  const { user_id, zone_name, zone_type, polygon_geojson } = req.body;
  if (!zone_name || !zone_type || !polygon_geojson) return res.status(400).json({ error: 'zone_name, zone_type, polygon_geojson required' });
  const info = db.prepare(`INSERT INTO zones (zone_name, zone_type, polygon_geojson, created_by) VALUES (?,?,?,?)`)
    .run(zone_name, zone_type, JSON.stringify(polygon_geojson), user_id || null);
  logAudit('zone', info.lastInsertRowid, 'created', user_id, { zone_name, zone_type });
  res.status(201).json({ zone_id: info.lastInsertRowid });
});

router.delete('/zones/:id', (req, res) => {
  db.prepare(`UPDATE zones SET is_active=0 WHERE zone_id=?`).run(req.params.id);
  res.json({ deactivated: true });
});

// Cameras (supports zone monitoring config)
router.get('/cameras', (req, res) => res.json(db.prepare(`SELECT * FROM cameras`).all()));

router.post('/cameras', (req, res) => {
  const { camera_name, location_lat, location_lng, zone_id } = req.body;
  const info = db.prepare(`INSERT INTO cameras (camera_name, location_lat, location_lng, zone_id) VALUES (?,?,?,?)`)
    .run(camera_name, location_lat, location_lng, zone_id || null);
  res.status(201).json({ camera_id: info.lastInsertRowid });
});

// UC#14-18 - Watchlist management
router.get('/watchlist', (req, res) => res.json(db.prepare(`SELECT * FROM watchlist_entries WHERE is_active=1`).all()));

router.post('/watchlist', (req, res) => {
  const { user_id, person_name, reference_photo_url, reason } = req.body;
  const info = db.prepare(`INSERT INTO watchlist_entries (person_name, reference_photo_url, reason, created_by) VALUES (?,?,?,?)`)
    .run(person_name, reference_photo_url || null, reason || null, user_id || null);
  logAudit('watchlist', info.lastInsertRowid, 'created', user_id, { person_name });
  res.status(201).json({ watchlist_id: info.lastInsertRowid });
});

// UC#16 - Search Facial Matches
router.get('/watchlist/search', (req, res) => {
  const { q } = req.query;
  res.json(db.prepare(`SELECT * FROM watchlist_entries WHERE person_name LIKE ?`).all(`%${q || ''}%`));
});

export default router;
