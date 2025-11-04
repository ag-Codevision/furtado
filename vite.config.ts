import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify('AIzaSyAXC0nh1A0Dwfqk5SSvA1-602P6lIHTqXg'),
        'process.env.GEMINI_API_KEY': JSON.stringify('AIzaSyAXC0nh1A0Dwfqk5SSvA1-602P6lIHTqXg')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});