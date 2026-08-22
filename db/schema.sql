-- db/schema.sql
-- Run once, against the `pcmgmt` database (as the app user or sudo user), to create
-- the baseline schema. Later changes go in db/migrations/, not here.
--
-- Usage (from repo root):
--   mysql -h <MYSQL_HOSTNAME> -P <MYSQL_PORT> -u <MYSQL_USERNAME> -p pcmgmt < db/schema.sql

USE pcmgmt;

DROP TABLE IF EXISTS pcs;

CREATE TABLE pcs (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  asset_tag          VARCHAR(50)  NOT NULL UNIQUE,
  machine_id         VARCHAR(100) NULL UNIQUE COMMENT 'stable id reported by the PC agent app',
  name               VARCHAR(100) NOT NULL,
  brand              VARCHAR(50)  NULL,
  machine_type       ENUM('Desktop', 'Laptop', 'AIO') NOT NULL DEFAULT 'Desktop',
  cpu                VARCHAR(100) NULL,
  ram_gb             SMALLINT UNSIGNED NULL,
  storage_type       ENUM('SSD', 'HDD') NULL,
  storage_capacity   VARCHAR(20)  NULL,
  os                 ENUM('Windows 10', 'Windows 11') NOT NULL,
  os_edition         ENUM('Home', 'Pro', 'Enterprise', 'Education') NULL,
  condition_status   ENUM('New', 'Refurbished') NOT NULL DEFAULT 'New',
  location           VARCHAR(150) NOT NULL,
  used_by            VARCHAR(150) NULL COMMENT 'person the PC is assigned to, set by the admin',
  extension_number   VARCHAR(20)  NULL,
  teamviewer_id      VARCHAR(50)  NULL,
  ip_address         VARCHAR(45)  NULL COMMENT 'IPv4 or IPv6 address of the machine',
  ip_config          ENUM('Static', 'Dynamic') NULL,
  status             ENUM('Active', 'Retired') NOT NULL DEFAULT 'Active',
  performance        ENUM('Slow', 'Average', 'Good', 'Excellent') NOT NULL DEFAULT 'Good',
  softwares          TEXT NULL COMMENT 'comma-separated list, e.g. Office, Chrome, Adobe Reader',
  assigned_users     VARCHAR(255) NULL COMMENT 'comma-separated if shared by multiple people',
  comments           TEXT NULL,
  last_reported_at   TIMESTAMP NULL COMMENT 'last check-in from the PC agent app',
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_pcs_status (status),
  INDEX idx_pcs_location (location),
  INDEX idx_pcs_machine_type (machine_type)
);
