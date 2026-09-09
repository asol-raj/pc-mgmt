-- 0006_add_software_and_printers.sql
-- One row per installed program and per installed printer, reported by the PC agent app.
--
-- Until now the register held installed software as one comma-separated string of
-- names in pcs.softwares, capped at 4000 characters, which the agent had to truncate
-- on a well-stocked PC. The office wants to *read* the list: sorted, filterable, with
-- the version and publisher beside each name. That is a child table, not a string.
--
-- pcs.softwares stays. Older agent builds still send it, the CSV export still carries
-- it, and the agent keeps sending it alongside the structured list so a register that
-- has not run this migration keeps working.
--
-- Both tables are wholly agent-owned: every report replaces the PC's rows outright,
-- and deleting a PC removes them (ON DELETE CASCADE). Nothing here is admin-edited.
--
-- Usage (from repo root):
--   mysql -h <MYSQL_HOSTNAME> -P <MYSQL_PORT> -u <MYSQL_USERNAME> -p pcmgmt < db/migrations/0006_add_software_and_printers.sql

USE pcmgmt;

CREATE TABLE IF NOT EXISTS pc_software (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pc_id         INT UNSIGNED NOT NULL,
  name          VARCHAR(200) NOT NULL COMMENT 'DisplayName, as Add/Remove Programs shows it',
  version       VARCHAR(100) NULL,
  publisher     VARCHAR(200) NULL,
  install_date  DATE NULL COMMENT 'from the uninstall key, which many installers never write',

  INDEX idx_pc_software_pc (pc_id),
  CONSTRAINT fk_pc_software_pc FOREIGN KEY (pc_id) REFERENCES pcs (id) ON DELETE CASCADE
) COMMENT 'installed programs, one row each, replaced on every agent report';

CREATE TABLE IF NOT EXISTS pc_printers (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pc_id         INT UNSIGNED NOT NULL,
  name          VARCHAR(200) NOT NULL COMMENT 'printer name as Windows shows it',
  driver        VARCHAR(200) NULL,
  port          VARCHAR(200) NULL COMMENT 'USB001, an IP port, a share path, or a pseudo-port like PORTPROMPT:',
  kind          ENUM('Local', 'Network', 'Virtual') NOT NULL DEFAULT 'Local'
                COMMENT 'Virtual = Print to PDF, XPS, OneNote, fax and the like',
  is_default    TINYINT(1) NOT NULL DEFAULT 0,
  status        VARCHAR(50) NULL COMMENT 'Ready, Offline, Error, Paper Out, ... as the spooler last saw it',

  INDEX idx_pc_printers_pc (pc_id),
  CONSTRAINT fk_pc_printers_pc FOREIGN KEY (pc_id) REFERENCES pcs (id) ON DELETE CASCADE
) COMMENT 'installed printers, one row each, replaced on every agent report';
