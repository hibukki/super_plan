/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom', // if testing React components
    setupFiles: './src/setupTests.ts', // Optional setup file
    include: ['src/logic/*.test.ts'], // More specific path
  },
})
