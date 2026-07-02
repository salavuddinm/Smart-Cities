-- =====================================================================
-- Public Safety Intelligence (EP01) - PostgreSQL Schema
-- Generated from Smart Cities Feature Matrix (Version3.xlsx)
-- Covers UC#1-51 across 11 categories
-- =====================================================================

CREATE TABLE roles (
    role_id         SERIAL PRIMARY KEY,
    role_name       VARCHAR(50) UNIQUE NOT NULL, -- Security Operator, Supervisor, Officer, Police/Legal, Auditor, Administrator, Executive
    description     TEXT
);

CREATE TABLE users (
    user_id         SERIAL PRIMARY KEY,
    username        VARCHAR(100) UNIQUE NOT NULL,
    full_name       VARCHAR(150) NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    role_id         INTEGER NOT NULL REFERENCES roles(role_id),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    password_hash   VARCHAR(255) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE zones (                                     -- UC#39 Create Safety Zone / UC#13 Configure Security Zones
    zone_id         SERIAL PRIMARY KEY,
    zone_name       VARCHAR(150) NOT NULL,
    zone_type       VARCHAR(30) NOT NULL,                 -- restricted, monitored, geofence
    polygon_geojson JSONB NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      INTEGER REFERENCES users(user_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cameras (
    camera_id       SERIAL PRIMARY KEY,
    camera_name     VARCHAR(150) NOT NULL,
    location_lat    NUMERIC(9,6),
    location_lng    NUMERIC(9,6),
    zone_id         INTEGER REFERENCES zones(zone_id),
    status          VARCHAR(20) NOT NULL DEFAULT 'online', -- online, offline, maintenance
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE detection_thresholds (                       -- UC#5 Configure Smoke Thresholds / UC#18 Facial Matching Rules / UC#27 Loitering Threshold
    threshold_id    SERIAL PRIMARY KEY,
    detection_type  VARCHAR(40) NOT NULL,                 -- smoke, intrusion, facial, suspect, loitering
    confidence_pct  NUMERIC(5,2) NOT NULL DEFAULT 90.0,
    dwell_seconds   INTEGER,                               -- for loitering
    suppression_seconds INTEGER NOT NULL DEFAULT 300,      -- duplicate alert suppression window
    updated_by      INTEGER REFERENCES users(user_id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE watchlist_entries (                           -- UC#14-18 Facial Detection & Matching
    watchlist_id    SERIAL PRIMARY KEY,
    person_name     VARCHAR(150),
    reference_photo_url VARCHAR(500),
    reason          VARCHAR(255),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      INTEGER REFERENCES users(user_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Core incident table, used across all detection categories (Smoke, Intrusion, Facial, Suspect, Loitering)
CREATE TABLE incidents (                                   -- UC#1,9,14,19,24,28-32
    incident_id     SERIAL PRIMARY KEY,
    incident_type   VARCHAR(40) NOT NULL,                  -- smoke, intrusion, facial_match, suspect, loitering
    camera_id       INTEGER REFERENCES cameras(camera_id),
    zone_id         INTEGER REFERENCES zones(zone_id),
    watchlist_id    INTEGER REFERENCES watchlist_entries(watchlist_id),
    confidence_pct  NUMERIC(5,2),
    severity        VARCHAR(20) NOT NULL DEFAULT 'Low',     -- Low, Medium, High, Critical, Emergency
    status          VARCHAR(30) NOT NULL DEFAULT 'New/Open',-- New/Open, Acknowledged, Assigned, In Progress, Dispatched, Escalated, Closed, Archived
    location_lat    NUMERIC(9,6),
    location_lng    NUMERIC(9,6),
    location_status VARCHAR(30) NOT NULL DEFAULT 'Resolved',-- Resolved, Location Pending (AC-009)
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by INTEGER REFERENCES users(user_id),
    dispatched_at   TIMESTAMPTZ,
    dispatched_to   VARCHAR(150),                           -- nearest response center
    closed_at       TIMESTAMPTZ,
    closure_notes   TEXT,
    assigned_to     INTEGER REFERENCES users(user_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_incidents_type_status ON incidents(incident_type, status);
CREATE INDEX idx_incidents_detected_at ON incidents(detected_at);

CREATE TABLE incident_evidence (                           -- UC#47 Manage Incident Evidence
    evidence_id     SERIAL PRIMARY KEY,
    incident_id     INTEGER NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    evidence_type   VARCHAR(30) NOT NULL,                  -- video_clip, image, document
    file_url        VARCHAR(500) NOT NULL,
    uploaded_by     INTEGER REFERENCES users(user_id),
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dispatch_log (                                -- UC#7 Emergency Manual Dispatch
    dispatch_id     SERIAL PRIMARY KEY,
    incident_id     INTEGER NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    services_notified VARCHAR(255) NOT NULL,                -- e.g. 'Fire,Medical,EMS'
    dispatched_by   INTEGER REFERENCES users(user_id),
    confirmation_status VARCHAR(30) NOT NULL DEFAULT 'Sent',
    dispatched_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE alerts (                                      -- UC#2,10,15,22,25,33-37
    alert_id        SERIAL PRIMARY KEY,
    incident_id     INTEGER REFERENCES incidents(incident_id) ON DELETE CASCADE,
    alert_type      VARCHAR(40) NOT NULL,
    severity        VARCHAR(20) NOT NULL DEFAULT 'Low',
    status          VARCHAR(30) NOT NULL DEFAULT 'Active',  -- Active, Acknowledged, Escalated, Dismissed
    message         VARCHAR(500),
    acknowledged_by INTEGER REFERENCES users(user_id),
    acknowledged_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_status ON alerts(status);

CREATE TABLE notification_subscriptions (                   -- UC#50-51
    subscription_id SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(user_id),
    channel         VARCHAR(20) NOT NULL,                   -- sms, email, push, dashboard
    alert_types     VARCHAR(255) NOT NULL,                  -- comma list: smoke,intrusion,facial,suspect,loitering
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE notifications_sent (                           -- UC#50
    notification_id SERIAL PRIMARY KEY,
    alert_id        INTEGER REFERENCES alerts(alert_id),
    user_id         INTEGER REFERENCES users(user_id),
    channel         VARCHAR(20) NOT NULL,
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'Sent',     -- Sent, Failed
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE suspect_tracking (                             -- UC#20 Track Suspect Movement
    track_id        SERIAL PRIMARY KEY,
    incident_id     INTEGER NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    camera_id       INTEGER REFERENCES cameras(camera_id),
    location_lat    NUMERIC(9,6),
    location_lng    NUMERIC(9,6),
    observed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (                                    -- UC#46, cross-cutting & immutable
    audit_id        BIGSERIAL PRIMARY KEY,
    entity_type     VARCHAR(40) NOT NULL,                   -- incident, alert, zone, threshold, watchlist, user
    entity_id       INTEGER NOT NULL,
    action          VARCHAR(50) NOT NULL,                   -- created, acknowledged, escalated, dispatched, closed, updated, exported
    performed_by    INTEGER REFERENCES users(user_id),
    details         JSONB,
    performed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);

CREATE TABLE compliance_checks (                            -- UC#49 Monitor Regulatory Compliance
    check_id        SERIAL PRIMARY KEY,
    standard        VARCHAR(40) NOT NULL,                   -- CJIS, NIST, TX-RAMP, GDPR
    status          VARCHAR(20) NOT NULL DEFAULT 'Compliant',
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes           TEXT
);

-- Reporting/KPI views are computed, not stored, to avoid duplicated data.
CREATE VIEW v_response_time_metrics AS               -- UC#44 View Response Time Metrics
SELECT incident_id, incident_type, severity,
       EXTRACT(EPOCH FROM (acknowledged_at - detected_at)) AS ack_seconds,
       EXTRACT(EPOCH FROM (dispatched_at - detected_at)) AS dispatch_seconds,
       EXTRACT(EPOCH FROM (closed_at - detected_at)) AS resolution_seconds
FROM incidents;

CREATE VIEW v_safety_dashboard_kpis AS               -- UC#42 View Public Safety Dashboard
SELECT
  COUNT(*) FILTER (WHERE status NOT IN ('Closed','Archived')) AS active_incidents,
  COUNT(*) FILTER (WHERE severity IN ('Critical','Emergency') AND status NOT IN ('Closed','Archived')) AS critical_open,
  AVG(EXTRACT(EPOCH FROM (acknowledged_at - detected_at))) FILTER (WHERE acknowledged_at IS NOT NULL) AS avg_ack_seconds,
  COUNT(*) FILTER (WHERE detected_at > now() - interval '24 hours') AS incidents_last_24h
FROM incidents;
