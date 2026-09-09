export type MachineType = 'Desktop' | 'Laptop' | 'AIO';
export type StorageType = 'SSD' | 'HDD';
export type Os = 'Windows 10' | 'Windows 11';
export type OsEdition = 'Home' | 'Pro' | 'Enterprise' | 'Education';
export type IpConfig = 'Static' | 'Dynamic';
export type ConditionStatus = 'New' | 'Refurbished';
export type Performance = 'Slow' | 'Average' | 'Good' | 'Excellent';
export type Status = 'Active' | 'Retired';
/**
 * Health of one piece of multimedia hardware. Not a yes/no: the office needs to tell
 * "this PC has no camera" apart from "it has one and somebody disabled it".
 * `null` means never reported, which is different again from 'None'.
 */
export type DeviceHealth = 'Working' | 'Disabled' | 'Faulty' | 'None';

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
  audio_output: DeviceHealth | null;
  microphone: DeviceHealth | null;
  camera: DeviceHealth | null;
  comments: string | null;
  last_reported_at: string | null;
  created_at: string;
  updated_at: string;
  /** Rolled up from pc_software / pc_printers by `listPcs`; never stored on the row. */
  software_count?: number;
  printer_count?: number;
  /** Printer names, default first, joined for the sheet and the CSV. */
  printers?: string | null;
}

/** One installed program, as the agent read it from the Uninstall registry key. */
export interface PcSoftware {
  id: number;
  name: string;
  version: string | null;
  publisher: string | null;
  /** ISO date, or null — many installers never write one. */
  install_date: string | null;
}

export type PrinterKind = 'Local' | 'Network' | 'Virtual';

/** One installed printer, as the Windows spooler lists it. */
export interface PcPrinter {
  id: number;
  name: string;
  driver: string | null;
  port: string | null;
  kind: PrinterKind;
  is_default: number;
  status: string | null;
}

// machine_id is owned by the agent API, never by the admin form or CSV import.
export type PcInput = Omit<Pc, 'id' | 'machine_id' | 'last_reported_at' | 'created_at' | 'updated_at'>;
