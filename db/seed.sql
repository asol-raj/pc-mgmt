-- db/seed.sql
-- Optional: inserts a handful of sample PCs for local dev/testing.
-- Usage: mysql -h <MYSQL_HOSTNAME> -P <MYSQL_PORT> -u <MYSQL_USERNAME> -p pcmgmt < db/seed.sql

USE pcmgmt;

INSERT INTO pcs
  (asset_tag, name, brand, machine_type, cpu, ram_gb, storage_type, storage_capacity, os, condition_status, location, extension_number, teamviewer_id, status, performance, softwares, assigned_users, comments)
VALUES
  ('PC-001', 'Reception Desk PC', 'Dell', 'Desktop', 'Intel i5-12400', 8, 'SSD', '256GB', 'Windows 11', 'New', 'Ground Floor - Reception', '101', '123 456 789', 'Active', 'Excellent', 'Office 365, Google Chrome, Adobe Reader', 'Anita Sharma', NULL),
  ('PC-002', 'Accounts - Priya', 'HP', 'Desktop', 'Intel i3-4160', 4, 'HDD', '500GB', 'Windows 10', 'Refurbished', '2nd Floor - Accounts', '204', '234 567 890', 'Active', 'Average', 'Office 2019, Tally, Google Chrome', 'Priya Verma', NULL),
  ('PC-003', 'Accounts - Rahul', 'Lenovo', 'Desktop', 'Pentium G3220', 4, 'HDD', '500GB', 'Windows 10', 'Refurbished', '2nd Floor - Accounts', '205', '345 678 901', 'Active', 'Slow', 'Tally, Google Chrome', 'Rahul Mehta', 'Runs slow, candidate for upgrade'),
  ('PC-004', 'Sales Desk 1', 'Dell', 'Desktop', 'Intel i5-13400', 16, 'SSD', '512GB', 'Windows 11', 'New', '1st Floor - Sales', '112', '456 789 012', 'Active', 'Excellent', 'Office 365, Google Chrome, Zoom', 'Karan Singh', NULL),
  ('PC-005', 'Sales Desk 2 (Laptop)', 'Lenovo', 'Laptop', 'Intel i5-13400', 16, 'SSD', '512GB', 'Windows 11', 'New', '1st Floor - Sales', '113', '567 890 123', 'Active', 'Good', 'Office 365, Google Chrome, Zoom', 'Neha Kapoor', NULL),
  ('PC-006', 'HR Desk', 'HP', 'AIO', 'Intel i5-3470', 8, 'HDD', '500GB', 'Windows 10', 'Refurbished', '2nd Floor - HR', '210', '678 901 234', 'Active', 'Average', 'Office 2016, Google Chrome, Google Drive', 'Simran Kaur', NULL),
  ('PC-007', 'Support Engineer 1', 'Custom Build', 'Desktop', 'AMD Ryzen 5 5600', 16, 'SSD', '512GB', 'Windows 11', 'New', '1st Floor - Support', '121', '789 012 345', 'Active', 'Good', 'Google Chrome, TeamViewer, Slack', 'Amit Roy', NULL),
  ('PC-008', 'Support Engineer 2', 'Acer', 'Desktop', 'Core 2 Duo E8400', 4, 'HDD', '250GB', 'Windows 10', 'Refurbished', '1st Floor - Support', '122', '890 123 456', 'Active', 'Slow', 'Google Chrome', 'Deepak Nair', 'Very slow, frequent complaints'),
  ('PC-009', 'Old Store Room PC', 'HP', 'Desktop', 'Pentium 4', 2, 'HDD', '160GB', 'Windows 10', 'Refurbished', 'Basement - Storage', NULL, '901 234 567', 'Retired', 'Slow', NULL, NULL, 'Retired, kept for spare parts'),
  ('PC-010', 'Manager Cabin', 'Dell', 'AIO', 'Intel i7-13700', 32, 'SSD', '1TB', 'Windows 11', 'New', '3rd Floor - Manager Cabin', '301', '012 345 678', 'Active', 'Excellent', 'Office 365, Google Chrome, Adobe Acrobat Pro', 'Vikram Malhotra', NULL)
ON DUPLICATE KEY UPDATE name = VALUES(name);
