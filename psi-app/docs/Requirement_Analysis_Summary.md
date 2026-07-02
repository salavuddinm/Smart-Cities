# Requirement Analysis Summary
## Smart Cities — EP01: Public Safety Intelligence
Kenetix360 Pro · derived from `Version3.xlsx`

## 1. Scope of this delivery
Per your selection, this build covers **one module end-to-end**: Public Safety Intelligence (EP01), all 51 use cases, as a working application — PostgreSQL schema, Express/Node REST API, and a React command-console frontend. The other 7 modules (Traffic, People Flow, Parking, Transit, GIS, Analytics & AI, Administration & Security — 211 remaining use cases) are catalogued in the source workbook but not built; the same pattern used here can be repeated for each.

## 2. Business goals (from Summary sheet)
- Reduce emergency response time 30% within 12 months
- Reduce traffic congestion 20% within 18 months
- Improve citizen request resolution 40% within 12 months
- Reduce operational costs 15% within 2 years
- Reach 100% key city-system integration within 18 months
- Improve citizen satisfaction 25% within 2 years
- Reduce unplanned infrastructure downtime 35% within 18 months

This module's incident acknowledgment/dispatch timers and audit trail are the levers for the response-time goal specifically.

## 3. Actors / roles identified
Security Operator, Supervisor, Officer, Police/Legal, Auditor/Compliance, Administrator, Executive (dashboard consumer). Modeled in `roles`/`users` tables; RBAC enforcement is stubbed in the demo (see Gaps below) and needs a real authorization layer before production use.

## 4. Functional decomposition
11 feature categories under EP01, each mapped 1:1 to a UC range:

| Feature | UCs | Core entity |
|---|---|---|
| Smoke Detection | 1–8 | incidents (type=smoke) |
| Intrusion Detection | 9–13 | incidents (type=intrusion), zones |
| Facial Detection & Matching | 14–18 | incidents (type=facial_match), watchlist_entries |
| Suspect Detection | 19–23 | incidents (type=suspect), suspect_tracking |
| Loitering Detection | 24–27 | incidents (type=loitering) |
| Incident Management | 28–32 | incidents (lifecycle) |
| Alert Management | 33–37 | alerts |
| GIS Intelligence | 38–41 | incidents, zones (geo) |
| Dashboard & Reporting | 42–45 | computed views over incidents |
| Audit & Compliance | 46–49 | audit_log, incident_evidence, compliance_checks |
| Notification Management | 50–51 | notification_subscriptions, notifications_sent |

Full UC → Screen → API → Table mapping is in `Traceability_Matrix.xlsx`.

## 5. Gaps and assumptions (flagged per your quality requirements)
1. **Depth of source detail is uneven.** Only Smoke Detection (EP01-FR01) and Intrusion Detection (EP01-FR02) had complete Functional/Interface/Data/NFR/Acceptance-Criteria user-story documents in the workbook. The remaining 9 features (UC#14–51) only had one-line Description/Acceptance-Scenario entries in the Feature Matrix. I extended the same structure (confidence thresholds, suppression windows, severity scoring, audit logging) to those features by pattern-matching, but they have **not** been validated against full acceptance criteria — recommend writing out detailed user stories for FR03–FR11 the same way FR01/FR02 were written, then re-validating this build against them.
2. **Authentication is a stub.** Demo login matches by username only, no password/MFA. NFR-006/007/008 in EP01-FR01-US01 require encrypted, access-controlled, CJIS/NIST/TX-RAMP-compliant access — production needs real OIDC/OAuth2 auth, MFA, and field-level encryption.
3. **GIS rendering is simulated.** The demo plots incidents on a coordinate grid in-browser rather than a live map tile service, to avoid an external mapping API dependency. Swap in Mapbox/Leaflet/ArcGIS for production.
4. **Notification delivery is not wired to a provider.** Subscriptions and a `notifications_sent` ledger exist, but actual SMS/email/push dispatch needs Twilio/SES/FCM integration.
5. **Compliance monitoring (UC#49) is a placeholder table.** Populating it requires integration with whatever GRC/compliance tooling the city already uses.
6. **Camera/video ingestion is out of scope.** The "AI analyzes live video streams" detection step (UC#1, #9, #14, #19, #24) is represented as a `POST /incidents/detect` API that a video-analytics pipeline would call — no actual computer-vision model is included.

## 6. Non-functional requirements captured
From EP01-FR01-US01/US02: detection ≤10s, detection accuracy ≥95%, notification delivery ≤5s, system availability ≥99.95%, acknowledgment SLA ≤10 min (per UC#8). These are documented as targets in the schema/API comments; the demo does not load-test against them.

## 7. What's runnable today
- `database/schema.sql` — production Postgres DDL, zero errors
- `backend/` — Node/Express API, verified live (health check, detection with threshold/suppression logic, acknowledge, dispatch, GIS heatmap/hotspots, audit trail, threshold config all tested against a running server)
- `frontend/index.html` — React command console (Incidents, Alert Queue, GIS Intelligence, Audit & Compliance screens), talks to the API above
- `docs/Traceability_Matrix.xlsx` — full UC→Screen→API→DB mapping for all 51 use cases, plus the gap notes above
