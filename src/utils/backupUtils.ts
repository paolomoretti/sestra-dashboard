/**
 * Backup utility for dashboard localStorage data
 */

export interface DashboardBackup {
  version: string;
  timestamp: string;
  date: string;
  data: {
    entities: string[];
    positions: Record<string, string>;
    sizes: Record<string, string>;
    icons: Record<string, string>;
    actions: Record<string, { tapAction?: any; holdAction?: any }>;
    scale: number;
    panX: number;
    panY: number;
  };
}

const STORAGE_KEYS = {
  entities: 'ha_dashboard_entities',
  positions: 'ha_dashboard_positions',
  sizes: 'ha_dashboard_sizes',
  icons: 'ha_dashboard_icons',
  actions: 'ha_dashboard_actions',
  scale: 'ha_dashboard_scale',
  panX: 'ha_dashboard_pan_x',
  panY: 'ha_dashboard_pan_y',
} as const;

const BACKUP_VERSION = '1.0.0';

/**
 * Create a backup snapshot of all dashboard data
 */
export function createBackup(): DashboardBackup {
  const now = new Date();
  const timestamp = now.toISOString();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD format

  return {
    version: BACKUP_VERSION,
    timestamp,
    date,
    data: {
      entities: JSON.parse(localStorage.getItem(STORAGE_KEYS.entities) ?? '[]'),
      positions: JSON.parse(localStorage.getItem(STORAGE_KEYS.positions) ?? '{}'),
      sizes: JSON.parse(localStorage.getItem(STORAGE_KEYS.sizes) ?? '{}'),
      icons: JSON.parse(localStorage.getItem(STORAGE_KEYS.icons) ?? '{}'),
      actions: JSON.parse(localStorage.getItem(STORAGE_KEYS.actions) ?? '{}'),
      scale: JSON.parse(localStorage.getItem(STORAGE_KEYS.scale) ?? '0'),
      panX: JSON.parse(localStorage.getItem(STORAGE_KEYS.panX) ?? '0'),
      panY: JSON.parse(localStorage.getItem(STORAGE_KEYS.panY) ?? '0'),
    },
  };
}

/**
 * Download backup as JSON file
 */
export function downloadBackup(backup: DashboardBackup): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dashboard-backup-${backup.date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Save backup to localStorage (for daily backups)
 */
export function saveBackupToStorage(backup: DashboardBackup): void {
  const backupKey = `dashboard_backup_${backup.date}`;
  localStorage.setItem(backupKey, JSON.stringify(backup));
}

/**
 * Get the last backup date
 */
export function getLastBackupDate(): string | null {
  const lastBackupKey = 'dashboard_last_backup_date';
  return localStorage.getItem(lastBackupKey);
}

/**
 * Set the last backup date
 */
export function setLastBackupDate(date: string): void {
  const lastBackupKey = 'dashboard_last_backup_date';
  localStorage.setItem(lastBackupKey, date);
}

/**
 * Check if we need to create a daily backup (hasn't been done today)
 */
export function shouldCreateDailyBackup(): boolean {
  const today = new Date().toISOString().split('T')[0];
  const lastBackupDate = getLastBackupDate();
  return lastBackupDate !== today;
}

/**
 * Create and save daily backup
 */
export async function createDailyBackup(): Promise<void> {
  if (!shouldCreateDailyBackup()) {
    return;
  }

  const backup = createBackup();
  saveBackupToStorage(backup);
  setLastBackupDate(backup.date);
  
  // Also save to server in development
  if (import.meta.env.DEV) {
    await saveBackupToServer(backup);
  }
  
  console.log(`✅ Daily backup created for ${backup.date}`);
}

/**
 * Save backup to server (via API endpoint)
 */
export async function saveBackupToServer(backup: DashboardBackup): Promise<boolean> {
  try {
    console.log('📤 Attempting to save backup to server at /api/backup...');
    const response = await fetch('/api/backup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backup),
    });

    console.log('📥 Server response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Server error response:', errorText);
      throw new Error(`Server responded with ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('📦 Server response:', result);
    
    if (result.success) {
      console.log(`✅ Backup saved to server: ${result.filename}`);
      return true;
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (error) {
    console.error('❌ Failed to save backup to server:', error);
    return false;
  }
}

/**
 * Create manual backup and save to server (and download as fallback)
 */
export async function createManualBackup(): Promise<void> {
  const backup = createBackup();
  
  // Try to save to server first (in development)
  if (import.meta.env.DEV) {
    const saved = await saveBackupToServer(backup);
    if (saved) {
      // Server save succeeded - only save to localStorage, don't download
      const snapshotKey = `dashboard_snapshot_${backup.timestamp.replace(/[:.]/g, '-')}`;
      localStorage.setItem(snapshotKey, JSON.stringify(backup));
      console.log(`✅ Manual backup saved to server: ${backup.timestamp}`);
      return;
    }
    // If server save failed, log and fall through to download
    console.warn('⚠️ Server save failed, downloading backup instead');
  }
  
  // Fallback: just download if server save fails or in production
  downloadBackup(backup);
  
  // Also save to localStorage as a snapshot
  const snapshotKey = `dashboard_snapshot_${backup.timestamp.replace(/[:.]/g, '-')}`;
  localStorage.setItem(snapshotKey, JSON.stringify(backup));
  
  console.log(`✅ Manual backup created and downloaded: ${backup.timestamp}`);
}

