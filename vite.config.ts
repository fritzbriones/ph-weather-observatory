import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site at https://<user>.github.io/ph-weather-observatory/.
// If you change the repository name, change `base` to match it.
export default defineConfig({
  plugins: [react()],
  base: '/ph-weather-observatory/',
});
