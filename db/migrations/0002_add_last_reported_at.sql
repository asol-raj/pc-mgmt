-- 0002_add_last_reported_at.sql
-- Records when the machine's own agent app last reported in via POST /api/agent/report,
-- so a PC that has stopped checking in is visible in the admin table.
--
-- Usage (from repo root):
--   mysql -h <MYSQL_HOSTNAME> -P <MYSQL_PORT> -u <MYSQL_USERNAME> -p pcmgmt < db/migrations/0002_add_last_reported_at.sql

USE pcmgmt;

ALTER TABLE pcs
  ADD COLUMN last_reported_at TIMESTAMP NULL AFTER comments;
