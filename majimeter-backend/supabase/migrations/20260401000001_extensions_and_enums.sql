-- Extensions

-- Enums
CREATE TYPE user_role         AS ENUM ('user', 'technician', 'admin');
CREATE TYPE water_point_type  AS ENUM ('borehole', 'tank', 'pipe', 'tap');
CREATE TYPE water_point_status AS ENUM ('active', 'inactive', 'maintenance');
CREATE TYPE report_type       AS ENUM ('shortage', 'burst_pipe', 'contamination', 'infrastructure', 'other');
CREATE TYPE report_status     AS ENUM ('open', 'in_progress', 'resolved', 'dismissed');
CREATE TYPE alert_type        AS ENUM ('low_level', 'high_pressure', 'low_pressure', 'no_flow', 'leak_detected');
CREATE TYPE alert_severity    AS ENUM ('info', 'warning', 'critical');
CREATE TYPE notification_type AS ENUM ('alert', 'report_update', 'system');
