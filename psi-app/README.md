# Kenetix360 Pro — Public Safety Intelligence (EP01)

Working end-to-end build of the Public Safety Intelligence module from the Smart Cities feature matrix: 51 use cases, React + Node/Express + Postgres-schema stack.

## Run it

### 1. Backend
```bash
cd backend
npm install
npm run seed     # creates backend/src/db/psi.db with sample roles/users/cameras/zones/incidents
npm start        # starts API on http://localhost:4000
```
Requires Node 22+ (uses the built-in `node:sqlite` module for the demo database — no native build tools needed). Swap to a real Postgres connection using `database/schema.sql` for production; the route layer uses plain SQL so the port is mechanical.

### 2. Frontend
```bash
cd frontend
python3 -m http.server 5173
# open http://localhost:5173
```
It's a single static `index.html` (React + Babel via CDN, no build step) so any static file server works. Demo logins: `admin`, `operator1`, `supervisor1`, `officer1`, `legal1`, `auditor1`, `exec1` (password not checked in this demo).

## What's here
```
database/schema.sql           Production PostgreSQL DDL (17 tables/views, zero errors)
backend/src/db/init.js        Demo SQLite schema (same shape, runnable without Postgres)
backend/src/db/seed.js        Sample reference + transactional data
backend/src/routes/           incidents.js, alerts.js, config.js, intelligence.js (GIS/dashboard/audit/notifications)
backend/src/server.js         Express entrypoint
frontend/index.html           React command console: Incidents, Alert Queue, GIS Intelligence, Audit & Compliance
docs/Requirement_Analysis_Summary.md   Phase 1 deliverable, with gaps/assumptions flagged
docs/Traceability_Matrix.xlsx          UC → Screen → API → DB Entity for all 51 use cases
```

## API surface (selected)
- `POST /api/incidents/detect` — ingest a detection event (applies threshold + duplicate suppression + severity scoring)
- `POST /api/incidents/:id/acknowledge|escalate|assign|dispatch|close|archive`
- `GET /api/incidents`, `GET /api/incidents/:id` (filters: type, status, severity, from, to)
- `GET /api/alerts`, `POST /api/alerts/:id/acknowledge`, `PATCH /api/alerts/:id/severity`
- `GET /api/gis/incidents|heatmap|hotspots`
- `GET /api/dashboard/kpis`, `GET /api/reports/incidents|response-times|compliance`
- `GET /api/audit`
- `GET/POST /api/config/zones|cameras|watchlist`, `PUT /api/config/thresholds/:type`

Full mapping in `docs/Traceability_Matrix.xlsx`.

## Next steps to take this to production
See "Gaps and assumptions" in `docs/Requirement_Analysis_Summary.md` — real auth/RBAC, live map tiles, notification provider integration, compliance-source integration, and validated user stories for the 9 features that only had Feature-Matrix-level detail in the source workbook.
