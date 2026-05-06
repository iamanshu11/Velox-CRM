import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Use the ESM-native URL constructor instead of path + __dirname so the
// config works in both Node CJS and ESM environments without @types/node.
const srcDir = new URL('./src', import.meta.url).pathname

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': srcDir,
    },
  },
})
