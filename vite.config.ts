import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Production only: the page may not talk to any server but its own.
// (The dev server needs inline scripts and websockets, so it is left out there.)
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "connect-src 'self'",
  "img-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ')

const csp = (): Plugin => ({
  name: 'csp',
  apply: 'build',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
})

export default defineConfig({
  base: '/whv-payslip-tracker/', // GitHub Pages serves the repo under this path
  plugins: [react(), csp()],
})
