import { defineConfig, loadEnv, type ConfigEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { readFileSync } from 'fs';
import { backupPlugin } from './vite-plugin-backup';

export default defineConfig(({ mode }: ConfigEnv) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
      // Try to get HA address from env, or read from config.ts, or use default
  let haAddress = env.VITE_HA_ADDRESS;
  
  if (!haAddress) {
    try {
      // Try to extract address from config.ts
      const configContent = readFileSync('config.ts', 'utf-8');
      const addressMatch = configContent.match(/address:\s*import\.meta\.env\.VITE_HA_ADDRESS\s*\|\|\s*['"]([^'"]+)['"]/);
      if (addressMatch) {
        haAddress = addressMatch[1];
      }
    } catch (e) {
      // If reading fails, use default
    }
  }
  
  // Default fallback
  haAddress = haAddress || 'http://halaptop:8123';
  
  console.log(`🔧 Using Home Assistant proxy target: ${haAddress}`);

  return {
    plugins: [vue(), backupPlugin()],
    server: {
      port: 3333,
      open: true,
      proxy: {
        // Proxy /api requests to Home Assistant, but bypass /api/backup
        '/api': {
          target: haAddress,
          changeOrigin: true,
          secure: false,
          rewrite: (path: string) => path, // Keep /api in the path
          bypass(req) {
            // Don't proxy /api/backup requests - let our middleware handle them
            if (req.url === '/api/backup') {
              return req.url; // Return the URL to bypass proxy
            }
            return null; // Continue with proxy for other /api routes
          },
        }
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: true
    }
  };
});

