import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/types/**',
        'src/components/BrandLogo.tsx',
        'src/features/dashboard/DashboardSkeleton.tsx',
      ],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 90 },
    },
  },
})
