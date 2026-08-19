-- 0003_add_machine_id.sql
-- Stable per-machine identifier reported by the PC agent app (Windows MachineGuid or
-- the hardware UUID). It is what ties a report to an existing row, so renaming a PC's
-- name or asset_tag in the dashboard can never make the agent register a duplicate.
-- UNIQUE also makes a second row for the same machine impossible at the DB level;
-- NULL is allowed (and repeatable) for PCs added by hand, which have no agent.
--
-- Usage (from repo root):
--   mysql -h <MYSQL_HOSTNAME> -P <MYSQL_PORT> -u <MYSQL_USERNAME> -p pcmgmt < db/migrations/0003_add_machine_id.sql

USE pcmgmt;

ALTER TABLE pcs
  ADD COLUMN machine_id VARCHAR(100) NULL COMMENT 'stable id reported by the PC agent app' AFTER asset_tag,
  ADD UNIQUE KEY uq_pcs_machine_id (machine_id);
