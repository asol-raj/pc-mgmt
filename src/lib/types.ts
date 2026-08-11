export type MachineType = 'Desktop' | 'Laptop' | 'AIO';
export type StorageType = 'SSD' | 'HDD';
export type Os = 'Windows 10' | 'Windows 11';
export type ConditionStatus = 'New' | 'Refurbished';
export type Performance = 'Slow' | 'Average' | 'Good' | 'Excellent';
export type Status = 'Active' | 'Retired';

export interface Pc {
  id: number;
  asset_tag: string;
  name: string;
  brand: string | null;
  machine_type: MachineType;
  cpu: string | null;
  ram_gb: number | null;
  storage_type: StorageType | null;
  storage_capacity: string | null;
  os: Os;
  condition_status: ConditionStatus;
  location: string;
  extension_number: string | null;
  teamviewer_id: string | null;
  status: Status;
  performance: Performance;
  softwares: string | null;
  assigned_users: string | null;
  comments: string | null;
  created_at: string;
  updated_at: string;
}

export type PcInput = Omit<Pc, 'id' | 'created_at' | 'updated_at'>;
