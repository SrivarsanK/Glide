import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Glide vite plugin - source stamping for visual editing
// Uncomment after `npm install @srivarsank/glide` in this dir
// import { glideSourceStamping } from '@srivarsank/glide/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    // glideSourceStamping(), // ← enable for Glide visual editing
  ],
  server: {
    port: 5174,
    open: true,
  },
});
