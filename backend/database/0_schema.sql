-- Challenger Fantasy PostgreSQL schema bootstrap.
-- This script is intentionally idempotent so local startup and future Liquibase
-- baselines can safely execute it more than once.
CREATE SCHEMA IF NOT EXISTS challenger;

CREATE TABLE IF NOT EXISTS challenger.schema_scripts (
    script_name text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
);
