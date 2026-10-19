import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { jevGates } from './server/jev-plugin';

export default defineConfig(({ mode }) => {
  // Loads .env on the server side only. The page never sees TYPESAFE_API_KEY:
  // Vite only exposes variables that start with VITE_.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), jevGates(env)],
    server: {
      port: 3003,
      strictPort: true,
    },
  };
});
