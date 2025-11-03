import type { Plugin } from 'vite';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Vite plugin to handle backup file saving
 * Adds an API endpoint /api/backup that saves JSON files to the backups directory
 */
export function backupPlugin(): Plugin {
  return {
    name: 'vite-plugin-backup',
    configureServer(server) {
      // Add middleware to handle backup requests
      // This runs before the proxy middleware
      server.middlewares.use('/api/backup', (req, res, next) => {
        // Only handle POST requests
        if (req.method !== 'POST') {
          return next();
        }

        console.log('📦 Backup request received:', req.url);
        let body = '';
        req.on('data', (chunk) => {
          body += chunk.toString();
        });

        req.on('end', () => {
          try {
            const backup = JSON.parse(body);
            const backupsDir = join(process.cwd(), 'backups');
            
            // Create backups directory if it doesn't exist
            try {
              mkdirSync(backupsDir, { recursive: true });
            } catch (e) {
              // Directory might already exist
            }

            // Save backup file
            const filename = `dashboard-backup-${backup.date || backup.timestamp.replace(/[:.]/g, '-')}.json`;
            const filepath = join(backupsDir, filename);
            writeFileSync(filepath, JSON.stringify(backup, null, 2), 'utf-8');

            console.log(`✅ Backup saved to: ${filepath}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, filename, path: filepath }));
          } catch (error) {
            console.error('❌ Error saving backup:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: String(error) }));
          }
        });
      });
    },
  };
}

