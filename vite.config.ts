/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { cpSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const heroPagePath = fileURLToPath(new URL('./hero page/index.html', import.meta.url))
const heroAssetsPath = fileURLToPath(new URL('./hero page/assets', import.meta.url))

function sealboxHeroAtRoot() {
  return {
    name: 'sealbox-hero-at-root',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use((request, response, next) => {
        if (request.method !== 'GET' || request.url?.split('?')[0] !== '/') {
          next()
          return
        }

        const html = readFileSync(heroPagePath, 'utf8')
          .replaceAll('./assets/', '/hero%20page/assets/')
          .replaceAll('./sealbox-icon.svg', '/hero%20page/sealbox-icon.svg')
          .replaceAll('href="/icons.svg"', 'href="/hero%20page/assets/icons/icons.svg"')
          .replaceAll('href="/fonts/', 'href="/hero%20page/assets/fonts/')

        response.statusCode = 200
        response.setHeader('Content-Type', 'text/html; charset=utf-8')
        response.end(html)
      })
    },
  }
}

function sealboxHeroForProduction() {
  return {
    name: 'sealbox-hero-for-production',
    apply: 'build' as const,
    closeBundle() {
      const appHtmlPath = fileURLToPath(new URL('./dist/index.html', import.meta.url))
      const appHtmlOutputPath = fileURLToPath(new URL('./dist/app.html', import.meta.url))
      renameSync(appHtmlPath, appHtmlOutputPath)
      cpSync(heroAssetsPath, fileURLToPath(new URL('./dist/hero-assets', import.meta.url)), { recursive: true, force: true })

      const heroHtml = readFileSync(heroPagePath, 'utf8')
        .replaceAll('./assets/', '/hero-assets/')
        .replaceAll('./sealbox-icon.svg', '/favicon.svg')
        .replaceAll('href="/icons.svg"', 'href="/hero-assets/icons/icons.svg"')
        .replaceAll('href="/fonts/', 'href="/hero-assets/fonts/')
      writeFileSync(fileURLToPath(new URL('./dist/index.html', import.meta.url)), heroHtml)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [sealboxHeroAtRoot(), react(), sealboxHeroForProduction()],
  server: {
    proxy: {
      '/api': `http://127.0.0.1:${process.env.SEALBOX_AUTH_PORT || '4176'}`,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/components/**'],
    },
  },
})
