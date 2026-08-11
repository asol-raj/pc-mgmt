-- db/setup.sql
-- Run once, as the MySQL sudo/root user (SUDO_MYSQL_USERNAME / SUDO_MYSQL_PASSWORD in .env).
-- Creates the application database and the app-specific MySQL user, then grants
-- that user privileges scoped only to this database.
--
-- Usage (from repo root):
--   mysql -h <MYSQL_HOSTNAME> -P <MYSQL_PORT> -u <SUDO_MYSQL_USERNAME> -p < db/setup.sql
--
-- NOTE: replace the literal values below if your .env credentials ever change —
-- this file can't read .env itself since it's plain SQL.

CREATE DATABASE IF NOT EXISTS pcmgmt
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'user_pcmgmt'@'localhost' IDENTIFIED BY '1rdLbBMBfKKg';

GRANT ALL PRIVILEGES ON pcmgmt.* TO 'user_pcmgmt'@'localhost';

FLUSH PRIVILEGES;
