import { db } from './init.js';

const roles = ['Administrator', 'Security Operator', 'Supervisor', 'Officer', 'Police/Legal', 'Auditor', 'Executive'];
const insRole = db.prepare(`INSERT OR IGNORE INTO roles (role_name) VALUES (?)`);
roles.forEach(r => insRole.run(r));

const roleId = name => db.prepare(`SELECT role_id FROM roles WHERE role_name=?`).get(name).role_id;

const insUser = db.prepare(`INSERT OR IGNORE INTO users (username, full_name, email, role_id, password_hash) VALUES (?,?,?,?,?)`);
insUser.run('admin', 'Ava Administrator', 'admin@kenetix360.local', roleId('Administrator'), 'demo-hash');
insUser.run('operator1', 'Sam Operator', 'sam.operator@kenetix360.local', roleId('Security Operator'), 'demo-hash');
insUser.run('supervisor1', 'Priya Supervisor', 'priya.supervisor@kenetix360.local', roleId('Supervisor'), 'demo-hash');
insUser.run('officer1', 'Jordan Officer', 'jordan.officer@kenetix360.local', roleId('Officer'), 'demo-hash');
insUser.run('legal1', 'Police Legal', 'legal@kenetix360.local', roleId('Police/Legal'), 'demo-hash');
insUser.run('auditor1', 'Casey Auditor', 'casey.auditor@kenetix360.local', roleId('Auditor'), 'demo-hash');
insUser.run('exec1', 'Morgan Executive', 'morgan.exec@kenetix360.local', roleId('Executive'), 'demo-hash');

const insZone = db.prepare(`INSERT OR IGNORE INTO zones (zone_id, zone_name, zone_type, polygon_geojson, created_by) VALUES (?,?,?,?,1)`);
insZone.run(1, 'City Hall Perimeter', 'restricted', JSON.stringify({type:'Polygon', coordinates:[[[-96.797,32.7767],[-96.795,32.7767],[-96.795,32.778],[-96.797,32.778],[-96.797,32.7767]]]}));
insZone.run(2, 'Downtown Transit Hub', 'monitored', JSON.stringify({type:'Polygon', coordinates:[[[-96.800,32.78],[-96.798,32.78],[-96.798,32.781],[-96.800,32.781],[-96.800,32.78]]]}));

const insCam = db.prepare(`INSERT OR IGNORE INTO cameras (camera_id, camera_name, location_lat, location_lng, zone_id, status) VALUES (?,?,?,?,?,?)`);
insCam.run(1, 'CAM-CityHall-01', 32.7770, -96.7965, 1, 'online');
insCam.run(2, 'CAM-Transit-04', 32.7805, -96.7990, 2, 'online');
insCam.run(3, 'CAM-Park-12', 32.7790, -96.8010, null, 'offline');

const insThresh = db.prepare(`INSERT OR IGNORE INTO detection_thresholds (threshold_id, detection_type, confidence_pct, dwell_seconds, suppression_seconds, updated_by) VALUES (?,?,?,?,?,1)`);
insThresh.run(1, 'smoke', 90, null, 300);
insThresh.run(2, 'intrusion', 85, null, 180);
insThresh.run(3, 'facial', 92, null, 600);
insThresh.run(4, 'suspect', 80, null, 300);
insThresh.run(5, 'loitering', 75, 600, 300);

const insWatch = db.prepare(`INSERT OR IGNORE INTO watchlist_entries (watchlist_id, person_name, reason, created_by) VALUES (?,?,?,1)`);
insWatch.run(1, 'Subject A', 'Outstanding warrant');

// Sample incidents across categories
const insInc = db.prepare(`INSERT OR IGNORE INTO incidents
  (incident_id, incident_type, camera_id, zone_id, watchlist_id, confidence_pct, severity, status, location_lat, location_lng, location_status, detected_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now', ?))`);
insInc.run(1, 'smoke', 1, 1, null, 96.4, 'Critical', 'New/Open', 32.7770, -96.7965, 'Resolved', '-15 minutes');
insInc.run(2, 'intrusion', 1, 1, null, 88.1, 'High', 'Acknowledged', 32.7771, -96.7964, 'Resolved', '-2 hours');
insInc.run(3, 'facial_match', 2, 2, 1, 93.5, 'Medium', 'Assigned', 32.7805, -96.7990, 'Resolved', '-1 day');
insInc.run(4, 'loitering', 2, 2, null, 78.0, 'Low', 'New/Open', 32.7806, -96.7991, 'Resolved', '-45 minutes');
insInc.run(5, 'smoke', 3, null, null, 91.2, 'High', 'Closed', null, null, 'Location Pending', '-3 days');

const insAlert = db.prepare(`INSERT OR IGNORE INTO alerts (alert_id, incident_id, alert_type, severity, status, message) VALUES (?,?,?,?,?,?)`);
insAlert.run(1, 1, 'smoke', 'Critical', 'Active', 'Smoke detected at City Hall Perimeter (CAM-CityHall-01)');
insAlert.run(2, 2, 'intrusion', 'High', 'Acknowledged', 'Restricted-area intrusion at City Hall Perimeter');
insAlert.run(3, 3, 'facial', 'Medium', 'Active', 'Watchlist match: Subject A at Transit Hub');
insAlert.run(4, 4, 'loitering', 'Low', 'Active', 'Loitering beyond threshold at Transit Hub');

console.log('Seed complete.');
