import { defineConfig, loadEnv, type ConfigEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { readFileSync } from 'fs';

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
    plugins: [vue()],
    server: {
      port: 3333,
      open: true,
      proxy: {
        // Proxy /api requests to Home Assistant
        '/api': {
          target: haAddress,
          changeOrigin: true,
          secure: false,
          rewrite: (path: string) => path, // Keep /api in the path
        }
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: true
    }
  };
});

