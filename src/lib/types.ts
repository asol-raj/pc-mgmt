export type MachineType = 'Desktop' | 'Laptop' | 'AIO';
export type StorageType = 'SSD' | 'HDD';
export type Os = 'Windows 10' | 'Windows 11';
export type OsEdition = 'Home' | 'Pro' | 'Enterprise' | 'Education';
export type IpConfig = 'Static' | 'Dynamic';
export type ConditionStatus = 'New' | 'Refurbished';
export type Performance = 'Slow' | 'Average' | 'Good' | 'Excellent';
export type Status = 'Active' | 'Retired';

export interface Pc {
  id: number;
  asset_tag: string;
  machine_id: string | null;
  name: string;
  brand: string | null;
  machine_type: MachineType;
  cpu: string | null;
  ram_gb: number | null;
  storage_type: StorageType | null;
  storage_capacity: string | null;
  os: Os;
  os_edition: OsEdition | null;
  condition_status: ConditionStatus;
  location: string;
  used_by: string | null;
  extension_number: string | null;
  teamviewer_id: string | null;
  ip_address: string | null;
  ip_config: IpConfig | null;
  status: Status;
  performance: Performance;
  softwares: string | null;
  assigned_users: string | null;
  comments: string | null;
  last_reported_at: string | null;
  created_at: string;
  updated_at: string;
}

// machine_id is owned by the agent API, never by the admin form or CSV import.
export type PcInput = Omit<Pc, 'id' | 'machine_id' | 'last_reported_at' | 'created_at' | 'updated_at'>;
