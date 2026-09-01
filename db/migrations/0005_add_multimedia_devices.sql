-- 0005_add_multimedia_devices.sql
-- Multimedia hardware each PC reports: speaker/audio output, microphone, camera.
--
-- The question the office actually asks is not "is a speaker plugged in" — Windows
-- cannot know that for a tower with analog speakers, and nobody cares. It is "does
-- this PC have working audio and mic hardware, or is the device missing, switched
-- off in Device Manager, or failing?" So each column holds a health state, not a
-- yes/no:
--
--   Working   the device is present and Windows reports no problem with it
--   Disabled  present, but disabled (Device Manager problem code 22)
--   Faulty    present, but Windows reports a driver or device problem
--   None      no such device on this machine at all
--
-- NULL means the PC has never reported — an older agent build, or a row an admin
-- added by hand. That is deliberately distinct from 'None', which is a positive
-- statement that the machine was checked and has no such device.
--
-- Usage (from repo root):
--   mysql -h <MYSQL_HOSTNAME> -P <MYSQL_PORT> -u <MYSQL_USERNAME> -p pcmgmt < db/migrations/0005_add_multimedia_devices.sql

USE pcmgmt;

ALTER TABLE pcs
  ADD COLUMN audio_output ENUM('Working', 'Disabled', 'Faulty', 'None') NULL
    COMMENT 'speaker/audio output health, reported by the PC agent app' AFTER assigned_users,
  ADD COLUMN microphone   ENUM('Working', 'Disabled', 'Faulty', 'None') NULL
    COMMENT 'microphone health, reported by the PC agent app' AFTER audio_output,
  ADD COLUMN camera       ENUM('Working', 'Disabled', 'Faulty', 'None') NULL
    COMMENT 'camera/webcam health, reported by the PC agent app' AFTER microphone;
