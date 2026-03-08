import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function readYetiBasePath(): string {
  if (process.env.YETI_BASE_PATH) return process.env.YETI_BASE_PATH
  try {
    const configPath = resolve(__dirname, '../config.yaml')
    const config = readFileSync(configPath, 'utf-8')
    const prefixMatch = config.match(/^route_prefix:\s*["']?([^"'\n]+)["']?/m)
    if (prefixMatch) {
      const prefix = prefixMatch[1].trim()
      return prefix === '/' ? '/' : `${prefix.replace(/\/+$/, '')}/`
    }
    const idMatch = config.match(/^app_id:\s*["']?([^"'\n]+)["']?/m)
    if (idMatch) return `/${idMatch[1].trim()}/`
  } catch { /* config not found */ }
  return './'
}

const basePath = readYetiBasePath()

export default defineConfig({
  base: basePath,
  define: {
    __BASENAME__: JSON.stringify(basePath.replace(/\/$/, '') || '/'),
  },
  plugins: [react()],
  build: {
    outDir: '../web',
    emptyOutDir: true,
  },
  server: {
    fs: { allow: ['..'] },
    port: 5186,
  },
})
