-- 0004_add_used_by.sql
-- The person a PC belongs to, as the admin knows them ("Priya Sharma"), which is
-- not the same thing as assigned_users: that column is agent-owned and holds the
-- Windows account names the machine reports. used_by is admin-curated and the
-- agent never touches it, so a report can't wipe the human name off a desk.
--
-- Usage (from repo root):
--   mysql -h <MYSQL_HOSTNAME> -P <MYSQL_PORT> -u <MYSQL_USERNAME> -p pcmgmt < db/migrations/0004_add_used_by.sql

USE pcmgmt;

ALTER TABLE pcs
  ADD COLUMN used_by VARCHAR(150) NULL COMMENT 'person the PC is assigned to, set by the admin' AFTER location;
