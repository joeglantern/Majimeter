// Database row types — match the column names returned by the postgres driver

export type UserRole = 'user' | 'technician' | 'admin'
export type WaterPointType = 'borehole' | 'tank' | 'pipe' | 'tap'
export type WaterPointStatus = 'active' | 'inactive' | 'maintenance'
export type ReportType = 'shortage' | 'burst_pipe' | 'contamination' | 'infrastructure' | 'other'
export type ReportStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed'
export type AlertType = 'low_level' | 'high_pressure' | 'low_pressure' | 'no_flow' | 'leak_detected'
export type AlertSeverity = 'info' | 'warning' | 'critical'
export type NotificationType = 'alert' | 'report_update' | 'system'

export interface UserRow {
  id: string
  name: string
  email: string
  phone: string | null
  password_hash: string
  role: UserRole
  location_lat: string | null
  location_lng: string | null
  fcm_token: string | null
  created_at: Date
  updated_at: Date
}

export interface WaterPointRow {
  id: string
  name: string
  type: WaterPointType
  location_lat: string
  location_lng: string
  address: string | null
  status: WaterPointStatus
  sensor_id: string | null
  created_at: Date
  updated_at: Date
}

export interface SensorReadingRow {
  time: Date
  sensor_id: string
  water_point_id: string
  flow_rate: string | null
  pressure: string | null
  water_level: string | null
  temperature: string | null
  battery_level: string | null
}

export interface ReportRow {
  id: string
  user_id: string
  water_point_id: string | null
  type: ReportType
  title: string
  description: string | null
  location_lat: string
  location_lng: string
  images: string[]
  status: ReportStatus
  upvotes: number
  created_at: Date
  resolved_at: Date | null
}

export interface AlertRow {
  id: string
  water_point_id: string
  type: AlertType
  severity: AlertSeverity
  message: string
  triggered_at: Date
  acknowledged_at: Date | null
  acknowledged_by: string | null
}

export interface NotificationRow {
  id: string
  user_id: string
  title: string
  body: string
  type: NotificationType
  ref_id: string | null
  read: boolean
  sent_at: Date
}
