import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { game: 'index.html', 'designspace-scorecards': 'src/designspace-scorecards.tsx', 'designspace': 'src/designspace.tsx' },
      output: { entryFileNames: chunk => chunk.name.startsWith('designspace') ? `assets/${chunk.name}.js` : 'assets/[name]-[hash].js' },
    },
  },
  server: {
    proxy: {
      '/designspace': {
        target: 'http://localhost:3001',
        changeOrigin: false,
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: false,
      },
    },
  },
})
