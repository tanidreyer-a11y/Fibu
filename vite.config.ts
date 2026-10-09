import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { aiStatus, runAi } from './api/ai.ts'
import { searchFoods } from './api/food-search.ts'

/** Serves /api/* locally with the same cores the Vercel functions use, keys read from .env.local. */
function devAiApi(env: Record<string, string>): Plugin {
  return {
    name: 'fibu-dev-ai-api',
    configureServer(server) {
      server.middlewares.use('/api/ai', async (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }
        if (req.method === 'GET') return send(200, aiStatus(env))
        if (req.method !== 'POST') return send(405, { ok: false, error: 'bad_request' })

        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        let body: unknown
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        } catch {
          return send(400, { ok: false, error: 'bad_request', detail: 'Invalid JSON' })
        }
        try {
          const result = await runAi(body, env)
          send(result.status, result.res)
        } catch (err) {
          // Never let one bad request take the whole dev server down.
          console.error('[ai] dev handler error', err)
          send(500, { ok: false, error: 'upstream' })
        }
      })
      server.middlewares.use('/api/food-search', async (req, res) => {
        const q = new URL(req.url ?? '', 'http://localhost').searchParams.get('q') ?? ''
        const { status, body } = await searchFoods(q).catch(() => ({ status: 500, body: { ok: false, error: 'server' } }))
        res.statusCode = status
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(body))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __BUILD_TAG__: JSON.stringify(
      `${new Date().toISOString().slice(0, 16).replace('T', ' ')} ${(process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7)}`,
    ),
  },
  plugins: [
    react(),
    tailwindcss(),
    devAiApi(loadEnv(mode, process.cwd(), '')),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Fibu',
        short_name: 'Fibu',
        description: 'Your progressive overload training and nutrition buddy',
        theme_color: '#fbfaf8',
        background_color: '#fbfaf8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,ico,woff2,json}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // The service worker must never answer /api calls from cache or with index.html.
        navigateFallbackDenylist: [/^\/api\//],
        // Exercise photos come from the open database's CDN; keep the ones you've viewed for offline use.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/gh\/yuhonas\/free-exercise-db@/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'exercise-images',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
}))
