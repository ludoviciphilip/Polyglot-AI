import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
    
    return {
      server: {
        port: port,
        host: '0.0.0.0',
      },
      preview: {
        port: port,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
