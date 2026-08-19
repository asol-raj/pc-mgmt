-- 0001_add_os_edition_and_network.sql
-- Adds the Windows edition (Home/Pro/...) and the network fields (IP address and
-- whether that IP is statically assigned or handed out by DHCP).
--
-- Usage (from repo root):
--   mysql -h <MYSQL_HOSTNAME> -P <MYSQL_PORT> -u <MYSQL_USERNAME> -p pcmgmt < db/migrations/0001_add_os_edition_and_network.sql

USE pcmgmt;

ALTER TABLE pcs
  ADD COLUMN os_edition ENUM('Home', 'Pro', 'Enterprise', 'Education') NULL AFTER os,
  ADD COLUMN ip_address VARCHAR(45) NULL AFTER teamviewer_id,
  ADD COLUMN ip_config  ENUM('Static', 'Dynamic') NULL AFTER ip_address;
